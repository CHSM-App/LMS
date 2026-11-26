import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app_router.dart';
import '../../core/push/push_registrar.dart';
import '../../core/session/session.dart';
import '../../l10n/gen/app_localizations.dart';
import 'core_providers.dart';

/// A tapped notification's in-app path, waiting until the user is logged in.
final pendingPushLinkProvider = StateProvider<String?>((ref) => null);

final scaffoldMessengerKey = GlobalKey<ScaffoldMessengerState>();

/// Watched once by the app root. Registers the phone after login, shows pushes that arrive while the
/// app is open, and opens the screen a tapped notification points to (after login if needed).
final pushWiringProvider = Provider<void>((ref) {
  final gateway = ref.watch(pushGatewayProvider);
  if (gateway == null) return;

  void setPending(String? link) => ref.read(pendingPushLinkProvider.notifier).state = safePushLink(link);

  final opened = gateway.onOpened.listen((m) => setPending(m.link));
  gateway.initialMessage().then((m) {
    if (m != null) setPending(m.link);
  });
  final foreground = gateway.onForeground.listen((m) {
    final link = safePushLink(m.link);
    final ctx = scaffoldMessengerKey.currentContext;
    if (ctx == null) return;
    scaffoldMessengerKey.currentState?.showSnackBar(SnackBar(
      content: Text(m.title.isEmpty ? m.body : '${m.title}\n${m.body}'),
      action: link == null ? null : SnackBarAction(label: AppLocalizations.of(ctx).pushOpen, onPressed: () => ref.read(routerProvider).go(link)),
    ));
  });
  ref.onDispose(() {
    opened.cancel();
    foreground.cancel();
  });

  void openPending() {
    final link = ref.read(pendingPushLinkProvider);
    if (link == null || !ref.read(sessionProvider).isLoggedIn) return;
    ref.read(pendingPushLinkProvider.notifier).state = null;
    ref.read(routerProvider).go(link);
  }

  ref.listen<SessionState>(sessionProvider, (prev, next) {
    if (!(prev?.isLoggedIn ?? false) && next.isLoggedIn) {
      ref.read(pushRegistrarProvider)?.register();
      openPending();
    }
  });
  ref.listen<String?>(pendingPushLinkProvider, (_, _) => openPending());
});
