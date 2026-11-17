import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app_router.dart';
import 'core/session/session.dart';
import 'core/theme/app_theme.dart';
import 'l10n/gen/app_localizations.dart';
import 'presentation/providers/core_providers.dart';
import 'presentation/providers/student_providers.dart';

void main() {
  runApp(const ProviderScope(child: LmsApp()));
}

class LmsApp extends ConsumerWidget {
  const LmsApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Any end of a student session (logout, account deleted, blocked, session revoked) deletes
    // every offline video and key on this phone.
    ref.listen<SessionState>(sessionProvider, (prev, next) {
      if (prev?.user?.role == 'student' && !next.isLoggedIn) {
        ref.read(offlineWipeProvider)().catchError((Object _) {});
      }
    });
    return MaterialApp.router(
      theme: AppTheme.light(),
      routerConfig: ref.watch(routerProvider),
      onGenerateTitle: (context) => AppLocalizations.of(context).appName,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: AppLocalizations.supportedLocales,
    );
  }
}
