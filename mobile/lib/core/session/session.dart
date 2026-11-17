import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../storage/token_storage.dart';

@immutable
class SessionUser {
  const SessionUser({required this.publicId, required this.name, required this.mobile, required this.role, this.preferredLang = 'en'});

  final String publicId;
  final String name;
  final String mobile;
  final String role;
  final String preferredLang;

  factory SessionUser.fromJson(Map<String, dynamic> j) => SessionUser(
        publicId: j['publicId'] as String,
        name: j['name'] as String,
        mobile: (j['mobile'] ?? '') as String,
        role: j['role'] as String,
        preferredLang: (j['preferredLang'] ?? 'en') as String,
      );
}

@immutable
class SessionState {
  const SessionState({this.accessToken, this.user, this.restoring = true, this.endedMessage});

  final String? accessToken;
  final SessionUser? user;
  final bool restoring;
  final String? endedMessage;

  /// Logged in only with both a token and a known role (fixes Flutter_ARCHITECTURE §14.4).
  bool get isLoggedIn => accessToken != null && user != null && user!.role.isNotEmpty;
}

/// Single source of auth state (Flutter_ARCHITECTURE §15.7 sessionProvider).
class SessionController extends StateNotifier<SessionState> {
  SessionController(this.store) : super(const SessionState());

  final TokenStore store;

  /// Read-only view for non-widget code (API client, repositories).
  SessionState get current => state;

  void setAccessToken(String? token) => state = SessionState(accessToken: token, user: state.user, restoring: state.restoring);

  void setUser(SessionUser? user) => state = SessionState(accessToken: state.accessToken, user: user, restoring: false);

  void finishRestore() => state = SessionState(accessToken: state.accessToken, user: state.user, restoring: false);

  Future<void> end([String? message]) async {
    await store.clear();
    state = SessionState(restoring: false, endedMessage: message);
  }
}
