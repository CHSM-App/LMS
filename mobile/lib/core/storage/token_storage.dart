import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Refresh token lives only in secure storage (Keychain / Keystore). The access token stays in memory.
abstract class TokenStore {
  Future<void> save({required String accessToken, String? refreshToken});
  Future<String?> readRefresh();
  Future<void> clear();
}

class SecureTokenStore implements TokenStore {
  SecureTokenStore([FlutterSecureStorage? storage]) : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;
  static const _refreshKey = 'refresh_token';

  @override
  Future<void> save({required String accessToken, String? refreshToken}) async {
    if (refreshToken != null) await _storage.write(key: _refreshKey, value: refreshToken);
  }

  @override
  Future<String?> readRefresh() => _storage.read(key: _refreshKey);

  @override
  Future<void> clear() => _storage.delete(key: _refreshKey);
}
