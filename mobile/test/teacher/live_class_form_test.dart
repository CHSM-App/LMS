import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lms_app/core/network/api_client.dart';
import 'package:lms_app/core/theme/app_theme.dart';
import 'package:lms_app/data/models/teacher_models.dart';
import 'package:lms_app/data/repositories/teacher_repository.dart';
import 'package:lms_app/l10n/gen/app_localizations.dart';
import 'package:lms_app/presentation/providers/teacher_providers.dart';
import 'package:lms_app/screens/teacher/live_class_form_screen.dart';

class FakeFormRepo extends Fake implements TeacherRepository {
  Map<String, Object?>? saved;
  Map<String, Object?>? generated;
  bool generateFails = false;

  @override
  Future<String> generateMeetLink({required String topic, required DateTime startsAt, required int durationMin}) async {
    generated = {'topic': topic, 'durationMin': durationMin};
    if (generateFails) throw const ApiException(409, 'Automatic Meet links are not set up. Paste a link instead.', 'MEET_GENERATE_UNAVAILABLE');
    return 'https://meet.google.com/xyz-abcd-efg';
  }

  @override
  Future<List<TeacherCourseRef>> courses() async => [const TeacherCourseRef(id: 7, title: 'Class 10 Maths')];

  @override
  Future<List<Batch>> batches(int courseId) async => [const Batch(id: 3, name: 'Morning', status: 'open', studentCount: 4)];

  @override
  Future<void> saveLiveClass({int? id, required int courseId, int? batchId, required String topic, required DateTime startsAt, required int durationMin, String? meetLink, String status = 'scheduled'}) async {
    saved = {'id': id, 'courseId': courseId, 'batchId': batchId, 'topic': topic, 'durationMin': durationMin};
  }
}

Widget host(FakeFormRepo repo, {LiveClass? item}) => ProviderScope(
      overrides: [teacherRepositoryProvider.overrideWithValue(repo)],
      child: MaterialApp(
        theme: AppTheme.light(),
        locale: const Locale('en'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: LiveClassFormScreen(item: item, pickDateTime: (_) async => DateTime(2099, 1, 5, 18)),
      ),
    );

void main() {
  testWidgets('saving an empty form shows the required messages and sends nothing', (tester) async {
    await tester.binding.setSurfaceSize(const Size(400, 1400));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final repo = FakeFormRepo();
    await tester.pumpWidget(host(repo));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Save class'));
    await tester.pumpAndSettle();
    expect(find.text('This field is required'), findsWidgets);
    expect(repo.saved, isNull);
  });

  testWidgets('editing a class sends its id, course, batch and the changed topic', (tester) async {
    await tester.binding.setSurfaceSize(const Size(400, 1400));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final repo = FakeFormRepo();
    final item = LiveClass(id: 11, topic: 'Algebra', courseTitle: 'Class 10 Maths', startsAt: DateTime.utc(2099, 1, 5, 12), status: 'scheduled', courseId: 7, batchId: 3, batchName: 'Morning');
    await tester.pumpWidget(host(repo, item: item));
    await tester.pumpAndSettle();
    await tester.enterText(find.widgetWithText(TextField, 'Algebra'), 'Geometry');
    await tester.tap(find.text('Save class'));
    await tester.pumpAndSettle();
    expect(repo.saved, {'id': 11, 'courseId': 7, 'batchId': 3, 'topic': 'Geometry', 'durationMin': 60});
  });

  testWidgets('Generate link is off until the topic and the date are filled, then it fills the Meet link field', (tester) async {
    await tester.binding.setSurfaceSize(const Size(400, 1400));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final repo = FakeFormRepo();
    await tester.pumpWidget(host(repo));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Generate link'));
    await tester.pumpAndSettle();
    expect(repo.generated, isNull);
    await tester.enterText(find.byType(TextField).first, 'Algebra');
    await tester.tap(find.text('Pick date and time'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Generate link'));
    await tester.pumpAndSettle();
    expect(repo.generated, {'topic': 'Algebra', 'durationMin': 60});
    expect(find.text('https://meet.google.com/xyz-abcd-efg'), findsOneWidget);
  });

  testWidgets('when the link cannot be generated the reason is shown and the field stays empty', (tester) async {
    await tester.binding.setSurfaceSize(const Size(400, 1400));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final repo = FakeFormRepo()..generateFails = true;
    await tester.pumpWidget(host(repo));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).first, 'Algebra');
    await tester.tap(find.text('Pick date and time'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Generate link'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Paste a link instead'), findsOneWidget);
    expect(find.text('https://meet.google.com/xyz-abcd-efg'), findsNothing);
  });
}
