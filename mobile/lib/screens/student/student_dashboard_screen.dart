import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_tokens.g.dart';
import '../../data/models/student_models.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../presentation/providers/core_providers.dart';
import '../../presentation/providers/student_providers.dart';
import '../../widgets/app_widgets.dart';
import 'widgets/common.dart';

class StudentDashboardScreen extends ConsumerWidget {
  const StudentDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final name = ref.watch(sessionProvider).user?.name ?? '';
    return RefreshIndicator(
      onRefresh: () => ref.refresh(studentDashboardProvider.future),
      child: AsyncView<StudentDashboard>(
        value: ref.watch(studentDashboardProvider),
        onRetry: () => ref.invalidate(studentDashboardProvider),
        builder: (d) => ListView(
          padding: const EdgeInsets.all(AppTokens.spaceS4),
          children: [
            Text(l.hello(name), style: Theme.of(context).textTheme.headlineSmall),
            if (d.nextUp != null) ...[
              const SizedBox(height: AppTokens.spaceS4),
              Card(
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppTokens.radiusMd), side: const BorderSide(color: AppTokens.actionPrimary, width: 2)),
                child: Padding(
                  padding: const EdgeInsets.all(AppTokens.spaceS4),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(l.sNextUp, style: const TextStyle(color: AppTokens.textSecondary)),
                      Text(d.nextUp!.title, style: Theme.of(context).textTheme.titleLarge),
                      const SizedBox(height: AppTokens.spaceS3),
                      LabeledProgress(value: d.nextUp!.progressPct / 100, semanticLabel: d.nextUp!.title),
                      const SizedBox(height: AppTokens.spaceS3),
                      AppButton(label: l.sContinue, expand: true, onPressed: () => context.push('/student/courses/${d.nextUp!.courseId}')),
                    ],
                  ),
                ),
              ),
            ],
            SectionTitle(l.sMyCourses),
            if (d.myCourses.isEmpty) EmptyState(title: l.sNoCourses, actionLabel: l.sBrowse, onAction: () => context.push('/courses')),
            for (final c in d.myCourses) _CourseCard(course: c),
            SectionTitle(l.sUpcoming),
            if (d.upcomingLiveClasses.isEmpty) Text(l.sNoUpcoming, style: const TextStyle(color: AppTokens.textSecondary)),
            for (final c in d.upcomingLiveClasses) LiveClassTile(topic: c.topic, subtitle: '${c.course} · ${formatDateTime(context, c.startsAt)}', meetLink: c.canJoin ? c.meetLink : null, waitingForLink: c.waitingForLink),
            if (d.requests.isNotEmpty) ...[
              SectionTitle(l.sRequests),
              for (final r in d.requests)
                Card(
                  child: ListTile(
                    title: Text(r.courseTitle),
                    subtitle: r.rejectReason == null ? null : Text(r.rejectReason!),
                    trailing: StatusBadge(status: r.status, label: r.status),
                  ),
                ),
            ],
          ],
        ),
      ),
    );
  }
}

class _CourseCard extends StatelessWidget {
  const _CourseCard({required this.course});
  final MyCourse course;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final c = course;
    return Card(
      child: InkWell(
        onTap: () => context.push('/student/courses/${c.courseId}'),
        child: Padding(
          padding: const EdgeInsets.all(AppTokens.spaceS4),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(c.title, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
              const SizedBox(height: AppTokens.spaceS1),
              Text([c.teacher, ?c.batch].join(' · '), style: const TextStyle(color: AppTokens.textSecondary)),
              const SizedBox(height: AppTokens.spaceS3),
              LabeledProgress(value: c.progressPct / 100, semanticLabel: c.title),
              const SizedBox(height: AppTokens.spaceS2),
              Wrap(
                spacing: AppTokens.spaceS2,
                runSpacing: AppTokens.spaceS1,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  if (c.endDate != null) Text(l.sUntil(formatDate(context, DateTime.parse(c.endDate!))), style: const TextStyle(fontSize: AppTokens.textSm)),
                  StatusBadge(status: c.readOnly ? 'paused' : c.accessStatus, label: c.readOnly ? l.sLocked : c.accessStatus),
                ],
              ),
              if (c.readOnly) Padding(padding: const EdgeInsets.only(top: AppTokens.spaceS2), child: Text(l.sReadOnly, style: const TextStyle(fontSize: AppTokens.textSm))),
            ],
          ),
        ),
      ),
    );
  }
}
