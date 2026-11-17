import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/offline/license_guard.dart';
import '../../core/offline/offline_platform.dart';
import '../../core/offline/offline_ports.dart';
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
final courseViewProvider = FutureProvider.autoDispose.family<CourseView, int>((ref, id) => ref.read(studentRepositoryProvider).course(id));
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
final removedDownloadsProvider = StateProvider<List<Removed>>((ref) => const []);
