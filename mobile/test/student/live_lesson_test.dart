import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lms_app/core/theme/app_theme.dart';
import 'package:lms_app/data/models/student_models.dart';
import 'package:lms_app/l10n/gen/app_localizations.dart';
import 'package:lms_app/presentation/providers/student_providers.dart';
import 'package:lms_app/screens/student/course_player_screen.dart';
import 'package:lms_app/screens/student/widgets/common.dart';
import 'package:lms_app/screens/student/widgets/lesson_row.dart';

import 'fake_student_repo.dart';

Widget app(Widget home, {List<Override> overrides = const []}) => ProviderScope(
      overrides: overrides,
      child: MaterialApp(
        theme: AppTheme.light(),
        locale: const Locale('en'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: home,
      ),
    );

const _live = {'startsAt': '2099-06-15T12:30:00.000Z', 'durationMin': 60, 'stage': 'upcoming'};

void main() {
  group('models', () {
    test('Lesson parses live info', () {
      final l = Lesson.fromJson({'id': 5, 'title': 'Live', 'type': 'live', 'live': _live});
      expect(l.live!.stage, 'upcoming');
      expect(l.live!.durationMin, 60);
      expect(l.live!.startsAt, DateTime.utc(2099, 6, 15, 12, 30));
      expect(Lesson.fromJson({'id': 6, 'title': 'Video', 'type': 'video', 'live': null}).live, isNull);
    });

    test('LessonDetail parses the Meet link only when sent', () {
      final d = LessonDetail.fromJson({'id': 5, 'courseId': 3, 'title': 'Live', 'type': 'live', 'live': {..._live, 'stage': 'live', 'meetLink': 'https://meet.google.com/abc-defg-hij'}});
      expect(d.live!.meetLink, 'https://meet.google.com/abc-defg-hij');
      final e = LessonDetail.fromJson({'id': 5, 'courseId': 3, 'title': 'Live', 'type': 'live', 'live': {..._live, 'stage': 'ended'}});
      expect(e.live!.meetLink, isNull);
    });

    test('LiveClassItem has no Meet link and cannot join before the window', () {
      final soon = LiveClassItem.fromJson({'id': 1, 'topic': 'Algebra', 'course': 'Maths', 'startsAt': '2099-06-16T12:30:00.000Z', 'durationMin': 60, 'stage': 'upcoming', 'canJoin': false});
      expect(soon.canJoin, isFalse);
      expect(soon.meetLink, isNull);
      final now = LiveClassItem.fromJson({'id': 2, 'topic': 'Algebra', 'course': 'Maths', 'startsAt': '2026-06-15T12:30:00.000Z', 'durationMin': 60, 'stage': 'live', 'canJoin': true, 'meetLink': 'https://meet.google.com/abc-defg-hij'});
      expect(now.canJoin, isTrue);
      expect(now.meetLink, 'https://meet.google.com/abc-defg-hij');
    });

    test('LessonDetail parses canComplete; missing means true', () {
      expect(LessonDetail.fromJson({'id': 5, 'courseId': 3, 'title': 'Live', 'type': 'live', 'canComplete': false, 'live': _live}).canComplete, isFalse);
      expect(LessonDetail.fromJson({'id': 6, 'courseId': 3, 'title': 'Notes', 'type': 'pdf'}).canComplete, isTrue);
    });
  });

  group('live class tile', () {
    testWidgets('upcoming class shows when Join opens, no Join button', (tester) async {
      await tester.pumpWidget(app(const Scaffold(body: LiveClassTile(topic: 'Algebra', subtitle: 'Maths', meetLink: null))));
      expect(find.text('Join'), findsNothing);
      expect(find.text('Join opens 10 min before'), findsOneWidget);
    });

    testWidgets('class time without a link says the teacher will share it', (tester) async {
      await tester.pumpWidget(app(const Scaffold(body: LiveClassTile(topic: 'Algebra', subtitle: 'Maths', meetLink: null, waitingForLink: true))));
      expect(find.text('Join'), findsNothing);
      expect(find.text('The teacher will share the link soon'), findsOneWidget);
    });

    testWidgets('class in the join window shows Join', (tester) async {
      await tester.pumpWidget(app(const Scaffold(body: LiveClassTile(topic: 'Algebra', subtitle: 'Maths', meetLink: 'https://meet.google.com/abc-defg-hij'))));
      expect(find.text('Join'), findsOneWidget);
    });
  });

  group('lesson row stage chip', () {
    final stages = {'upcoming': 'Upcoming', 'live': 'Live now', 'ended': 'Ended', 'recorded': 'Recorded', 'cancelled': 'Cancelled'};
    for (final e in stages.entries) {
      testWidgets('shows ${e.value}', (tester) async {
        final lesson = Lesson(id: 1, title: 'Live', type: 'live', live: LessonLive(startsAt: DateTime.utc(2099, 6, 15, 12, 30), durationMin: 60, stage: e.key));
        await tester.pumpWidget(app(Scaffold(body: LessonRow(lesson: lesson, onTap: () {}))));
        expect(find.textContaining(e.value), findsOneWidget);
      });
    }

    testWidgets('uploaded recording can be downloaded; YouTube recording cannot', (tester) async {
      final live = LessonLive(startsAt: DateTime.utc(2020), durationMin: 60, stage: 'recorded');
      await tester.pumpWidget(app(Scaffold(body: LessonRow(lesson: Lesson(id: 1, title: 'L', type: 'live', videoSource: 'upload', downloadable: true, live: live), onTap: () {}, onDownload: () {}))));
      expect(find.byTooltip('Download'), findsOneWidget);
      await tester.pumpWidget(app(Scaffold(body: LessonRow(lesson: Lesson(id: 1, title: 'L', type: 'live', videoSource: 'youtube', live: live), onTap: () {}, onDownload: () {}))));
      expect(find.byTooltip('Download'), findsNothing);
    });
  });

  group('player', () {
    Future<void> pumpPlayer(WidgetTester tester, LessonDetail detail) async {
      final repo = FakeStudentRepo();
      repo.courseView = CourseView(courseId: 3, title: 'Maths', progressPct: 0, subjects: [
        CourseSubject(id: 1, name: 'Algebra', modules: [
          CourseModule(id: 1, name: 'Basics', lessons: [Lesson(id: 7, title: 'Live', type: 'live', videoSource: detail.videoSource, live: LessonLive(startsAt: detail.live!.startsAt, durationMin: 60, stage: detail.live!.stage))]),
        ]),
      ]);
      repo.lessons[7] = detail;
      await tester.pumpWidget(app(const CoursePlayerScreen(courseId: 3), overrides: [
        studentRepositoryProvider.overrideWithValue(repo),
        downloadsProvider.overrideWith((ref) => throw UnimplementedError('not used')),
      ]));
      await tester.pumpAndSettle();
    }

    LessonDetail detail(String stage, {String? meetLink, String? videoSource, String? url, bool canComplete = true}) => LessonDetail(
          id: 7, courseId: 3, title: 'Live', type: 'live', videoSource: videoSource, url: url, canComplete: canComplete,
          live: LessonLive(startsAt: DateTime.utc(2099, 6, 15, 12, 30), durationMin: 60, stage: stage, meetLink: meetLink),
        );

    testWidgets('Join button only while live', (tester) async {
      await pumpPlayer(tester, detail('live', meetLink: 'https://meet.google.com/abc-defg-hij'));
      expect(find.text('Join class'), findsOneWidget);
    });

    testWidgets('live without a link: no Join, the teacher will share it', (tester) async {
      await pumpPlayer(tester, detail('live'));
      expect(find.text('Join class'), findsNothing);
      expect(find.text('The teacher will share the link soon'), findsOneWidget);
    });

    testWidgets('no Join button when upcoming', (tester) async {
      await pumpPlayer(tester, detail('upcoming', meetLink: 'https://meet.google.com/abc-defg-hij'));
      expect(find.text('Join class'), findsNothing);
    });

    testWidgets('ended shows Recording coming soon', (tester) async {
      await pumpPlayer(tester, detail('ended'));
      expect(find.text('Recording coming soon'), findsOneWidget);
    });

    testWidgets('no Mark as complete while upcoming or live', (tester) async {
      await pumpPlayer(tester, detail('upcoming', canComplete: false));
      expect(find.text('Mark as complete'), findsNothing);
      await pumpPlayer(tester, detail('live', meetLink: 'https://meet.google.com/abc-defg-hij', canComplete: false));
      expect(find.text('Mark as complete'), findsNothing);
    });

    testWidgets('Mark as complete once the class has ended', (tester) async {
      await pumpPlayer(tester, detail('ended'));
      expect(find.text('Mark as complete'), findsOneWidget);
    });

    testWidgets('YouTube recording opens online, no Join', (tester) async {
      await pumpPlayer(tester, detail('recorded', videoSource: 'youtube', url: 'https://youtu.be/abcdefgh123'));
      expect(find.text('Watch video'), findsOneWidget);
      expect(find.text('Join class'), findsNothing);
    });
  });
}
