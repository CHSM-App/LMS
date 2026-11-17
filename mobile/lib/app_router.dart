import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'core/session/session.dart';
import 'presentation/providers/core_providers.dart';
import 'screens/auth/account_screen.dart';
import 'screens/auth/admin_web_only_screen.dart';
import 'screens/auth/login_screen.dart';
import 'screens/auth/splash_screen.dart';
import 'screens/student/student_home_screen.dart';
import 'screens/teacher/teacher_home_screen.dart';

String homeFor(String? role) => switch (role) {
      'teacher' => '/teacher',
      'student' => '/student',
      'admin' => '/admin',
      _ => '/login',
    };

/// Where a logged-in user with [role] must go instead of [loc], or null to stay.
/// Public catalog routes (/courses...) are open to everyone.
String? roleRedirect(String loc, String role) {
  final home = homeFor(role);
  if (loc == '/splash' || loc == '/login' || loc == '/register') return home;
  for (final area in const ['teacher', 'student', 'admin']) {
    if ((loc == '/$area' || loc.startsWith('/$area/')) && role != area) return home;
  }
  return null;
}

/// Role-based redirect replaces the navigatorKey pattern (Flutter_ARCHITECTURE §15.6).
final routerProvider = Provider<GoRouter>((ref) {
  final refresh = ValueNotifier<SessionState>(ref.read(sessionProvider));
  ref.listen<SessionState>(sessionProvider, (_, next) => refresh.value = next);
  ref.onDispose(refresh.dispose);

  return GoRouter(
    initialLocation: '/splash',
    refreshListenable: refresh,
    redirect: (context, state) {
      final s = refresh.value;
      final loc = state.matchedLocation;
      if (s.restoring) return loc == '/splash' ? null : '/splash';
      final publicRoutes = {'/login'};
      if (!s.isLoggedIn) return publicRoutes.contains(loc) ? null : '/login';
      return roleRedirect(loc, s.user!.role);
    },
    routes: [
      GoRoute(path: '/splash', builder: (_, _) => const SplashScreen()),
      GoRoute(path: '/login', builder: (_, _) => const LoginScreen()),
      GoRoute(path: '/student', builder: (_, _) => const StudentHomeScreen()),
      GoRoute(path: '/teacher', builder: (_, _) => const TeacherHomeScreen()),
      GoRoute(path: '/admin', builder: (_, _) => const AdminWebOnlyScreen()),
      GoRoute(path: '/account', builder: (_, _) => const AccountScreen()),
    ],
  );
});
