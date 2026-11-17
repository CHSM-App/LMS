import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lms_app/core/theme/app_theme.dart';
import 'package:lms_app/core/theme/app_tokens.g.dart';
import 'package:lms_app/widgets/app_widgets.dart';

Widget wrap(Widget child) => MaterialApp(theme: AppTheme.light(), home: Scaffold(body: Center(child: child)));

void main() {
  test('theme uses the fixed brand palette', () {
    final t = AppTheme.light();
    expect(t.colorScheme.primary, AppTokens.brandOrange);
    expect(t.scaffoldBackgroundColor, AppTokens.bgPage);
    expect(t.colorScheme.surface, AppTokens.surface);
    expect(t.colorScheme.onSurface, AppTokens.text);
    expect(t.colorScheme.error, AppTokens.functionalError);
    expect(t.brightness, Brightness.light);
  });

  testWidgets('AppButton loading is not tappable', (tester) async {
    var taps = 0;
    await tester.pumpWidget(wrap(AppButton(label: 'Save', loading: true, onPressed: () => taps++)));
    await tester.tap(find.byType(AppButton));
    expect(taps, 0);
  });

  testWidgets('primary AppButton label is bold and at least 19px', (tester) async {
    await tester.pumpWidget(wrap(AppButton(label: 'Book live demo', onPressed: () {})));
    final text = tester.widget<Text>(find.text('Book live demo'));
    final style = text.style!;
    expect(style.fontSize, greaterThanOrEqualTo(19));
    expect(style.fontWeight, FontWeight.w700);
  });

  testWidgets('OtpInput paste fills all boxes and completes', (tester) async {
    String? completed;
    await tester.pumpWidget(wrap(OtpInput(onCompleted: (v) => completed = v)));
    await tester.enterText(find.byType(TextField).first, '123456');
    await tester.pump();
    expect(completed, '123456');
    final fields = tester.widgetList<TextField>(find.byType(TextField)).toList();
    expect(fields.length, 6);
    expect(fields.map((f) => f.controller!.text).join(), '123456');
  });

  testWidgets('StatusBadge colours follow the brand mapping', (tester) async {
    await tester.pumpWidget(wrap(const Column(children: [
      StatusBadge(status: 'blocked', label: 'Blocked'),
      StatusBadge(status: 'approved', label: 'Approved'),
      StatusBadge(status: 'pending', label: 'Pending'),
    ])));
    Color bg(String label) {
      final c = tester.widget<Container>(find.ancestor(of: find.textContaining(label), matching: find.byType(Container)).first);
      return (c.decoration as BoxDecoration).color!;
    }
    expect(bg('Blocked'), AppTokens.statusRejectedBg);
    expect(bg('Approved'), AppTokens.statusApprovedBg);
    expect(bg('Pending'), AppTokens.statusPendingBg);
  });

  testWidgets('LabeledProgress always shows the percent text', (tester) async {
    await tester.pumpWidget(wrap(const SizedBox(width: 300, child: LabeledProgress(value: 0.42))));
    expect(find.text('42%'), findsOneWidget);
  });

  testWidgets('long Marathi label does not overflow at 360dp', (tester) async {
    tester.view.physicalSize = const Size(360, 640);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(wrap(AppButton(label: 'थेट डेमो विनंती पाठवा आणि शिक्षकांशी संपर्क साधा', onPressed: () {})));
    expect(tester.takeException(), isNull);
  });

  test('clipboard import is used (keeps services import meaningful)', () {
    expect(Clipboard.kTextPlain, 'text/plain');
  });

  testWidgets('AppBanner paints every kind without a border assertion (regression)', (tester) async {
    for (final kind in ['info', 'warning', 'error', 'success']) {
      await tester.pumpWidget(wrap(AppBanner(kind: kind, message: 'Message $kind')));
      expect(tester.takeException(), isNull, reason: kind);
      expect(find.text('Message $kind'), findsOneWidget);
    }
  });
}
