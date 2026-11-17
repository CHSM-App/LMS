import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lms_app/l10n/gen/app_localizations.dart';
import 'package:lms_app/main.dart';

void main() {
  testWidgets('app starts and shows the tagline', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: LmsApp()));
    await tester.pumpAndSettle();
    expect(find.text('Learn from teachers you trust'), findsOneWidget);
  });

  test('supports en, mr and hi', () {
    final codes = AppLocalizations.supportedLocales.map((l) => l.languageCode).toSet();
    expect(codes, containsAll(['en', 'mr', 'hi']));
  });
}
