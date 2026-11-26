import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/gen/app_localizations.dart';
import '../../core/theme/app_tokens.g.dart';
import '../../presentation/providers/core_providers.dart';
import '../../presentation/providers/student_providers.dart';
import '../../widgets/app_chrome.dart';
import 'student_dashboard_screen.dart';
import 'student_exams_screen.dart';
import 'student_more_screens.dart';

/// Student app shell: Home · Exams · Classes · Doubts · More. Starts licence renewal and offline
/// progress sync (now, and whenever the phone comes back online).
class StudentHomeScreen extends ConsumerStatefulWidget {
  const StudentHomeScreen({super.key});

  @override
  ConsumerState<StudentHomeScreen> createState() => _StudentHomeScreenState();
}

class _StudentHomeScreenState extends ConsumerState<StudentHomeScreen> {
  int _tab = 0;

  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(offlineSyncProvider).start());
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final titles = [l.dashboard, l.sExams, l.sLiveClasses, l.sDoubts, l.sMore];
    return Scaffold(
      appBar: AppBar(
        // Home shows the student's avatar and name; the other tabs name themselves.
        title: _tab == 0 ? AvatarTitle(name: ref.watch(sessionProvider).user?.name ?? l.appName) : Text(titles[_tab]),
        actions: [
          NotificationBell(tooltip: l.sNotifications, onPressed: () => context.push('/student/notifications')),
          IconButton(tooltip: l.sDownloads, icon: const Icon(Icons.download_for_offline_outlined), onPressed: () => context.push('/student/downloads')),
          const SizedBox(width: AppTokens.spaceS1),
        ],
      ),
      body: IndexedStack(
        index: _tab,
        children: [
          StudentDashboardScreen(onOpenClasses: () => setState(() => _tab = 2), onOpenExams: () => setState(() => _tab = 1)),
          const StudentExamsScreen(),
          const StudentLiveClassesScreen(),
          const StudentDoubtsScreen(),
          const StudentMoreScreen(),
        ],
      ),
      bottomNavigationBar: RoundedNavBar(child: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (i) => setState(() => _tab = i),
        destinations: [
          NavigationDestination(icon: const Icon(Icons.home_outlined), selectedIcon: const Icon(Icons.home_rounded), label: l.sHome),
          NavigationDestination(icon: const Icon(Icons.quiz_outlined), selectedIcon: const Icon(Icons.quiz_rounded), label: l.sExams),
          NavigationDestination(icon: const Icon(Icons.videocam_outlined), selectedIcon: const Icon(Icons.videocam_rounded), label: l.sClasses),
          NavigationDestination(icon: const Icon(Icons.help_outline), selectedIcon: const Icon(Icons.help_rounded), label: l.sDoubts),
          NavigationDestination(icon: const Icon(Icons.menu), selectedIcon: const Icon(Icons.menu_open_rounded), label: l.sMore),
        ],
      )),
    );
  }
}
