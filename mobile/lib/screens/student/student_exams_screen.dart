import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_tokens.g.dart';
import '../../data/models/student_models.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../presentation/providers/student_providers.dart';
import '../../widgets/app_widgets.dart';
import 'widgets/common.dart';

String fmtPct(num v) => v == v.roundToDouble() ? '${v.round()}' : v.toStringAsFixed(1);

class StudentExamsScreen extends ConsumerStatefulWidget {
  const StudentExamsScreen({super.key});

  @override
  ConsumerState<StudentExamsScreen> createState() => _StudentExamsScreenState();
}

class _StudentExamsScreenState extends ConsumerState<StudentExamsScreen> {
  int? _courseId;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return Scaffold(
      body: AsyncView<StudentDashboard>(
        value: ref.watch(studentDashboardProvider),
        onRetry: () => ref.invalidate(studentDashboardProvider),
        builder: (d) {
          final courses = d.myCourses.where((c) => !c.readOnly).toList();
          if (courses.isEmpty) return EmptyState(title: l.sNoCourses, icon: Icons.quiz_outlined);
          final id = courses.any((c) => c.courseId == _courseId) ? _courseId! : courses.first.courseId;
          return Column(
            children: [
              // Which course: a swipe row of chips, instead of a big drop-down. Hidden when there is only one.
              if (courses.length > 1)
                Container(
                  decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: AppTokens.divider))),
                  child: SizedBox(
                    height: 56,
                    child: ListView(
                      scrollDirection: Axis.horizontal,
                      padding: const EdgeInsets.symmetric(horizontal: AppTokens.spaceS4),
                      children: [
                        for (final c in courses) _CourseChip(title: c.title, selected: c.courseId == id, onTap: () => setState(() => _courseId = c.courseId)),
                      ],
                    ),
                  ),
                ),
              Expanded(
                child: RefreshIndicator(
                  onRefresh: () => ref.refresh(studentExamsProvider(id).future),
                  child: AsyncView<List<ExamCard>>(
                    value: ref.watch(studentExamsProvider(id)),
                    onRetry: () => ref.invalidate(studentExamsProvider(id)),
                    builder: (exams) => exams.isEmpty ? ListView(children: [EmptyState(title: l.sNoExams, icon: Icons.quiz_outlined)]) : _ExamList(exams: exams),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _CourseChip extends StatelessWidget {
  const _CourseChip({required this.title, required this.selected, required this.onTap});

  final String title;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: AppTokens.spaceS2),
      child: Semantics(
        button: true,
        selected: selected,
        label: title,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(AppTokens.radiusPill),
          child: Center(
            child: Container(
              constraints: const BoxConstraints(maxWidth: 240),
              padding: const EdgeInsets.symmetric(horizontal: AppTokens.spaceS3, vertical: 7),
              decoration: BoxDecoration(
                color: selected ? AppTokens.brandNavy : AppTokens.surface,
                borderRadius: BorderRadius.circular(AppTokens.radiusPill),
                border: Border.all(color: selected ? AppTokens.brandNavy : AppTokens.border),
              ),
              child: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: selected ? AppTokens.brandWhite : AppTokens.text, fontSize: AppTokens.textSm, fontWeight: selected ? FontWeight.w800 : FontWeight.w600)),
            ),
          ),
        ),
      ),
    );
  }
}

/// Exams in three groups, so the ones to act on come first: To do, Done, Locked.
class _ExamList extends StatelessWidget {
  const _ExamList({required this.exams});

  final List<ExamCard> exams;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final todo = [for (final e in exams) if (!e.locked && (e.openAttemptId != null || (e.bestPct == null && e.attemptsLeft != 0))) e];
    final locked = [for (final e in exams) if (e.locked) e];
    final done = [for (final e in exams) if (!todo.contains(e) && !locked.contains(e)) e];
    Widget group(String title, List<ExamCard> list, {bool primary = false}) => list.isEmpty
        ? const SizedBox.shrink()
        : Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.only(top: AppTokens.spaceS3, bottom: AppTokens.spaceS2),
                child: Semantics(header: true, child: Text('$title · ${list.length}', style: const TextStyle(color: AppTokens.textSecondary, fontSize: AppTokens.textSm, fontWeight: FontWeight.w800))),
              ),
              for (final e in list) _ExamTile(exam: e, primary: primary),
            ],
          );
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(AppTokens.spaceS4, AppTokens.spaceS1, AppTokens.spaceS4, AppTokens.spaceS5),
      children: [group(l.sExamsTodo, todo, primary: true), group(l.sExamsDone, done), group(l.sExamsLocked, locked)],
    );
  }
}

