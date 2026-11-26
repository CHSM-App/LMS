import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_tokens.g.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../widgets/app_chrome.dart';
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
        title: _tab == 0 ? BrandTitle(name: l.appName) : Text(titles[_tab]),
        actions: [
          IconButton(tooltip: l.account, icon: const Icon(Icons.account_circle_outlined), onPressed: () => context.push('/account')),
          const SizedBox(width: AppTokens.spaceS1),
        ],
      ),
      body: tabs[_tab],
      bottomNavigationBar: RoundedNavBar(child: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (i) => setState(() => _tab = i),
        destinations: [
          NavigationDestination(icon: const Icon(Icons.home_outlined), selectedIcon: const Icon(Icons.home_rounded), label: l.sHome),
          NavigationDestination(icon: const Icon(Icons.inbox_outlined), selectedIcon: const Icon(Icons.inbox_rounded), label: l.tRequests),
          NavigationDestination(icon: const Icon(Icons.people_outline), selectedIcon: const Icon(Icons.people_rounded), label: l.tStudents),
          NavigationDestination(icon: const Icon(Icons.videocam_outlined), selectedIcon: const Icon(Icons.videocam_rounded), label: l.tClasses),
          NavigationDestination(icon: const Icon(Icons.help_outline), selectedIcon: const Icon(Icons.help_rounded), label: l.tDoubts),
        ],
      )),
    );
  }
}
