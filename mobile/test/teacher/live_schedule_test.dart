import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lms_app/core/network/api_client.dart';
import 'package:lms_app/core/theme/app_theme.dart';
import 'package:lms_app/data/models/teacher_models.dart';
import 'package:lms_app/data/repositories/teacher_repository.dart';
import 'package:lms_app/l10n/gen/app_localizations.dart';
import 'package:lms_app/presentation/providers/teacher_providers.dart';
import 'package:lms_app/screens/teacher/live_schedule_screen.dart';

class FakeScheduleRepo extends Fake implements TeacherRepository {
  Map<String, DateTime>? saved;
  bool fail = false;

  @override
  Future<List<LiveScheduleRow>> liveSchedule(int courseId, int batchId) async => [
        const LiveScheduleRow(slotId: 's1', title: 'Algebra', moduleName: 'Linear'),
        const LiveScheduleRow(slotId: 's2', title: 'Geometry', moduleName: 'Linear'),
        LiveScheduleRow(slotId: 's3', title: 'Revision', moduleName: 'Exam', startsAt: DateTime.utc(2099, 7, 3, 12, 30), stage: 'upcoming'),
      ];

  @override
  Future<void> saveLiveSchedule(int courseId, int batchId, Map<String, DateTime> dates) async {
    if (fail) throw ApiException(409, 'This batch already has a session of Algebra');
    saved = dates;
  }
}

Widget app(Widget home, FakeScheduleRepo repo) => ProviderScope(
      overrides: [teacherRepositoryProvider.overrideWithValue(repo)],
      child: MaterialApp(
        theme: AppTheme.light(),
        locale: const Locale('en'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: home,
      ),
    );

void main() {
  test('LiveScheduleRow parses a lesson with and without a session', () {
    final empty = LiveScheduleRow.fromJson({'slotId': 's1', 'title': 'Algebra', 'module': {'id': 1, 'name': 'Linear'}, 'session': null});
    expect(empty.startsAt, isNull);
    final done = LiveScheduleRow.fromJson({'slotId': 's2', 'title': 'Geometry', 'module': {'id': 1, 'name': 'Linear'}, 'session': {'startsAt': '2099-07-03T12:30:00.000Z', 'stage': 'upcoming'}});
    expect(done.startsAt, DateTime.utc(2099, 7, 3, 12, 30));
    expect(done.stage, 'upcoming');
  });

  final picked = DateTime(2099, 7, 1, 18);
  Widget screen(FakeScheduleRepo repo) => app(LiveScheduleScreen(courseId: 7, batchId: 4, batchName: '2027 - Batch A', pickDateTime: (_) async => picked), repo);

  testWidgets('lists every live lesson; scheduled ones show their stage', (tester) async {
    await tester.pumpWidget(screen(FakeScheduleRepo()));
    await tester.pumpAndSettle();
    expect(find.text('Algebra'), findsOneWidget);
    expect(find.text('Geometry'), findsOneWidget);
    expect(find.text('Revision'), findsOneWidget);
    expect(find.text('Set date'), findsNWidgets(2));
    expect(find.textContaining('Upcoming'), findsOneWidget);
  });

  testWidgets('saves only the lessons given a date', (tester) async {
    final repo = FakeScheduleRepo();
    await tester.pumpWidget(screen(repo));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Set date').first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Save schedule'));
    await tester.pumpAndSettle();
    expect(repo.saved, {'s1': picked});
  });

  testWidgets('nothing filled asks for a date and saves nothing', (tester) async {
    final repo = FakeScheduleRepo();
    await tester.pumpWidget(screen(repo));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Save schedule'));
    await tester.pumpAndSettle();
    expect(find.text('Fill a date for at least one lesson'), findsOneWidget);
    expect(repo.saved, isNull);
  });

  testWidgets('a server error is shown', (tester) async {
    final repo = FakeScheduleRepo()..fail = true;
    await tester.pumpWidget(screen(repo));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Set date').first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Save schedule'));
    await tester.pumpAndSettle();
    expect(find.textContaining('already has a session'), findsOneWidget);
  });
}
