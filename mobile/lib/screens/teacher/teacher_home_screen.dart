import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/gen/app_localizations.dart';
import 'teacher_tabs.dart';

/// Light teacher app (DECISIONS.md). Course/question/exam builders stay on the website.
class TeacherHomeScreen extends ConsumerStatefulWidget {
  const TeacherHomeScreen({super.key});

  @override
  ConsumerState<TeacherHomeScreen> createState() => _TeacherHomeScreenState();
}

class _TeacherHomeScreenState extends ConsumerState<TeacherHomeScreen> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final titles = [l.dashboard, l.tRequests, l.tStudents, l.tClasses, l.tDoubts];
    const tabs = [DashboardTab(), RequestsTab(), StudentsTab(), ClassesTab(), DoubtsTab()];
    return Scaffold(
      appBar: AppBar(
        title: Text(titles[_tab]),
        actions: [IconButton(tooltip: l.account, icon: const Icon(Icons.person_outline), onPressed: () => context.push('/account'))],
      ),
      body: tabs[_tab],
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (i) => setState(() => _tab = i),
        destinations: [
          NavigationDestination(icon: const Icon(Icons.home_outlined), label: l.dashboard),
          NavigationDestination(icon: const Icon(Icons.inbox_outlined), label: l.tRequests),
          NavigationDestination(icon: const Icon(Icons.people_outline), label: l.tStudents),
          NavigationDestination(icon: const Icon(Icons.videocam_outlined), label: l.tClasses),
          NavigationDestination(icon: const Icon(Icons.help_outline), label: l.tDoubts),
        ],
      ),
    );
  }
}
