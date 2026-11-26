import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_tokens.g.dart';
import '../../data/models/student_models.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../presentation/providers/student_providers.dart';
import '../../widgets/app_widgets.dart';
import '../../widgets/course_card.dart';
import 'widgets/common.dart';

/// How many live classes the dashboard lists before pointing to the Classes tab (same as the website).
const _liveOnDash = 4;

/// Same order as the website dashboard: next up, live classes, latest exam, my courses.
/// [onOpenClasses] / [onOpenExams] switch to those tabs; without them the "all" links are hidden.
class StudentDashboardScreen extends ConsumerWidget {
  const StudentDashboardScreen({super.key, this.onOpenClasses, this.onOpenExams});

  final VoidCallback? onOpenClasses;
  final VoidCallback? onOpenExams;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    return RefreshIndicator(
      onRefresh: () => ref.refresh(studentDashboardProvider.future),
      child: AsyncView<StudentDashboard>(
        value: ref.watch(studentDashboardProvider),
        onRetry: () => ref.invalidate(studentDashboardProvider),
        builder: (d) {
          // A class that is running now comes first, then the rest by start time.
          int rank(LiveClassItem x) => x.stage == 'live' ? 0 : 1;
          final live = [...d.upcomingLiveClasses]..sort((a, b) => rank(a) != rank(b) ? rank(a) - rank(b) : a.startsAt.compareTo(b.startsAt));
          return ListView(
            padding: const EdgeInsets.fromLTRB(AppTokens.spaceS4, AppTokens.spaceS2, AppTokens.spaceS4, AppTokens.spaceS4),
            children: [
              // Hero: greeting and the one thing to do next, on navy like the web's welcome panel.
              Container(
                padding: const EdgeInsets.all(AppTokens.spaceS3),
                decoration: BoxDecoration(color: AppTokens.brandNavy, borderRadius: BorderRadius.circular(AppTokens.radiusLg + 4)),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (d.nextUp != null) ...[
                      Text(l.sNextUp, style: const TextStyle(color: AppTokens.navTextMuted, fontSize: AppTokens.textXs, fontWeight: FontWeight.w700)),
                      const SizedBox(height: 2),
                      Text(d.nextUp!.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: AppTokens.navText, fontSize: AppTokens.textBase, fontWeight: FontWeight.w700, height: 1.3)),
                      const SizedBox(height: AppTokens.spaceS2),
                      Semantics(
                        label: d.nextUp!.title,
                        value: '${d.nextUp!.progressPct}%',
                        child: Row(
                          children: [
                            Expanded(
                              child: ClipRRect(
                                borderRadius: BorderRadius.circular(AppTokens.radiusPill),
                                child: LinearProgressIndicator(value: (d.nextUp!.progressPct / 100).clamp(0, 1).toDouble(), minHeight: 6, backgroundColor: AppTokens.navActiveBg, color: AppTokens.progressFill),
                              ),
                            ),
                            const SizedBox(width: AppTokens.spaceS3),
                            Text('${d.nextUp!.progressPct}%', style: const TextStyle(color: AppTokens.navText, fontSize: AppTokens.textSm, fontWeight: FontWeight.w800)),
                          ],
                        ),
                      ),
                      const SizedBox(height: AppTokens.spaceS2),
                      AppButton(label: l.sContinue, expand: true, onPressed: () => context.push('/student/courses/${d.nextUp!.courseId}')),
                    ],
                  ],
                ),
              ),

              // 1. Live classes
              _Header(title: l.sLiveClasses, action: live.length > _liveOnDash && onOpenClasses != null ? l.sAllClasses(live.length) : null, onAction: onOpenClasses),
              if (live.isEmpty)
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(AppTokens.spaceS3),
                    child: Row(
                      children: [
                        const Icon(Icons.event_available_rounded, color: AppTokens.textSecondary),
                        const SizedBox(width: AppTokens.spaceS3),
                        Expanded(child: Text(l.sNoUpcoming, style: Theme.of(context).textTheme.bodySmall)),
                      ],
                    ),
                  ),
                ),
              for (final c in live.take(_liveOnDash))
                LiveClassTile(
                  liveClassId: c.id,
                  topic: c.topic,
                  subtitle: [if (c.stage == 'live') l.sLiveNow, c.course, formatDateTime(context, c.startsAt)].join(' · '),
                  meetLink: c.canJoin ? c.meetLink : null,
                  waitingForLink: c.waitingForLink,
                ),

              // 2. Latest exam, on its own
              if (d.latestExam != null) ...[
                _Header(title: l.sLatestExam),
                _LatestExamCard(exam: d.latestExam!, onAll: onOpenExams),
              ],

              // 3. My courses
              _Header(title: l.sMyCourses),
              if (d.myCourses.isEmpty) EmptyState(title: l.sNoCourses, actionLabel: l.sBrowse, onAction: () => context.push('/courses')),
              for (final c in d.myCourses) _CourseCard(course: c),

              _Discover(),
              if (d.requests.isNotEmpty) ...[
                _Header(title: l.sRequests),
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
          );
        },
      ),
    );
  }
}

/// Section title with an optional "all" link on the right.
class _Header extends StatelessWidget {
  const _Header({required this.title, this.action, this.onAction});

  final String title;
  final String? action;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: AppTokens.spaceS4, bottom: AppTokens.spaceS1),
      child: Row(
        children: [
          Expanded(child: Semantics(header: true, child: Text(title, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800, fontSize: 17)))),
          if (action != null) TextButton(onPressed: onAction, child: Text(action!)),
        ],
      ),
    );
  }
}

