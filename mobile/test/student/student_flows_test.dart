import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lms_app/core/offline/license_guard.dart';
import 'package:lms_app/core/offline/offline_ports.dart';
import 'package:lms_app/core/offline/offline_sync.dart';
import 'package:lms_app/core/session/session.dart';
import 'package:lms_app/core/storage/token_storage.dart';
import 'package:lms_app/core/theme/app_theme.dart';
import 'package:lms_app/data/models/student_models.dart';
import 'package:lms_app/data/repositories/auth_repository.dart';
import 'package:lms_app/l10n/gen/app_localizations.dart';
import 'package:lms_app/main.dart';
import 'package:lms_app/presentation/providers/core_providers.dart';
import 'package:lms_app/presentation/providers/student_providers.dart';
import 'package:lms_app/screens/public/catalog_screen.dart';
import 'package:lms_app/screens/public/demo_request_screen.dart';
import 'package:lms_app/screens/student/course_player_screen.dart';
import 'package:lms_app/screens/student/offline_player_screen.dart';
import 'package:lms_app/screens/student/result_screen.dart';
import 'package:lms_app/screens/student/student_exams_screen.dart';
import 'package:lms_app/widgets/app_widgets.dart';

import '../offline/offline_fakes.dart';
import 'fake_student_repo.dart';

Finder field(String label) => find.descendant(of: find.widgetWithText(AppTextField, label), matching: find.byType(TextField));

Widget app(Widget home, {List<Override> overrides = const []}) => ProviderScope(
      overrides: overrides,
      child: MaterialApp(theme: AppTheme.light(), localizationsDelegates: AppLocalizations.localizationsDelegates, supportedLocales: AppLocalizations.supportedLocales, home: home),
    );

class _Tokens implements TokenStore {
  @override
  Future<void> clear() async {}
  @override
  Future<String?> readRefresh() async => null;
  @override
  Future<void> save({required String accessToken, String? refreshToken}) async {}
}

class _FlowAuth implements AuthRepository {
  _FlowAuth(this.session);
  final SessionController session;
  final otps = <String>[];
  Map<String, dynamic>? registered;
  String? loggedOutDevice;

  @override
  Future<SessionUser?> restore() async {
    session.finishRestore();
    return null;
  }

  @override
  Future<int> sendOtp(String mobile, String purpose) async {
    otps.add('$mobile|$purpose');
    return 30;
  }

  @override
  Future<SessionUser> registerStudent(Map<String, dynamic> fields) async {
    registered = fields;
    const u = SessionUser(publicId: 'p1', name: 'Meera', mobile: '+919876543210', role: 'student');
    session.setAccessToken('t');
    session.setUser(u);
    return u;
  }

  @override
  Future<SessionUser> login(String mobile, String otp) => throw UnimplementedError();

  @override
  Future<void> logout({String? deviceId}) async {
    loggedOutDevice = deviceId;
    await session.end();
  }
}

