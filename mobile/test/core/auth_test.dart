import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lms_app/core/network/api_client.dart';
import 'package:lms_app/core/session/session.dart';
import 'package:lms_app/core/storage/token_storage.dart';
import 'package:lms_app/data/repositories/auth_repository.dart';
import 'package:lms_app/presentation/viewModels/login_viewmodel.dart';

class MemoryTokenStore implements TokenStore {
  String? access;
  String? refresh;
  @override
  Future<void> clear() async => access = refresh = null;
  @override
  Future<String?> readRefresh() async => refresh;
  @override
  Future<void> save({required String accessToken, String? refreshToken}) async {
    access = accessToken;
    if (refreshToken != null) refresh = refreshToken;
  }
}

/// Fake HTTP: /auth/refresh hands out "new"; any request with "old" gets TOKEN_EXPIRED.
class FakeAdapter implements HttpClientAdapter {
  int refreshCalls = 0;
  @override
  Future<ResponseBody> fetch(RequestOptions o, Stream<List<int>>? requestStream, Future<void>? cancelFuture) async {
    if (o.path.endsWith('/auth/refresh')) {
      refreshCalls++;
      await Future<void>.delayed(const Duration(milliseconds: 20));
      return ResponseBody.fromString('{"success":true,"data":{"accessToken":"new","refreshToken":"r2"}}', 200, headers: {
        Headers.contentTypeHeader: ['application/json'],
      });
    }
    if (o.headers['Authorization'] == 'Bearer old') {
      return ResponseBody.fromString('{"success":false,"error":"expired","code":"TOKEN_EXPIRED"}', 401, headers: {
        Headers.contentTypeHeader: ['application/json'],
      });
    }
    return ResponseBody.fromString('{"success":true,"data":{"path":"${o.path}"}}', 200, headers: {
      Headers.contentTypeHeader: ['application/json'],
    });
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  test('two concurrent 401s trigger exactly one refresh', () async {
    final store = MemoryTokenStore()..refresh = 'r1';
    final session = SessionController(store);
    session.setAccessToken('old');
    final adapter = FakeAdapter();
    final client = ApiClient(baseUrl: 'http://x/api/v1', session: session, store: store, adapter: adapter);
    final results = await Future.wait([client.get('/a'), client.get('/b')]);
    expect(adapter.refreshCalls, 1);
    expect(results.map((r) => r['path']).toList(), ['/a', '/b']);
    expect(store.refresh, 'r2');
  });

  test('isLoggedIn is false when role is missing', () {
    final s = SessionController(MemoryTokenStore());
    s.setAccessToken('tok');
    expect(s.state.isLoggedIn, isFalse);
    s.setUser(const SessionUser(publicId: 'p', name: 'A', mobile: '+919876543210', role: 'student'));
    expect(s.state.isLoggedIn, isTrue);
  });

  test('LoginViewModel goes idle -> otpSent -> verified and shows API errors', () async {
    final repo = _FakeAuthRepo();
    final vm = LoginViewModel(repo);
    expect(vm.state.step, LoginStep.mobile);
    await vm.sendOtp('98765');
    expect(vm.state.error, 'invalidMobile');
    await vm.sendOtp('9876543210');
    expect(vm.state.step, LoginStep.otp);
    expect(vm.state.resendIn, 30);
    repo.failSend = true;
    await vm.resend();
    expect(vm.state.error, 'Too many OTP requests. Try again in 14 minutes.');
    await vm.verify('123456');
    expect(vm.state.step, LoginStep.done);
    expect(vm.state.user!.role, 'teacher');
    vm.dispose();
  });
}

class _FakeAuthRepo implements AuthRepository {
  bool failSend = false;
  @override
  Future<int> sendOtp(String mobile, String purpose) async {
    if (failSend) throw const ApiException(429, 'Too many OTP requests. Try again in 14 minutes.', 'OTP_LIMIT');
    return 30;
  }

  @override
  Future<SessionUser> login(String mobile, String otp) async =>
      const SessionUser(publicId: 'p', name: 'Suresh', mobile: '+919876543210', role: 'teacher');

  @override
  Future<SessionUser?> restore() async => null;

  @override
  Future<void> logout({String? deviceId}) async {}

  @override
  Future<SessionUser> registerStudent(Map<String, dynamic> fields) async => throw UnimplementedError();
}
