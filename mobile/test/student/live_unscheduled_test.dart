import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lms_app/core/theme/app_theme.dart';
import 'package:lms_app/data/models/student_models.dart';
import 'package:lms_app/l10n/gen/app_localizations.dart';
import 'package:lms_app/presentation/providers/student_providers.dart';
import 'package:lms_app/screens/student/course_player_screen.dart';
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

const _unscheduled = {'liveClassId': null, 'startsAt': null, 'durationMin': null, 'stage': 'unscheduled'};

void main() {
  test('a live lesson with no date for my batch parses without a start time', () {
    final l = Lesson.fromJson({'id': 5, 'title': 'Algebra', 'type': 'live', 'live': _unscheduled});
    expect(l.live!.stage, 'unscheduled');
    expect(l.live!.startsAt, isNull);
    expect(LessonDetail.fromJson({'id': 5, 'courseId': 3, 'title': 'Algebra', 'type': 'live', 'canComplete': false, 'live': _unscheduled}).live!.startsAt, isNull);
  });

  testWidgets('the lesson row says Not scheduled yet', (tester) async {
    final lesson = Lesson(id: 1, title: 'Algebra', type: 'live', live: LessonLive.fromJson(_unscheduled));
    await tester.pumpWidget(app(Scaffold(body: LessonRow(lesson: lesson, onTap: () {}))));
    expect(find.textContaining('Not scheduled yet'), findsOneWidget);
  });

  testWidgets('the player says Schedule coming soon, with no start time and no Join', (tester) async {
    final repo = FakeStudentRepo();
    final live = LessonLive.fromJson(_unscheduled);
    repo.courseView = CourseView(courseId: 3, title: 'Maths', progressPct: 0, subjects: [
      CourseSubject(id: 1, name: 'Algebra', modules: [
        CourseModule(id: 1, name: 'Basics', lessons: [Lesson(id: 7, title: 'Algebra', type: 'live', live: live)]),
      ]),
    ]);
    repo.lessons[7] = LessonDetail(id: 7, courseId: 3, title: 'Algebra', type: 'live', canComplete: false, live: live);
    await tester.pumpWidget(app(const CoursePlayerScreen(courseId: 3), overrides: [
      studentRepositoryProvider.overrideWithValue(repo),
      downloadsProvider.overrideWith((ref) => throw UnimplementedError('not used')),
    ]));
    await tester.pumpAndSettle();
    expect(find.text('Schedule coming soon'), findsOneWidget);
    expect(find.textContaining('Starts'), findsNothing);
    expect(find.text('Join class'), findsNothing);
  });
}
