import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/gen/app_localizations.dart';
import '../../presentation/providers/student_providers.dart';
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
        title: Text(titles[_tab]),
        actions: [
          IconButton(tooltip: l.sNotifications, icon: const Icon(Icons.notifications_none), onPressed: () => context.push('/student/notifications')),
          IconButton(tooltip: l.sDownloads, icon: const Icon(Icons.download_for_offline_outlined), onPressed: () => context.push('/student/downloads')),
        ],
      ),
      body: IndexedStack(
        index: _tab,
        children: const [StudentDashboardScreen(), StudentExamsScreen(), StudentLiveClassesScreen(), StudentDoubtsScreen(), StudentMoreScreen()],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (i) => setState(() => _tab = i),
        destinations: [
          NavigationDestination(icon: const Icon(Icons.home_outlined), label: l.sHome),
          NavigationDestination(icon: const Icon(Icons.quiz_outlined), label: l.sExams),
          NavigationDestination(icon: const Icon(Icons.videocam_outlined), label: l.sClasses),
          NavigationDestination(icon: const Icon(Icons.help_outline), label: l.sDoubts),
          NavigationDestination(icon: const Icon(Icons.menu), label: l.sMore),
        ],
      ),
    );
  }
}
