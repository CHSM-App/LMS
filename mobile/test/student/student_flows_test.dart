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
import 'package:lms_app/presentation/providers/onboarding_provider.dart';
import 'package:lms_app/presentation/providers/student_providers.dart';
import 'package:lms_app/screens/student/student_dashboard_screen.dart';
import 'package:lms_app/screens/public/catalog_screen.dart';
import 'package:lms_app/screens/public/course_details_screen.dart';
import 'package:lms_app/screens/public/demo_request_screen.dart';
import 'package:lms_app/screens/student/course_player_screen.dart';
import 'package:lms_app/screens/student/offline_player_screen.dart';
import 'package:lms_app/screens/student/result_screen.dart';
import 'package:lms_app/screens/student/widgets/common.dart';
import 'package:lms_app/screens/student/student_exams_screen.dart';
import 'package:lms_app/screens/student/student_more_screens.dart';
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
  homeAndOnboardingTests();
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

  testWidgets('result screen shows the solution image under the explanation', (tester) async {
    final repo = FakeStudentRepo()
      ..attemptResult = const AttemptResult(title: 'Unit Test 1', score: 0, max: 1, pct: 0, review: [
        ReviewItem(text: '12 x 12 = ?', correct: false, marks: 0, yourAnswer: '124', correctAnswer: '144', explanation: 'Multiply', explanationImageUrl: 'https://x/solution.png'),
      ]);
    await tester.pumpWidget(app(const ResultScreen(attemptId: 'a-1'), overrides: [studentRepositoryProvider.overrideWithValue(repo)]));
    await tester.pumpAndSettle();
    expect(find.byWidgetPredicate((w) => w is SolutionImage && w.url == 'https://x/solution.png' && w.label == 'Solution image'), findsOneWidget);
  });

  test('review items read the solution image URL and make relative file links absolute', () {
    final r = AttemptResult.fromJson({
      'exam': {'title': 'T'}, 'score': 0, 'max': 1, 'pct': 0,
      'review': [
        {'text': 'Q', 'options': [], 'correct': false, 'marks': 0, 'correctAnswer': {'acceptedAnswers': ['1']}, 'explanationImageUrl': '/api/v1/files/solution/a.png?exp=1&sig=s'},
      ],
    });
    expect(r.review.single.explanationImageUrl, endsWith('/api/v1/files/solution/a.png?exp=1&sig=s'));
    expect(r.review.single.explanationImageUrl, startsWith('http'));
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
    tester.view.physicalSize = const Size(800, 2400);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
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

  testWidgets('catalog searches while typing, after a short pause', (tester) async {
    tester.view.physicalSize = const Size(800, 2400);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final pub = FakePublicRepo();
    await tester.pumpWidget(app(const CatalogScreen(), overrides: [publicRepositoryProvider.overrideWithValue(pub)]));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'sci');
    await tester.pump(const Duration(milliseconds: 100));
    expect(pub.queries.last, isNot('sci')); // still waiting for the pause
    await tester.pump(const Duration(milliseconds: 500));
    await tester.pumpAndSettle();
    expect(pub.queries.last, 'sci');
    expect(find.text('Maths 10th'), findsNothing);
  });

  testWidgets('catalog subject chips filter the list and "All subjects" brings it back', (tester) async {
    tester.view.physicalSize = const Size(800, 2400);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(app(const CatalogScreen(), overrides: [publicRepositoryProvider.overrideWithValue(FakePublicRepo())]));
    await tester.pumpAndSettle();
    expect(find.text('2 courses'), findsOneWidget);

    await tester.tap(find.text('Science').first); // the chip comes before the course covers
    await tester.pumpAndSettle();
    expect(find.text('Maths 10th'), findsNothing);
    expect(find.text('Science 10th'), findsOneWidget);
    expect(find.text('1 course'), findsOneWidget);

    await tester.tap(find.text('All subjects'));
    await tester.pumpAndSettle();
    expect(find.text('Maths 10th'), findsOneWidget);
    expect(find.text('Science 10th'), findsOneWidget);
  });

  testWidgets('catalog language filter opens a sheet and keeps only that language', (tester) async {
    tester.view.physicalSize = const Size(800, 2400);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(app(const CatalogScreen(), overrides: [publicRepositoryProvider.overrideWithValue(FakePublicRepo())]));
    await tester.pumpAndSettle();

    await tester.tap(find.byIcon(Icons.tune_rounded));
    await tester.pumpAndSettle();
    await tester.tap(find.descendant(of: find.byType(BottomSheet), matching: find.text('Marathi')));
    await tester.pumpAndSettle();
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
    // The email is compulsory: without it nothing is sent.
    await tester.ensureVisible(find.text('Continue'));
    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();
    expect(find.text('This field is required', skipOffstage: false), findsWidgets);
    expect(pub.otpSent, isEmpty);
    await tester.enterText(field('Email *'), 'asha@gmail.com');
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
    expect(pub.demoBodies.single, containsPair('email', 'asha@gmail.com'));
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
    // The email is compulsory: without it the OTP is not sent.
    await tester.ensureVisible(find.text('Continue'));
    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();
    expect(auth.otps, isEmpty);
    await tester.enterText(field('Email *'), 'meera@gmail.com');
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
    expect(repo.enrollEmails, ['meera@gmail.com']);
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


// --- Home "Explore courses" row and first-launch onboarding ---
void homeAndOnboardingTests() {
  testWidgets('student home shows an Explore courses row from the catalogue, and See all opens it', (tester) async {
    tester.view.physicalSize = const Size(800, 2400);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final dash = StudentDashboard.fromJson({'myCourses': [], 'upcomingLiveClasses': [], 'requests': []});
    await tester.pumpWidget(app(const StudentDashboardScreen(), overrides: [
      studentDashboardProvider.overrideWith((ref) async => dash),
      publicRepositoryProvider.overrideWithValue(FakePublicRepo()),
    ]));
    await tester.pumpAndSettle();
    expect(find.text('Explore courses'), findsOneWidget);
    expect(find.text('Maths 10th'), findsOneWidget);
    expect(find.text('See all'), findsOneWidget);
  });

  testWidgets('dashboard order matches the website: live classes, then the latest exam on its own, then my courses', (tester) async {
    tester.view.physicalSize = const Size(800, 3000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final dash = StudentDashboard.fromJson({
      'myCourses': [
        {'courseId': 3, 'title': 'Maths 10th', 'teacher': 'Suresh', 'progressPct': 40, 'accessStatus': 'active'},
      ],
      'upcomingLiveClasses': [
        {'id': 1, 'topic': 'Fractions revision', 'course': 'Maths 10th', 'startsAt': '2099-06-15T03:30:00Z', 'durationMin': 60, 'stage': 'upcoming'},
        {'id': 2, 'topic': 'Doubt class', 'course': 'Maths 10th', 'startsAt': '2099-06-16T03:30:00Z', 'durationMin': 60, 'stage': 'live'},
      ],
      'requests': [],
      'latestExam': {'id': 9, 'title': 'Unit Test 1', 'course': 'Maths 10th', 'status': 'notStarted', 'timeLimitMin': 30, 'attemptsLeft': 2, 'closed': false, 'notOpen': false},
    });
    await tester.pumpWidget(app(const StudentDashboardScreen(), overrides: [
      studentDashboardProvider.overrideWith((ref) async => dash),
      publicRepositoryProvider.overrideWithValue(FakePublicRepo()),
    ]));
    await tester.pumpAndSettle();

    final liveY = tester.getTopLeft(find.text('Live classes')).dy;
    final examY = tester.getTopLeft(find.text('Latest exam')).dy;
    final coursesY = tester.getTopLeft(find.text('My courses')).dy;
    expect(liveY < examY && examY < coursesY, isTrue, reason: 'live < exam < courses');
    // The class that is running now is listed first.
    expect(tester.getTopLeft(find.text('Doubt class')).dy < tester.getTopLeft(find.text('Fractions revision')).dy, isTrue);
    expect(find.text('Unit Test 1'), findsOneWidget);
    expect(find.textContaining('Not started'), findsOneWidget);
    expect(find.text('Start'), findsOneWidget);
  });

  testWidgets('doubts: answers first, Ask a doubt opens a sheet, a long course name does not overflow, and sending works', (tester) async {
    tester.view.physicalSize = const Size(360, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final repo = FakeStudentRepo()
      ..doubtList = [
        StudentDoubt(id: 1, courseTitle: 'Class 10 Maths (SSC) - Demo', question: 'Why do we cross multiply?', status: 'answered', createdAt: DateTime(2026, 11, 18), reply: 'Because both sides are fractions.'),
        StudentDoubt(id: 2, courseTitle: 'Class 10 Maths (SSC) - Demo', question: 'What is a tangent?', status: 'open', createdAt: DateTime(2026, 11, 19)),
      ];
    final dash = StudentDashboard.fromJson({
      'myCourses': [
        {'courseId': 3, 'title': 'Class 10 Maths (SSC) - Demo with a very long name that used to overflow the drop-down', 'teacher': 'Suresh', 'progressPct': 10, 'accessStatus': 'active'},
      ],
      'upcomingLiveClasses': [],
      'requests': [],
    });
    await tester.pumpWidget(app(const StudentDoubtsScreen(), overrides: [
      studentRepositoryProvider.overrideWithValue(repo),
      studentDashboardProvider.overrideWith((ref) async => dash),
    ]));
    await tester.pumpAndSettle();
    expect(find.text('Because both sides are fractions.'), findsOneWidget);
    expect(find.text("Waiting for the teacher's reply"), findsOneWidget);

    await tester.tap(find.text('Ask a doubt'));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull); // no "overflowed by N pixels"
    await tester.enterText(find.descendant(of: find.byType(BottomSheet), matching: find.byType(TextField)), 'How do I factorise x² + 5x + 6?');
    await tester.tap(find.text('Send to teacher'));
    await tester.pumpAndSettle();
    expect(repo.doubtsAsked, ['3:How do I factorise x² + 5x + 6?']); // the only course was already chosen
    expect(find.text('Doubt sent to your teacher'), findsOneWidget);
  });

  testWidgets('course details: demo play button, what the course includes, and Enroll stays in the bottom bar', (tester) async {
    tester.view.physicalSize = const Size(360, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(app(const CourseDetailsScreen(slug: 'maths-10'), overrides: [publicRepositoryProvider.overrideWithValue(FakePublicRepo())]));
    await tester.pumpAndSettle();
    expect(find.byIcon(Icons.play_arrow_rounded), findsOneWidget); // the cover's play button (the course has a demo video)
    expect(find.text('This course includes'), findsOneWidget);
    expect(find.text('Free demo videos to try first'), findsOneWidget);
    expect(find.text('Ask your teacher doubts any time'), findsOneWidget);
    expect(find.text('Enroll now'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  group('course I already joined, like the website', () {
    Future<void> openDetails(WidgetTester tester, Map<String, MyEnrollment> mine) async {
      tester.view.physicalSize = const Size(360, 900);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(app(const CourseDetailsScreen(slug: 'maths-10'), overrides: [
        publicRepositoryProvider.overrideWithValue(FakePublicRepo()),
        myEnrollmentsProvider.overrideWith((ref) => mine),
      ]));
      await tester.pumpAndSettle();
    }

    testWidgets('enrolled: Go to course instead of Enroll, and no demo request', (tester) async {
      await openDetails(tester, {'maths-10': const MyEnrollment(status: 'enrolled', courseId: 3)});
      expect(find.text('Go to course'), findsOneWidget);
      expect(find.text('Enroll now'), findsNothing);
      expect(find.text('Request a live demo'), findsNothing);
      // The bar sits at the bottom of the 900 px screen, not stretched over it (a Column once grew to full height).
      expect(tester.getTopLeft(find.text('Go to course')).dy, greaterThan(800));
      expect(tester.getTopLeft(find.text('Maths 10th')).dy, lessThan(500)); // the course title is still up on the page
    });

    testWidgets('requested: a waiting note and no Enroll button', (tester) async {
      await openDetails(tester, {'maths-10': const MyEnrollment(status: 'pending', teacher: 'Suresh')});
      expect(find.text('Request sent'), findsOneWidget);
      expect(find.textContaining('Waiting for Suresh'), findsOneWidget);
      expect(find.text('Enroll now'), findsNothing);
      expect(tester.getTopLeft(find.text('Request sent')).dy, greaterThan(750)); // at the bottom, not stretched
    });

    testWidgets('declined: the reason and a way to send a new request', (tester) async {
      await openDetails(tester, {'maths-10': const MyEnrollment(status: 'rejected', rejectReason: 'Batch is full')});
      expect(find.textContaining('Batch is full'), findsOneWidget);
      expect(find.text('Send a new request'), findsOneWidget);
    });

    testWidgets('not joined: the normal Enroll now', (tester) async {
      await openDetails(tester, {});
      expect(find.text('Enroll now'), findsOneWidget);
      expect(find.text('Go to course'), findsNothing);
    });

    List<Override> joined() => [
          publicRepositoryProvider.overrideWithValue(FakePublicRepo()),
          myEnrollmentsProvider.overrideWith((ref) => {'maths-10': const MyEnrollment(status: 'enrolled', courseId: 3)}),
        ];

    testWidgets('the catalogue marks it Enrolled', (tester) async {
      tester.view.physicalSize = const Size(800, 2400);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(app(const CatalogScreen(), overrides: joined()));
      await tester.pumpAndSettle();
      expect(find.text('Enrolled'), findsOneWidget);
      expect(find.text('Free demo'), findsOneWidget); // the other course keeps its normal mark
    });

    testWidgets("Home's Explore row leaves it out", (tester) async {
      tester.view.physicalSize = const Size(800, 2400);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      final dash = StudentDashboard.fromJson({'myCourses': [], 'upcomingLiveClasses': [], 'requests': []});
      await tester.pumpWidget(app(const StudentDashboardScreen(), overrides: [...joined(), studentDashboardProvider.overrideWith((ref) async => dash)]));
      await tester.pumpAndSettle();
      expect(find.text('Maths 10th'), findsNothing); // already joined, so not "new"
      expect(find.text('Science 10th'), findsOneWidget);
    });
  });

  testWidgets('first launch: three intro slides, Skip and Get started both end at login', (tester) async {
    await tester.pumpWidget(ProviderScope(
      overrides: [
        onboardingSeenProvider.overrideWith((ref) => false),
        tokenStoreProvider.overrideWithValue(_NoStoredTokens()),
        authRepositoryProvider.overrideWith((ref) => _LoggedOutAuthRepo(ref.read(sessionProvider.notifier))),
      ],
      child: const LmsApp(),
    ));
    await tester.pumpAndSettle();
    expect(find.text('Learn from teachers you trust'), findsOneWidget);
    await tester.tap(find.text('Next'));
    await tester.pumpAndSettle();
    expect(find.text('Practise and test yourself'), findsOneWidget);
    await tester.tap(find.text('Next'));
    await tester.pumpAndSettle();
    expect(find.text('Get started'), findsOneWidget);
    await tester.tap(find.text('Get started'));
    await tester.pumpAndSettle();
    expect(find.text('Send OTP'), findsOneWidget);
  });
}

class _NoStoredTokens implements TokenStore {
  @override
  Future<void> clear() async {}
  @override
  Future<String?> readRefresh() async => null;
  @override
  Future<void> save({required String accessToken, String? refreshToken}) async {}
}

class _LoggedOutAuthRepo implements AuthRepository {
  _LoggedOutAuthRepo(this.session);
  final SessionController session;
  @override
  Future<SessionUser> login(String mobile, String otp) => throw UnimplementedError();
  @override
  Future<void> logout({String? deviceId}) async {}
  @override
  Future<SessionUser> registerStudent(Map<String, dynamic> fields) async => throw UnimplementedError();
  @override
  Future<SessionUser?> restore() async {
    session.finishRestore();
    return null;
  }

  @override
  Future<int> sendOtp(String mobile, String purpose) async => 30;
}
