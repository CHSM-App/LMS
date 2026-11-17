import '../../core/network/api_client.dart';
import '../../core/session/session.dart';
import '../../core/storage/token_storage.dart';

export '../../core/network/api_client.dart' show ApiException;

abstract class AuthRepository {
  Future<int> sendOtp(String mobile, String purpose);
  Future<SessionUser> login(String mobile, String otp);
  Future<SessionUser?> restore();
  Future<void> logout();
}

class ApiAuthRepository implements AuthRepository {
  ApiAuthRepository(this.api, this.session, this.store);

  final ApiClient api;
  final SessionController session;
  final TokenStore store;

  @override
  Future<int> sendOtp(String mobile, String purpose) async {
    final data = await api.post('/auth/otp/send', {'mobile': mobile, 'purpose': purpose}) as Map<String, dynamic>;
    return (data['resendAfterSec'] ?? 30) as int;
  }

  @override
  Future<SessionUser> login(String mobile, String otp) async {
    final data = await api.post('/auth/login', {'mobile': mobile, 'otp': otp}) as Map<String, dynamic>;
    final access = data['accessToken'] as String;
    await store.save(accessToken: access, refreshToken: data['refreshToken'] as String?);
    session.setAccessToken(access);
    final user = SessionUser.fromJson(data['user'] as Map<String, dynamic>);
    session.setUser(user);
    return user;
  }

  @override
  Future<SessionUser?> restore() async {
    try {
      await api.refresh();
      final me = await api.get('/auth/me') as Map<String, dynamic>;
      final user = SessionUser.fromJson(me);
      session.setUser(user);
      return user;
    } on ApiException {
      session.finishRestore();
      return null;
    }
  }

  @override
  Future<void> logout() async {
    final rt = await store.readRefresh();
    try {
      await api.post('/auth/logout', {'refreshToken': rt});
    } on ApiException {
      // Logging out locally still works when offline.
    }
    await session.end();
  }
}
