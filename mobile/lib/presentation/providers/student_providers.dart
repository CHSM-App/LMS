import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/offline/license_guard.dart';
import '../../core/offline/offline_platform.dart';
import '../../core/offline/offline_ports.dart';
import '../../core/offline/offline_sync.dart';
import '../../core/offline/progress_queue.dart';
import '../../data/models/student_models.dart';
import '../../data/repositories/student_repository.dart';
import '../viewModels/download_viewmodel.dart';
import '../viewModels/exam_viewmodel.dart';
import 'core_providers.dart';

/// Student + public wiring (Flutter_ARCHITECTURE §10.3). Screens read data through these.
final publicRepositoryProvider = Provider<PublicRepository>((ref) => ApiPublicRepository(ref.read(apiClientProvider)));
final studentRepositoryProvider = Provider<StudentRepository>((ref) => ApiStudentRepository(ref.read(apiClientProvider)));

final catalogProvider = FutureProvider.autoDispose.family<List<CourseCard>, String>((ref, q) => ref.read(publicRepositoryProvider).courses(q: q));
final courseDetailProvider = FutureProvider.autoDispose.family<CourseDetail, String>((ref, slug) => ref.read(publicRepositoryProvider).course(slug));

final studentDashboardProvider = FutureProvider.autoDispose<StudentDashboard>((ref) => ref.read(studentRepositoryProvider).dashboard());
/// Where I stand with one catalogue course: [status] is enrolled | pending | rejected | blocked.
/// Courses that are not in the map are open to enroll.
class MyEnrollment {
  const MyEnrollment({required this.status, this.courseId, this.rejectReason, this.teacher});
  final String status;
  final int? courseId;
  final String? rejectReason;
  final String? teacher;
}

/// Same idea as the website's useMyEnrollments: built from the dashboard (approved courses, then every other
/// request), so no extra endpoint. Empty for visitors and for non-students, and while the dashboard loads.
final myEnrollmentsProvider = Provider.autoDispose<Map<String, MyEnrollment>>((ref) {
  if (ref.watch(sessionProvider).user?.role != 'student') return const {};
  final d = ref.watch(studentDashboardProvider).valueOrNull;
  if (d == null) return const {};
  return {
    for (final r in d.requests)
      if (r.courseSlug != null) r.courseSlug!: MyEnrollment(status: r.status, rejectReason: r.rejectReason, teacher: r.teacher),
    for (final c in d.myCourses)
      if (c.slug != null) c.slug!: MyEnrollment(status: 'enrolled', courseId: c.courseId),
  };
});

final courseViewProvider =FutureProvider.autoDispose.family<CourseView, int>((ref, id) => ref.read(studentRepositoryProvider).course(id));
final lessonProvider = FutureProvider.autoDispose.family<LessonDetail, int>((ref, id) => ref.read(studentRepositoryProvider).lesson(id));
final studentExamsProvider = FutureProvider.autoDispose.family<List<ExamCard>, int>((ref, courseId) => ref.read(studentRepositoryProvider).exams(courseId));
final attemptResultProvider = FutureProvider.autoDispose.family<AttemptResult, String>((ref, id) => ref.read(studentRepositoryProvider).result(id));
final studentLiveClassesProvider = FutureProvider.autoDispose<List<LiveClassItem>>((ref) => ref.read(studentRepositoryProvider).liveClasses());
final studentDoubtsProvider = FutureProvider.autoDispose<List<StudentDoubt>>((ref) => ref.read(studentRepositoryProvider).doubts());
final studentProgressProvider = FutureProvider.autoDispose<List<CourseProgress>>((ref) => ref.read(studentRepositoryProvider).progress());
final studentProfileProvider = FutureProvider.autoDispose<StudentProfile>((ref) => ref.read(studentRepositoryProvider).profile());
final notificationsProvider = FutureProvider.autoDispose<List<AppNotification>>((ref) => ref.read(studentRepositoryProvider).notifications());
final devicesProvider = FutureProvider.autoDispose<List<RegisteredDevice>>((ref) => ref.read(studentRepositoryProvider).devices());

final examProvider = StateNotifierProvider.autoDispose.family<ExamViewModel, ExamState, int>(
  (ref, examId) => ExamViewModel(ref.read(studentRepositoryProvider), examId)..start(),
);

// ---------- Offline ----------
final downloadDaoProvider = Provider<DownloadDao>((ref) => SqfliteDownloadDao());
final keyVaultProvider = Provider<KeyVault>((ref) => SecureKeyVault());
final networkInfoProvider = Provider<NetworkInfo>((ref) => ConnectivityNetworkInfo());
final licenseGuardProvider = Provider<LicenseGuard>((ref) => LicenseGuard(dao: ref.read(downloadDaoProvider), vault: ref.read(keyVaultProvider)));

final progressQueueProvider = Provider<OfflineProgressQueue>(
  (ref) => OfflineProgressQueue(dao: ref.read(downloadDaoProvider), repo: ref.read(studentRepositoryProvider), network: ref.read(networkInfoProvider)),
);

const _wifiOnlyKey = 'downloads_wifi_only';

final downloadsProvider = StateNotifierProvider<DownloadViewModel, DownloadsState>((ref) {
  final vm = DownloadViewModel(
    repo: ref.read(studentRepositoryProvider),
    dao: ref.read(downloadDaoProvider),
    vault: ref.read(keyVaultProvider),
    network: ref.read(networkInfoProvider),
    storage: DeviceChannel(),
    downloader: DioDownloader(),
    deviceId: DeviceIdentity.id,
    offlineDir: offlineDirectory,
    tempDir: offlineTempDirectory,
    saveWifiOnly: (v) async => (await SharedPreferences.getInstance()).setBool(_wifiOnlyKey, v),
  );
  SharedPreferences.getInstance().then((p) => vm.load(wifiOnly: p.getBool(_wifiOnlyKey) ?? false));
  return vm;
});

/// What renewAll removed on the last start/online event, shown once on the Downloads screen.
final removedDownloadsProvider = StateProvider<List<RemovedDownload>>((ref) => const []);

/// This phone's id for download licences and device-aware logout.
final deviceIdProvider = Provider<Future<String> Function()>((ref) => DeviceIdentity.id);

/// Deletes every offline file and key (logout, account deletion, session ended).
final offlineWipeProvider = Provider<Future<void> Function()>((ref) => () => ref.read(downloadsProvider.notifier).wipeAll());

/// Licence renewal + offline progress sync on app start and whenever connectivity returns.
final offlineSyncProvider = Provider<OfflineSync>((ref) {
  final sync = OfflineSync(
    network: ref.read(networkInfoProvider),
    renew: () => ref.read(downloadsProvider.notifier).renewAll(),
    syncProgress: () => ref.read(progressQueueProvider).sync(),
    onRemoved: (removed) => ref.read(removedDownloadsProvider.notifier).state = removed,
  );
  ref.onDispose(sync.dispose);
  return sync;
});

/// Logout from the app: tells the server which phone (so it revokes this phone's downloads),
/// then the app deletes every offline video and key on the phone (see LmsApp).
Future<void> logoutStudent(WidgetRef ref) async {
  String? device;
  try {
    device = await ref.read(deviceIdProvider)();
  } catch (_) {
    device = null;
  }
  // The session-end listener in LmsApp then deletes every offline video and key.
  await ref.read(authRepositoryProvider).logout(deviceId: device);
}
