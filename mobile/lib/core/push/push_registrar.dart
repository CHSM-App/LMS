import 'dart:async';

import '../network/api_client.dart';
import 'push_gateway.dart';

/// Only in-app paths are followed from a notification. Anything else (full URLs, `//host`) is ignored.
String? safePushLink(String? link) {
  if (link == null || !link.startsWith('/') || link.startsWith('//')) return null;
  return link;
}

/// Keeps the server's list of this phone's Firebase token up to date.
/// Every method swallows failures: push is a bonus and must never break login or logout.
class PushRegistrar {
  PushRegistrar(this._gateway, this._api, {required this.platform});

  final PushGateway _gateway;
  final ApiClient _api;
  final String platform;
  StreamSubscription<String>? _refresh;
  String? _token;

  /// After login: ask permission, send the token, and keep sending it when Firebase renews it.
  Future<void> register() async {
    try {
      if (!await _gateway.requestPermission()) return;
      final t = await _gateway.token();
      if (t == null) return;
      await _send(t);
      await _refresh?.cancel();
      _refresh = _gateway.onTokenRefresh.listen((n) => _send(n));
    } catch (_) {}
  }

  Future<void> _send(String token) async {
    try {
      await _api.post('/push-tokens', {'token': token, 'platform': platform});
      _token = token;
    } catch (_) {}
  }

  /// Before logout (the access token is still valid): stop messages for this user on this phone.
  Future<void> unregister() async {
    await _refresh?.cancel();
    _refresh = null;
    final t = _token;
    _token = null;
    try {
      if (t != null) await _api.delete('/push-tokens', {'token': t});
      await _gateway.deleteToken();
    } catch (_) {}
  }

  Future<void> dispose() async => _refresh?.cancel();
}
