import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_tokens.g.dart';
import '../../data/models/student_models.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../presentation/providers/core_providers.dart';
import '../../presentation/providers/student_providers.dart';
import '../../widgets/app_widgets.dart';
import '../student/widgets/common.dart';

class CatalogScreen extends ConsumerStatefulWidget {
  const CatalogScreen({super.key});

  @override
  ConsumerState<CatalogScreen> createState() => _CatalogScreenState();
}

class _CatalogScreenState extends ConsumerState<CatalogScreen> {
  String _q = '';

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final loggedIn = ref.watch(sessionProvider).isLoggedIn;
    return Scaffold(
      appBar: AppBar(
        title: Text(l.pCourses),
        actions: [if (!loggedIn) TextButton(onPressed: () => context.go('/login'), child: Text(l.loginTitle))],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(AppTokens.spaceS4),
            child: TextField(
              textInputAction: TextInputAction.search,
              decoration: InputDecoration(hintText: l.pSearch, prefixIcon: const Icon(Icons.search)),
              onSubmitted: (v) => setState(() => _q = v.trim()),
            ),
          ),
          Expanded(
            child: AsyncView<List<CourseCard>>(
              value: ref.watch(catalogProvider(_q)),
              onRetry: () => ref.invalidate(catalogProvider(_q)),
              builder: (courses) => courses.isEmpty
                  ? EmptyState(title: l.pNoResults)
                  : ListView.builder(
                      padding: const EdgeInsets.symmetric(horizontal: AppTokens.spaceS4),
                      itemCount: courses.length,
                      itemBuilder: (_, i) {
                        final c = courses[i];
                        return Card(
                          child: ListTile(
                            title: Text(c.title, style: const TextStyle(fontWeight: FontWeight.w700)),
                            subtitle: Text([l.pBy(c.teacherName), ?c.durationText, ?c.feeDisplay].join(' · ')),
                            trailing: const Icon(Icons.chevron_right),
                            onTap: () => context.push('/courses/${c.slug}'),
                          ),
                        );
                      },
                    ),
            ),
          ),
        ],
      ),
    );
  }
}
