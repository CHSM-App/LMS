import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:lms_app/core/network/api_client.dart';
import 'package:lms_app/core/push/push_gateway.dart';
import 'package:lms_app/core/push/push_registrar.dart';

class FakeGateway implements PushGateway {
  bool allowed = true;
  String? current = 'token-aaaaaaaaaaaaaaaaaaaa';
  bool deleted = false;
  final refresh = StreamController<String>.broadcast();

  @override
  Future<bool> requestPermission() async => allowed;
  @override
  Future<String?> token() async => current;
  @override
  Stream<String> get onTokenRefresh => refresh.stream;
  @override
  Stream<PushMessage> get onForeground => const Stream.empty();
  @override
  Stream<PushMessage> get onOpened => const Stream.empty();
  @override
  Future<PushMessage?> initialMessage() async => null;
  @override
  Future<void> deleteToken() async => deleted = true;
}

class FakeApi extends Fake implements ApiClient {
  final calls = <String>[];
  Object? lastBody;
  bool fail = false;

  @override
  Future<dynamic> post(String path, [Object? body]) async {
    if (fail) throw const ApiException(0, 'offline');
    calls.add('POST $path');
    lastBody = body;
    return {'registered': true};
  }

  @override
  Future<dynamic> delete(String path, [Object? body]) async {
    calls.add('DELETE $path');
    lastBody = body;
  }
}

void main() {
  test('register sends the token and platform once permission is granted', () async {
    final api = FakeApi();
    await PushRegistrar(FakeGateway(), api, platform: 'android').register();
    expect(api.calls, ['POST /push-tokens']);
    expect(api.lastBody, {'token': 'token-aaaaaaaaaaaaaaaaaaaa', 'platform': 'android'});
  });

  test('nothing is sent when permission is denied or there is no token', () async {
    final api = FakeApi();
    final g = FakeGateway()..allowed = false;
    await PushRegistrar(g, api, platform: 'android').register();
    g.allowed = true;
    g.current = null;
    await PushRegistrar(g, api, platform: 'android').register();
    expect(api.calls, isEmpty);
  });

  test('a network failure does not throw', () async {
    final api = FakeApi()..fail = true;
    await PushRegistrar(FakeGateway(), api, platform: 'android').register();
  });

  test('a refreshed token is registered again', () async {
    final api = FakeApi();
    final g = FakeGateway();
    final r = PushRegistrar(g, api, platform: 'android');
    await r.register();
    g.refresh.add('token-bbbbbbbbbbbbbbbbbbbb');
    await Future<void>.delayed(Duration.zero);
    expect(api.lastBody, {'token': 'token-bbbbbbbbbbbbbbbbbbbb', 'platform': 'android'});
    await r.dispose();
  });

  test('safeLink accepts only in-app paths', () {
    expect(safePushLink('/student/notifications'), '/student/notifications');
    expect(safePushLink('https://evil.example'), isNull);
    expect(safePushLink('//evil.example'), isNull);
    expect(safePushLink(''), isNull);
    expect(safePushLink(null), isNull);
  });
}