void main() {
  group('licence renewal (OfflineSync)', () {
    test('runs on app start and again every time connectivity is restored; reports removed videos', () async {
      final net = FakeNetwork(online: true);
      var renews = 0;
      var syncs = 0;
      final removedSeen = <List<({String title, String reason})>>[];
      final sync = OfflineSync(
        network: net,
        renew: () async {
          renews++;
          return renews == 2 ? [(title: 'Fractions', reason: 'subscription_ended')] : const [];
        },
        syncProgress: () async => syncs++,
        onRemoved: removedSeen.add,
      );
      await sync.start();
      expect((renews, syncs), (1, 1));

      net.set(online: false);
      await pumpEventQueue();
      expect(renews, 1, reason: 'nothing to do while offline');

      net.set(online: true);
      await pumpEventQueue(times: 50);
      expect((renews, syncs), (2, 2));
      expect(removedSeen.single.single.reason, 'subscription_ended');
      await sync.dispose();
    });

    test('a failed renewal does not crash and is retried on the next online event', () async {
      final net = FakeNetwork();
      var calls = 0;
      final sync = OfflineSync(network: net, renew: () async {
        calls++;
        if (calls == 1) throw offline;
        return const [];
      }, syncProgress: () async => 0, onRemoved: (_) {});
      await sync.start();
      net.set(online: true);
      await pumpEventQueue(times: 50);
      expect(calls, 2);
      await sync.dispose();
    });
  });

  testWidgets('exam list: locked final shows the unlock rule, Start and Resume buttons, result link', (tester) async {
    final repo = FakeStudentRepo()
      ..examCards = const [
        ExamCard(id: 1, title: 'Unit Test 1', category: 'unit_test_1', mode: 'mock', timeLimitMin: 20, attemptsLeft: 2, lastAttemptId: 'a-9', bestPct: 80),
        ExamCard(id: 2, title: 'Unit Test 2', category: 'unit_test_2', mode: 'mock', openAttemptId: 'a-3', attemptsLeft: 1),
        ExamCard(id: 3, title: 'Final', category: 'final', mode: 'mock', locked: true),
        ExamCard(id: 4, title: 'Unit Test 3', category: 'practice', mode: 'mock', attemptsLeft: 0),
      ];
    await tester.pumpWidget(app(const StudentExamsScreen(), overrides: [studentRepositoryProvider.overrideWithValue(repo)]));
    await tester.pumpAndSettle();
    expect(find.text('Finish all Unit Tests to unlock the Final Exam.'), findsOneWidget);
    expect(find.text('Start'), findsOneWidget);
    expect(find.text('Resume'), findsOneWidget);
    expect(find.text('No attempts left'), findsOneWidget);
    expect(find.text('Best: 80%'), findsOneWidget);
    expect(find.text('View result'), findsOneWidget);
  });

  testWidgets('result screen: score, rank, pass and answer review', (tester) async {
    final repo = FakeStudentRepo()
      ..attemptResult = const AttemptResult(title: 'Unit Test 1', score: 3, max: 4, pct: 75, passed: true, rank: 2, of: 10, autoSubmitted: true, review: [
        ReviewItem(text: '2 + 2 = ?', correct: false, marks: 0, yourAnswer: '3', correctAnswer: '4', explanation: 'Add them'),
      ]);
    await tester.pumpWidget(app(const ResultScreen(attemptId: 'a-1'), overrides: [studentRepositoryProvider.overrideWithValue(repo)]));
    await tester.pumpAndSettle();
    expect(find.text('3 / 4 (75%)'), findsOneWidget);
    expect(find.text('Rank 2 of 10'), findsOneWidget);
    expect(find.textContaining('Passed'), findsOneWidget);
    expect(find.text('Submitted automatically when time ran out'), findsOneWidget);
    expect(find.textContaining('Correct answer: 4'), findsOneWidget);
    expect(find.text('Add them'), findsOneWidget);
  });

  testWidgets('course player: notes lesson opens, Mark as complete saves progress and refreshes the bar', (tester) async {
    var done = false;
    final repo = FakeStudentRepo();
    CourseView view() => CourseView(courseId: 3, title: 'Maths', progressPct: done ? 100 : 0, subjects: [
          CourseSubject(id: 1, name: 'Algebra', modules: [
            CourseModule(id: 1, name: 'Basics', lessons: [Lesson(id: 7, title: 'Notes', type: 'pdf', completed: done)]),
          ]),
        ]);
    repo.courseView = view();
    repo.lessons[7] = const LessonDetail(id: 7, courseId: 3, title: 'Notes', type: 'pdf', url: 'https://x/notes.pdf?sig=1');
    await tester.pumpWidget(app(const CoursePlayerScreen(courseId: 3), overrides: [
      studentRepositoryProvider.overrideWithValue(repo),
      downloadsProvider.overrideWith((ref) => throw UnimplementedError('not used for pdf')),
    ]));
    await tester.pumpAndSettle();
    expect(find.text('0%'), findsOneWidget);
    expect(find.text('Open notes'), findsOneWidget);
    done = true;
    repo.courseView = view();
    await tester.tap(find.text('Mark as complete'));
    await tester.pumpAndSettle();
    expect(repo.progressCalls.single, {'contentId': 7, 'completed': true});
    expect(find.text('100%'), findsOneWidget);
  });

  testWidgets('offline player: an expired licence asks to go online and never starts playback', (tester) async {
    final dir = Directory.systemTemp.createTempSync('op');
    addTearDown(() => dir.deleteSync(recursive: true));
    final dao = MemoryDownloadDao();
    final vault = MemoryKeyVault()..keys['k'] = 'AAAA';
    final file = File('${dir.path}/x.bin')..writeAsBytesSync([1, 2, 3]);
    await dao.upsert(DownloadRecord(contentId: 5, courseId: 3, courseTitle: 'Maths', title: 'Fractions', sizeBytes: 3, filePath: file.path, keyId: 'k', licenseExpiresAt: DateTime.utc(2020)));
    await tester.pumpWidget(app(const OfflinePlayerScreen(contentId: 5), overrides: [licenseGuardProvider.overrideWithValue(LicenseGuard(dao: dao, vault: vault))]));
    await tester.pumpAndSettle();
    expect(find.text('Connect to the internet to keep watching offline'), findsOneWidget);
  });

  testWidgets('catalog search sends the query and shows matching courses', (tester) async {
    final pub = FakePublicRepo();
    await tester.pumpWidget(app(const CatalogScreen(), overrides: [publicRepositoryProvider.overrideWithValue(pub)]));
    await tester.pumpAndSettle();
    expect(find.text('Maths 10th'), findsOneWidget);
    expect(find.text('Science 10th'), findsOneWidget);
    await tester.enterText(find.byType(TextField), 'sci');
    await tester.testTextInput.receiveAction(TextInputAction.search);
    await tester.pumpAndSettle();
    expect(pub.queries.last, 'sci');
    expect(find.text('Maths 10th'), findsNothing);
    expect(find.text('Science 10th'), findsOneWidget);
  });

  testWidgets('demo request needs consent, verifies OTP and sends the form', (tester) async {
    tester.view.physicalSize = const Size(800, 2400);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final pub = FakePublicRepo();
    await tester.pumpWidget(app(const DemoRequestScreen(slug: 'maths-10'), overrides: [publicRepositoryProvider.overrideWithValue(pub)]));
    await tester.pumpAndSettle();
    await tester.enterText(field('Name *'), 'Asha');
    await tester.enterText(field('Mobile number *'), '9876543210');
    await tester.enterText(field('Education *'), '10th');
    await tester.ensureVisible(find.text('Continue'));
    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();
    expect(find.text('Accept the Terms and Privacy Policy to continue', skipOffstage: false), findsOneWidget);
    expect(pub.otpSent, isEmpty);
    await tester.ensureVisible(find.text('I accept the Terms and Privacy Policy'));
    await tester.tap(find.text('I accept the Terms and Privacy Policy'));
    await tester.ensureVisible(find.text('Continue'));
    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();
    expect(pub.otpSent, ['+919876543210|demo_request']);
    await tester.enterText(find.byType(TextField).first, '123456');
    await tester.pumpAndSettle();
    await tester.tap(find.text('Request a live demo'));
    await tester.pumpAndSettle();
    expect(pub.demoBodies.single, containsPair('otp', '123456'));
    expect(pub.demoBodies.single, containsPair('courseSlug', 'maths-10'));
    expect(pub.demoBodies.single, containsPair('acceptTerms', true));
    expect(find.text('Request sent. The teacher will message you with the demo time.'), findsOneWidget);
  });

  testWidgets('end-to-end in app: browse → course → Enroll → register with OTP → enrollment sent → student home → logout wipes downloads', (tester) async {
    tester.view.physicalSize = const Size(800, 2400);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final pub = FakePublicRepo();
    final repo = FakeStudentRepo();
    late _FlowAuth auth;
    var wiped = 0;
    await tester.pumpWidget(ProviderScope(
      overrides: [
        tokenStoreProvider.overrideWithValue(_Tokens()),
        authRepositoryProvider.overrideWith((ref) => auth = _FlowAuth(ref.read(sessionProvider.notifier))),
        publicRepositoryProvider.overrideWithValue(pub),
        studentRepositoryProvider.overrideWithValue(repo),
        offlineSyncProvider.overrideWith((ref) => OfflineSync(network: FakeNetwork(), renew: () async => const [], syncProgress: () async => 0, onRemoved: (_) {})),
        offlineWipeProvider.overrideWithValue(() async => wiped++),
        deviceIdProvider.overrideWithValue(() async => 'dev-123456'),
      ],
      child: const LmsApp(),
    ));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Browse courses'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Maths 10th'));
    await tester.pumpAndSettle();
    expect(find.text('Full board syllabus'), findsOneWidget);
    await tester.ensureVisible(find.text('Enroll now'));
    await tester.tap(find.text('Enroll now'));
    await tester.pumpAndSettle();

    expect(find.text('Create your student account'), findsOneWidget);
    await tester.enterText(field('Name *'), 'Meera');
    await tester.enterText(field('Mobile number *'), '9876543210');
    await tester.enterText(field('Education *'), '10th');
    await tester.ensureVisible(find.text('I accept the Terms and Privacy Policy'));
    await tester.tap(find.text('I accept the Terms and Privacy Policy'));
    await tester.ensureVisible(find.text('Continue'));
    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();
    expect(auth.otps, ['+919876543210|student_register']);
    await tester.enterText(find.byType(TextField).first, '654321');
    await tester.pumpAndSettle();
    await tester.tap(find.text('Create account'));
    await tester.pumpAndSettle();

    expect(auth.registered, containsPair('otp', '654321'));
    expect(auth.registered, containsPair('acceptTerms', true));
    expect(repo.enrollRequests, ['maths-10']);
    expect(find.text('Next up'), findsOneWidget, reason: 'lands on the student dashboard');

    await tester.tap(find.text('More'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Log out'));
    await tester.pumpAndSettle();
    expect(wiped, 1);
    expect(auth.loggedOutDevice, 'dev-123456');
    expect(find.text('Send OTP'), findsOneWidget);
  });
}

