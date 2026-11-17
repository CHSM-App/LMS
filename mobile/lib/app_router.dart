import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'core/session/session.dart';
import 'presentation/providers/core_providers.dart';
import 'screens/auth/account_screen.dart';
import 'screens/auth/admin_web_only_screen.dart';
import 'screens/auth/login_screen.dart';
import 'screens/auth/splash_screen.dart';
import 'screens/public/catalog_screen.dart';
import 'screens/public/course_details_screen.dart';
import 'screens/public/demo_request_screen.dart';
import 'screens/public/register_screen.dart';
import 'screens/student/course_player_screen.dart';
import 'screens/student/downloads_screen.dart';
import 'screens/student/exam_screen.dart';
import 'screens/student/offline_player_screen.dart';
import 'screens/student/result_screen.dart';
import 'screens/student/student_home_screen.dart';
import 'screens/student/student_more_screens.dart';
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

/// Routes a logged-out visitor may open: login, registration and the public catalog.
bool isPublicRoute(String loc) => loc == '/login' || loc == '/register' || loc == '/courses' || loc.startsWith('/courses/');

int _id(GoRouterState s, String name) => int.tryParse(s.pathParameters[name] ?? '') ?? 0;

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
      if (!s.isLoggedIn) return isPublicRoute(loc) ? null : '/login';
      return roleRedirect(loc, s.user!.role);
    },
    routes: [
      GoRoute(path: '/splash', builder: (_, _) => const SplashScreen()),
      GoRoute(path: '/login', builder: (_, _) => const LoginScreen()),
      GoRoute(path: '/register', builder: (_, s) => RegisterScreen(slug: s.uri.queryParameters['slug'])),
      GoRoute(path: '/courses', builder: (_, _) => const CatalogScreen()),
      GoRoute(path: '/courses/:slug', builder: (_, s) => CourseDetailsScreen(slug: s.pathParameters['slug']!)),
      GoRoute(path: '/courses/:slug/demo', builder: (_, s) => DemoRequestScreen(slug: s.pathParameters['slug']!)),
      GoRoute(path: '/enroll/:slug', builder: (_, s) => EnrollScreen(slug: s.pathParameters['slug']!)),
      GoRoute(path: '/student', builder: (_, _) => const StudentHomeScreen()),
      GoRoute(path: '/student/courses/:courseId', builder: (_, s) => CoursePlayerScreen(courseId: _id(s, 'courseId'))),
      GoRoute(path: '/student/exams/:examId/take', builder: (_, s) => ExamScreen(examId: _id(s, 'examId'))),
      GoRoute(path: '/student/attempts/:attemptId/result', builder: (_, s) => ResultScreen(attemptId: s.pathParameters['attemptId']!)),
      GoRoute(path: '/student/offline/:contentId', builder: (_, s) => OfflinePlayerScreen(contentId: _id(s, 'contentId'))),
      GoRoute(path: '/student/downloads', builder: (_, _) => const DownloadsScreen()),
      GoRoute(path: '/student/progress', builder: (_, _) => const StudentProgressScreen()),
      GoRoute(path: '/student/profile', builder: (_, _) => const StudentProfileScreen()),
      GoRoute(path: '/student/notifications', builder: (_, _) => const NotificationsScreen()),
      GoRoute(path: '/teacher', builder: (_, _) => const TeacherHomeScreen()),
      GoRoute(path: '/admin', builder: (_, _) => const AdminWebOnlyScreen()),
      GoRoute(path: '/account', builder: (_, _) => const AccountScreen()),
    ],
  );
});
