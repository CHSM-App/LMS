import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lms_app/app_router.dart';
import 'package:lms_app/core/offline/offline_ports.dart';
import 'package:lms_app/core/theme/app_theme.dart';
import 'package:lms_app/data/models/student_models.dart';
import 'package:lms_app/l10n/gen/app_localizations.dart';
import 'package:lms_app/presentation/providers/student_providers.dart';
import 'package:lms_app/presentation/viewModels/download_viewmodel.dart';
import 'package:lms_app/screens/student/downloads_screen.dart';
import 'package:lms_app/screens/student/exam_screen.dart';
import 'package:lms_app/screens/student/student_dashboard_screen.dart';
import 'package:lms_app/screens/student/widgets/lesson_row.dart';

import '../offline/offline_fakes.dart';
import 'fake_student_repo.dart';

Widget app(Widget home, {List<Override> overrides = const [], Locale locale = const Locale('en')}) => ProviderScope(
      overrides: overrides,
      child: MaterialApp(
        theme: AppTheme.light(),
        locale: locale,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: home,
      ),
    );

void main() {
  group('lesson row download button', () {
    Future<void> pumpRow(WidgetTester tester, Lesson lesson) => tester.pumpWidget(app(Scaffold(body: LessonRow(lesson: lesson, onTap: () {}, onDownload: () {}))));

    testWidgets('shown for uploaded videos', (tester) async {
      await pumpRow(tester, const Lesson(id: 1, title: 'Fractions', type: 'video', videoSource: 'upload', downloadable: true));
      expect(find.byTooltip('Download'), findsOneWidget);
    });

    for (final source in ['youtube', 'vimeo', 'bunny']) {
      testWidgets('hidden for $source link videos', (tester) async {
        await pumpRow(tester, Lesson(id: 1, title: 'Fractions', type: 'video', videoSource: source));
        expect(find.byTooltip('Download'), findsNothing);
      });
    }
  });

  testWidgets('Downloads screen: grouped by course, storage line, Wi-Fi toggle, and no share action anywhere', (tester) async {
    final dir = Directory.systemTemp.createTempSync('dls');
    addTearDown(() => dir.deleteSync(recursive: true));
    final dao = MemoryDownloadDao();
    await dao.upsert(DownloadRecord(contentId: 5, courseId: 3, courseTitle: 'Maths', title: 'Fractions', sizeBytes: 50 * 1024 * 1024, filePath: '${dir.path}/a.bin', keyId: 'k', licenseExpiresAt: DateTime.utc(2099)));
    final vm = DownloadViewModel(
      repo: FakeStudentRepo(),
      dao: dao,
      vault: MemoryKeyVault(),
      network: FakeNetwork(),
      storage: FakeStorage(null),
      downloader: FakeDownloader(sampleBytes(10)),
      deviceId: () async => 'dev-123456',
      offlineDir: () async => dir,
      tempDir: () async => dir,
    );
    await vm.load();
    await tester.pumpWidget(app(const DownloadsScreen(), overrides: [
      downloadsProvider.overrideWith((ref) => vm),
      devicesProvider.overrideWith((ref) async => [const RegisteredDevice(deviceId: 'dev-123456', deviceName: 'android', downloads: 1)]),
    ]));
    await tester.pumpAndSettle();
    expect(find.text('Maths'), findsOneWidget);
    expect(find.text('Fractions'), findsOneWidget);
    expect(find.text('Using 50 MB on this phone'), findsOneWidget);
    expect(find.text('Download on Wi-Fi only'), findsOneWidget);
    expect(find.byIcon(Icons.share), findsNothing);
    expect(find.byIcon(Icons.share_outlined), findsNothing);
    expect(find.byIcon(Icons.ios_share), findsNothing);
    expect(find.textContaining(RegExp('share|export|open with', caseSensitive: false)), findsNothing);
  });

  testWidgets('exam screen shows the server timer and the offline notice', (tester) async {
    final repo = FakeStudentRepo(paper: paperFixture(deadlineAt: DateTime.now().toUtc().add(const Duration(minutes: 10))))..saveFailures = 100;
    await tester.pumpWidget(app(const ExamScreen(examId: 9), overrides: [studentRepositoryProvider.overrideWithValue(repo)]));
    await tester.pump();
    await tester.pump();
    expect(find.textContaining(RegExp(r'(10:00|9:5\d)')), findsOneWidget);
    await tester.tap(find.text('4'));
    await tester.pump(const Duration(seconds: 1));
    expect(find.text('Offline — answers will sync'), findsOneWidget);
    expect(find.byIcon(Icons.share), findsNothing);
    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(minutes: 1));
  });

  group('leaving an exam with Back', () {
    Future<FakeStudentRepo> open(WidgetTester tester, {required String mode}) async {
      final repo = FakeStudentRepo(paper: paperFixture(mode: mode, deadlineAt: mode == 'mock' ? DateTime.now().toUtc().add(const Duration(minutes: 10)) : null));
      await tester.pumpWidget(app(
        Builder(builder: (c) => Scaffold(body: TextButton(onPressed: () => Navigator.of(c).push(MaterialPageRoute<void>(builder: (_) => const ExamScreen(examId: 9))), child: const Text('open')))),
        overrides: [studentRepositoryProvider.overrideWithValue(repo)],
      ));
      await tester.tap(find.text('open'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      return repo;
    }

    testWidgets('mock: Back asks to stay or submit, and staying keeps the exam open', (tester) async {
      final repo = await open(tester, mode: 'mock');
      await tester.binding.handlePopRoute();
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      expect(find.text('Leave the exam?'), findsOneWidget);
      expect(find.textContaining('timer keeps running'), findsOneWidget);
      await tester.tap(find.text('Stay in the exam'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      expect(find.text('Leave the exam?'), findsNothing);
      expect(find.text('Unit Test 1'), findsOneWidget);
      expect(repo.submits, 0);
      await tester.pumpWidget(const SizedBox());
      await tester.pump(const Duration(minutes: 1));
    });

    testWidgets('practice: Back leaves straight away with no question', (tester) async {
      await open(tester, mode: 'practice');
      await tester.binding.handlePopRoute();
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      expect(find.text('Leave the exam?'), findsNothing);
      expect(find.text('open'), findsOneWidget);
    });
  });

  testWidgets('Marathi dashboard with a long teacher name fits a 360 dp phone without overflow', (tester) async {
    tester.view.physicalSize = const Size(360, 720);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final dash = StudentDashboard.fromJson({
      'myCourses': [
        {'courseId': 3, 'title': 'इयत्ता दहावी गणित — संपूर्ण अभ्यासक्रम आणि सराव परीक्षा', 'teacher': 'श्रीमती सुवर्णलता ज्ञानेश्वर कुलकर्णी-देशपांडे', 'batch': 'सकाळची बॅच (७ ते ९)', 'progressPct': 45, 'accessStatus': 'active', 'endDate': '2099-12-31'},
      ],
      'upcomingLiveClasses': [
        {'id': 1, 'topic': 'अपूर्णांक आणि दशांश अपूर्णांकांची उजळणी', 'course': 'इयत्ता दहावी गणित', 'startsAt': '2099-06-15T03:30:00Z', 'durationMin': 60, 'meetLink': 'https://meet.google.com/abc-defg-hij'},
      ],
      'requests': [],
    });
    await tester.pumpWidget(app(const StudentDashboardScreen(), locale: const Locale('mr'), overrides: [studentDashboardProvider.overrideWith((ref) async => dash)]));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    expect(find.textContaining('कुलकर्णी'), findsWidgets);
    expect(find.text('पुढचा धडा'), findsOneWidget);
  });

  test('role gate sends a student away from teacher and admin routes, keeps public and student ones', () {
    expect(roleRedirect('/teacher', 'student'), '/student');
    expect(roleRedirect('/teacher/requests', 'student'), '/student');
    expect(roleRedirect('/admin', 'student'), '/student');
    expect(roleRedirect('/student/exams/9', 'student'), isNull);
    expect(roleRedirect('/courses/maths-10', 'student'), isNull);
    expect(roleRedirect('/student', 'teacher'), '/teacher');
    expect(roleRedirect('/login', 'student'), '/student');
  });
}