class _ExamTile extends ConsumerWidget {
  const _ExamTile({required this.exam, this.primary = false});
  final ExamCard exam;

  /// To-do exams get the solid orange button; done ones (a retake) get the quieter outlined one.
  final bool primary;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final e = exam;
    Future<void> open() async {
      await context.push('/student/exams/${e.id}/take');
      ref.invalidate(studentExamsProvider);
    }

    // Each fact is its own piece, so a narrow phone wraps between them and never in the middle of one.
    final facts = [
      if (e.timeLimitMin != null) '${e.timeLimitMin} min',
      if (!e.locked && e.attemptsLeft != null && e.attemptsLeft! > 0) l.sAttemptsLeft('${e.attemptsLeft}'),
    ];
    final inProgress = e.openAttemptId != null;
    final canStart = !e.locked && !inProgress && e.attemptsLeft != 0;

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
                  decoration: BoxDecoration(color: e.locked ? AppTokens.disabledBg : AppTokens.brandIce, borderRadius: BorderRadius.circular(AppTokens.radiusMd)),
                  child: Icon(e.locked ? Icons.lock_outline_rounded : Icons.quiz_rounded, size: 22, color: AppTokens.text),
                ),
                const SizedBox(width: AppTokens.spaceS3),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(e.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: AppTokens.heading, fontSize: AppTokens.textBase, fontWeight: FontWeight.w800, height: 1.25)),
                      if (facts.isNotEmpty || e.bestPct != null) ...[
                        const SizedBox(height: 4),
                        Wrap(
                          spacing: AppTokens.spaceS3,
                          runSpacing: 4,
                          crossAxisAlignment: WrapCrossAlignment.center,
                          children: [
                            for (final f in facts) Text(f, style: const TextStyle(color: AppTokens.textSecondary, fontSize: AppTokens.textXs)),
                            // The best score, as a green pill (navy text on lime keeps the contrast).
                            if (e.bestPct != null)
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: AppTokens.spaceS2, vertical: 2),
                                decoration: BoxDecoration(color: AppTokens.statusApprovedBg, borderRadius: BorderRadius.circular(AppTokens.radiusPill)),
                                child: Text(l.sBest(fmtPct(e.bestPct!)), style: const TextStyle(color: AppTokens.statusApprovedFg, fontSize: AppTokens.textXs, fontWeight: FontWeight.w800)),
                              ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
            if (e.locked)
              Padding(padding: const EdgeInsets.only(top: AppTokens.spaceS2), child: Text(l.sFinalLocked, style: const TextStyle(color: AppTokens.textSecondary, fontSize: AppTokens.textSm)))
            else if (inProgress || canStart || e.lastAttemptId != null || e.attemptsLeft == 0) ...[
              const SizedBox(height: AppTokens.spaceS3),
              Row(
                children: [
                  if (inProgress)
                    AppButton(label: l.sResumeExam, variant: primary ? AppButtonVariant.primary : AppButtonVariant.compact, onPressed: open)
                  else if (canStart)
                    AppButton(label: l.sStart, variant: primary ? AppButtonVariant.primary : AppButtonVariant.compact, onPressed: open)
                  else if (e.attemptsLeft == 0)
                    Flexible(child: Text(l.sNoAttempts, style: const TextStyle(color: AppTokens.textSecondary, fontSize: AppTokens.textSm))),
                  const Spacer(),
                  if (e.lastAttemptId != null) TextButton(onPressed: () => context.push('/student/attempts/${e.lastAttemptId}/result'), child: Text(l.sViewResult)),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}
