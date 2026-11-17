import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_tokens.g.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../presentation/providers/core_providers.dart';

/// Student home. Filled in by Phase 9/10 (dashboard, courses, exams, downloads).
class StudentHomeScreen extends ConsumerWidget {
  const StudentHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final user = ref.watch(sessionProvider).user;
    return Scaffold(
      appBar: AppBar(
        title: Text(l.dashboard),
        actions: [IconButton(tooltip: l.account, icon: const Icon(Icons.person_outline), onPressed: () => context.push('/account'))],
      ),
      body: Padding(
        padding: const EdgeInsets.all(AppTokens.spaceS4),
        child: Text(l.hello(user?.name ?? ''), style: Theme.of(context).textTheme.titleLarge),
      ),
    );
  }
}
