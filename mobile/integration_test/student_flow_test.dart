// On-device end-to-end test (Phase 10 Task 2): run on an Android phone or emulator against the e2e test API.
//
//   1. On the computer:   cd api && node scripts/e2e-server.js        (test database only, port 4100)
//   2. Then:              cd mobile && flutter test integration_test \
//                           --dart-define=API_BASE_URL=http://10.0.2.2:4100/api/v1 \
//                           --dart-define=E2E_HOOKS=http://10.0.2.2:4100/api/v1/__e2e
//      (10.0.2.2 is the computer as seen from the Android emulator; on a USB phone use `adb reverse tcp:4100 tcp:4100`
//       and http://127.0.0.1:4100.)
//
// It logs in with a real OTP (read from the test API), opens the course, downloads a lesson video for offline use,
// checks the stored file is encrypted, takes a unit test and checks the result. The physical checks (airplane mode,
// black screenshot, Files app) stay manual: docs/RELEASE-CHECKLIST.md §5.
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:lms_app/core/offline/offline_platform.dart';
import 'package:lms_app/main.dart';
import 'package:lms_app/presentation/providers/student_providers.dart';
import 'package:lms_app/presentation/viewModels/download_viewmodel.dart';

const hooks = String.fromEnvironment('E2E_HOOKS', defaultValue: 'http://10.0.2.2:4100/api/v1/__e2e');

Future<Map<String, dynamic>> hook(String method, String path, [Map<String, String>? query]) async {
  final client = HttpClient();
  try {
    final uri = Uri.parse('$hooks$path').replace(queryParameters: query);
    final req = method == 'GET' ? await client.getUrl(uri) : await client.postUrl(uri);
    final res = await req.close();
    final body = jsonDecode(await res.transform(utf8.decoder).join()) as Map<String, dynamic>;
    if (body['success'] != true) throw StateError('hook $path: ${body['error']}');
    return (body['data'] as Map?)?.cast<String, dynamic>() ?? const {};
  } finally {
    client.close(force: true);
  }
}

Future<void> pumpUntil(WidgetTester tester, Finder f, {Duration timeout = const Duration(seconds: 30)}) async {
  final end = DateTime.now().add(timeout);
  while (DateTime.now().isBefore(end)) {
    await tester.pump(const Duration(milliseconds: 250));
    if (f.evaluate().isNotEmpty) return;
  }
  throw TestFailure('Timed out waiting for $f');
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('student: OTP login → course → offline download (encrypted) → unit test → result', (tester) async {
    await hook('POST', '/reset');
    final w = await hook('POST', '/world-exams');
    final mobile = (w['student'] as Map)['mobile'] as String;

    await tester.pumpWidget(const ProviderScope(child: LmsApp()));
    await pumpUntil(tester, find.text('Send OTP'));

    // Log in with the OTP the test API generated.
    await tester.enterText(find.byType(TextField).first, mobile.substring(3));
    final before = (await hook('GET', '/otp', {'mobile': mobile, 'purpose': 'login'}))['code'];
    await tester.tap(find.text('Send OTP'));
    String? code;
    for (var i = 0; i < 40 && (code == null || code == before); i++) {
      await tester.pump(const Duration(milliseconds: 250));
      code = (await hook('GET', '/otp', {'mobile': mobile, 'purpose': 'login'}))['code'] as String?;
    }
    await tester.enterText(find.byType(TextField).first, code!);
    await tester.pump();
    await tester.tap(find.text('Verify and log in'));
    await pumpUntil(tester, find.text('Next up'));

    // Course → download the uploaded lesson video for offline viewing.
    await tester.tap(find.text('Continue'));
    await pumpUntil(tester, find.byTooltip('Download'));
    await tester.tap(find.byTooltip('Download').first);
    final container = ProviderScope.containerOf(tester.element(find.byType(Scaffold).first));
    for (var i = 0; i < 120; i++) {
      await tester.pump(const Duration(milliseconds: 500));
      final items = container.read(downloadsProvider).items.values;
      if (items.any((x) => x.status == DownloadStatus.completed)) break;
    }
    final done = container.read(downloadsProvider).items.values.where((x) => x.status == DownloadStatus.completed).toList();
    expect(done, isNotEmpty, reason: 'the lesson video finished downloading');
    final rec = await container.read(downloadDaoProvider).get(done.first.contentId);
    final stored = File(rec!.filePath).readAsBytesSync();
    expect(rec.filePath, startsWith((await offlineDirectory()).path), reason: 'kept in app-private storage');
    expect(String.fromCharCodes(stored.sublist(64, 76)).contains('ftyp'), isFalse, reason: 'the MP4 header is not readable on disk');

    // Unit test → result.
    await tester.pageBack();
    await pumpUntil(tester, find.text('Exams'));
    await tester.tap(find.text('Exams').last);
    await pumpUntil(tester, find.text('Start'));
    await tester.tap(find.text('Start').first);
    await pumpUntil(tester, find.byType(RadioListTile<int>));
    for (final q in RegExp(r'What is (\d+) \+').allMatches(tester.widgetList<Text>(find.textContaining('What is')).map((t) => t.data).join('\n'))) {
      final n = int.parse(q.group(1)!);
      await tester.tap(find.widgetWithText(RadioListTile<int>, '${n * 2}').first);
      await tester.pump(const Duration(milliseconds: 800));
    }
    await tester.scrollUntilVisible(find.text('Submit exam'), 300);
    await tester.tap(find.text('Submit exam'));
    await pumpUntil(tester, find.text('Submit now'));
    await tester.tap(find.text('Submit now'));
    await pumpUntil(tester, find.textContaining('(100%)'));
  });
}
