import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/env.dart';
import '../../core/network/api_client.dart';
import '../../core/push/push_gateway.dart';
import '../../core/push/push_registrar.dart';
import '../../core/session/session.dart';
import '../../core/storage/token_storage.dart';
import '../../data/repositories/auth_repository.dart';
import '../viewModels/login_viewmodel.dart';

/// Dependency wiring only (Flutter_ARCHITECTURE §10.3). Synchronous providers (§15.1).
final tokenStoreProvider = Provider<TokenStore>((ref) => SecureTokenStore());

final sessionProvider = StateNotifierProvider<SessionController, SessionState>((ref) => SessionController(ref.watch(tokenStoreProvider)));

final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient(baseUrl: Env.apiBaseUrl, session: ref.read(sessionProvider.notifier), store: ref.read(tokenStoreProvider));
});

/// Null when Firebase is not set up for this platform (iOS has no config yet, and tests). main() overrides it.
final pushGatewayProvider = Provider<PushGateway?>((ref) => null);

final pushRegistrarProvider = Provider<PushRegistrar?>((ref) {
  final gateway = ref.watch(pushGatewayProvider);
  if (gateway == null) return null;
  final platform = defaultTargetPlatform == TargetPlatform.iOS ? 'ios' : 'android';
  return PushRegistrar(gateway, ref.read(apiClientProvider), platform: platform);
});

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return ApiAuthRepository(
    ref.read(apiClientProvider),
    ref.read(sessionProvider.notifier),
    ref.read(tokenStoreProvider),
    beforeLogout: () async => ref.read(pushRegistrarProvider)?.unregister(),
  );
});

final loginViewModelProvider = StateNotifierProvider.autoDispose<LoginViewModel, LoginState>((ref) => LoginViewModel(ref.read(authRepositoryProvider)));