/// The newest exam across my courses: its state, and Start / Resume or the result. Same rules as the website card.
class _LatestExamCard extends StatelessWidget {
  const _LatestExamCard({required this.exam, this.onAll});

  final LatestExam exam;
  final VoidCallback? onAll;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final e = exam;
    final state = e.closed ? 'closed' : e.notOpen ? 'notOpen' : e.status;
    final (badge, label) = switch (state) {
      'closed' => ('rejected', l.sExamClosed),
      'notOpen' => ('draft', l.sExamNotOpen),
      'inProgress' => ('pending', l.sExamInProgress),
      'completed' => ('approved', l.sExamCompleted),
      _ => ('draft', l.sExamNotStarted),
    };
    final canRetry = e.status == 'completed' && e.attemptsLeft != 0 && e.canStart;
    void take() => context.push('/student/exams/${e.id}/take');
    final meta = [e.course, if (e.timeLimitMin != null) '${e.timeLimitMin} min'].where((x) => x.isNotEmpty).join(' · ');
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppTokens.spaceS3),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(color: AppTokens.brandIce, borderRadius: BorderRadius.circular(AppTokens.radiusMd)),
                  child: const Icon(Icons.quiz_rounded, size: 22, color: AppTokens.text),
                ),
                const SizedBox(width: AppTokens.spaceS3),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(e.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: AppTokens.heading, fontSize: AppTokens.textBase, fontWeight: FontWeight.w800, height: 1.25)),
                      if (meta.isNotEmpty) Text(meta, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: AppTokens.textSecondary, fontSize: AppTokens.textXs)),
                      if (e.bestPct != null) Text(l.sBest(fmtPctShort(e.bestPct!)), style: const TextStyle(color: AppTokens.text, fontSize: AppTokens.textXs, fontWeight: FontWeight.w700)),
                    ],
                  ),
                ),
                const SizedBox(width: AppTokens.spaceS2),
                StatusBadge(status: badge, label: label),
              ],
            ),
            const SizedBox(height: AppTokens.spaceS2),
            Wrap(
              spacing: AppTokens.spaceS2,
              runSpacing: AppTokens.spaceS1,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                if (e.status != 'completed' && e.canStart) AppButton(label: e.status == 'inProgress' ? l.sResumeExam : l.sStart, variant: AppButtonVariant.compact, onPressed: take),
                if (e.status == 'completed' && e.lastAttemptId != null)
                  AppButton(label: l.sViewResult, variant: AppButtonVariant.secondary, onPressed: () => context.push('/student/attempts/${e.lastAttemptId}/result')),
                if (canRetry) AppButton(label: l.sStart, variant: AppButtonVariant.compact, onPressed: take),
                if (onAll != null) TextButton(onPressed: onAll, child: Text(l.sAllExams)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// 82 or 82.5, no trailing ".0".
String fmtPctShort(num v) => v == v.roundToDouble() ? '${v.round()}' : v.toStringAsFixed(1);

/// "Explore courses": a swipe row of the public catalogue, so finding something new is on the first screen.
/// It stays out of the way (nothing shown) while loading, on an error or when there are no courses.
class _Discover extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final courses = ref.watch(catalogProvider('')).valueOrNull;
    if (courses == null || courses.isEmpty) return const SizedBox.shrink();
    // Courses I already joined or asked to join are not "new", so they are left out of Explore.
    final mine = ref.watch(myEnrollmentsProvider);
    final shown = courses.where((c) => !mine.containsKey(c.slug)).take(8).toList();
    if (shown.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _Header(title: l.sDiscover, action: l.pSeeAll, onAction: () => context.push('/courses')),
        SizedBox(
          height: CourseCarouselCard.height,
          child: ListView.separated(
            // Bleeds to the screen edge so it is clearly a swipe row.
            clipBehavior: Clip.none,
            scrollDirection: Axis.horizontal,
            itemCount: shown.length,
            separatorBuilder: (_, _) => const SizedBox(width: AppTokens.spaceS3),
            itemBuilder: (_, i) => CourseCarouselCard(course: shown[i], onTap: () => context.push('/courses/${shown[i].slug}')),
          ),
        ),
      ],
    );
  }
}

/// One enrolled course, compact: cover, title, teacher and batch, progress, and the end date.
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
          padding: const EdgeInsets.all(AppTokens.spaceS3),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const CoverBadge(size: 44),
                  const SizedBox(width: AppTokens.spaceS3),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(c.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: AppTokens.heading, fontSize: AppTokens.textBase, fontWeight: FontWeight.w800, height: 1.25)),
                        const SizedBox(height: 2),
                        Text([c.teacher, ?c.batch].join(' · '), maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: AppTokens.textXs, color: AppTokens.textSecondary)),
                      ],
                    ),
                  ),
                  if (c.readOnly) ...[
                    const SizedBox(width: AppTokens.spaceS2),
                    StatusBadge(status: 'paused', label: l.sLocked),
                  ],
                ],
              ),
              const SizedBox(height: AppTokens.spaceS3),
              LabeledProgress(value: c.progressPct / 100, semanticLabel: c.title),
              if (c.endDate != null)
                Padding(
                  padding: const EdgeInsets.only(top: AppTokens.spaceS1),
                  child: Text(l.sUntil(formatDate(context, DateTime.parse(c.endDate!))), style: const TextStyle(fontSize: AppTokens.textXs, color: AppTokens.textSecondary)),
                ),
              if (c.readOnly) Padding(padding: const EdgeInsets.only(top: AppTokens.spaceS2), child: Text(l.sReadOnly, style: const TextStyle(fontSize: AppTokens.textXs))),
            ],
          ),
        ),
      ),
    );
  }
}
