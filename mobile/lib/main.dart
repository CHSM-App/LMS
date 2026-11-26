import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app_router.dart';
import 'core/push/push_gateway.dart';
import 'core/session/session.dart';
import 'core/theme/app_theme.dart';
import 'l10n/gen/app_localizations.dart';
import 'presentation/providers/core_providers.dart';
import 'presentation/providers/locale_provider.dart';
import 'presentation/providers/onboarding_provider.dart';
import 'presentation/providers/push_providers.dart';
import 'presentation/providers/student_providers.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final seen = await readOnboardingSeen();
  final push = await _initPush();
  runApp(ProviderScope(
    overrides: [
      onboardingSeenProvider.overrideWith((ref) => seen),
      pushGatewayProvider.overrideWithValue(push),
    ],
    child: const LmsApp(),
  ));
}

/// Firebase is configured for Android only (google-services.json). Anywhere else, or if setup fails,
/// the app runs without push.
Future<PushGateway?> _initPush() async {
  if (defaultTargetPlatform != TargetPlatform.android) return null;
  try {
    await Firebase.initializeApp();
    return FirebasePushGateway();
  } catch (_) {
    return null;
  }
}

class LmsApp extends ConsumerWidget {
  const LmsApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(pushWiringProvider);
    // Any end of a student session (logout, account deleted, blocked, session revoked) deletes
    // every offline video and key on this phone.
    ref.listen<SessionState>(sessionProvider, (prev, next) {
      if (prev?.user?.role == 'student' && !next.isLoggedIn) {
        ref.read(offlineWipeProvider)().catchError((Object _) {});
      }
    });
    return MaterialApp.router(
      scaffoldMessengerKey: scaffoldMessengerKey,
      debugShowCheckedModeBanner: false,
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
      locale: ref.watch(localeProvider),
    );
  }
}
