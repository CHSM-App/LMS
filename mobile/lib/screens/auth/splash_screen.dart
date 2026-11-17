import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_tokens.g.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../presentation/providers/core_providers.dart';

/// Restores the session once (refresh token → /auth/me), then the router redirects by role.
class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(authRepositoryProvider).restore());
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return Scaffold(
      backgroundColor: AppTokens.navBg,
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(l.appName, style: const TextStyle(color: AppTokens.navText, fontSize: AppTokens.textXxl, fontWeight: FontWeight.w800)),
            const SizedBox(height: AppTokens.spaceS4),
            const SizedBox(width: 28, height: 28, child: CircularProgressIndicator(color: AppTokens.navActive, strokeWidth: 3)),
          ],
        ),
      ),
    );
  }
}
