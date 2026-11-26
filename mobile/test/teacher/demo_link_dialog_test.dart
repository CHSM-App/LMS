import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lms_app/core/network/api_client.dart';
import 'package:lms_app/core/theme/app_theme.dart';
import 'package:lms_app/data/repositories/teacher_repository.dart';
import 'package:lms_app/l10n/gen/app_localizations.dart';
import 'package:lms_app/presentation/providers/teacher_providers.dart';
import 'package:lms_app/screens/teacher/demo_link_dialog.dart';

class FakeLinkRepo extends Fake implements TeacherRepository {
  bool fails = false;
  Map<String, Object?>? asked;

  @override
  Future<String> generateMeetLink({required String topic, required DateTime startsAt, required int durationMin}) async {
    asked = {'topic': topic, 'durationMin': durationMin};
    if (fails) throw const ApiException(409, 'Automatic Meet links are not set up. Paste a link instead.', 'MEET_GENERATE_UNAVAILABLE');
    return 'https://meet.google.com/xyz-abcd-efg';
  }
}

Widget host(FakeLinkRepo repo, void Function(String?) onResult) => ProviderScope(
      overrides: [teacherRepositoryProvider.overrideWithValue(repo)],
      child: MaterialApp(
        theme: AppTheme.light(),
        locale: const Locale('en'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Builder(
          builder: (context) => Scaffold(
            body: TextButton(
              onPressed: () async => onResult(await askDemoLink(context, topic: 'Demo: Class 10 Maths', startsAt: DateTime(2099, 1, 5, 18))),
              child: const Text('open'),
            ),
          ),
        ),
      ),
    );

void main() {
  testWidgets('Generate link fills the field and Save returns the link', (tester) async {
    final repo = FakeLinkRepo();
    String? result;
    await tester.pumpWidget(host(repo, (v) => result = v));
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
    expect(tester.widget<FilledButton>(find.widgetWithText(FilledButton, 'Save link')).onPressed, isNull);
    await tester.tap(find.text('Generate link'));
    await tester.pumpAndSettle();
    expect(repo.asked, {'topic': 'Demo: Class 10 Maths', 'durationMin': 30});
    expect(find.text('https://meet.google.com/xyz-abcd-efg'), findsOneWidget);
    await tester.tap(find.text('Save link'));
    await tester.pumpAndSettle();
    expect(result, 'https://meet.google.com/xyz-abcd-efg');
  });

  testWidgets('a failure shows why and leaves the field empty', (tester) async {
    final repo = FakeLinkRepo()..fails = true;
    await tester.pumpWidget(host(repo, (_) {}));
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Generate link'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Paste a link instead'), findsOneWidget);
    expect(tester.widget<FilledButton>(find.widgetWithText(FilledButton, 'Save link')).onPressed, isNull);
  });
}
