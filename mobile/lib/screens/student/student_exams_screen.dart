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
          if (courses.isEmpty) return EmptyState(title: l.sNoCourses);
          final id = courses.any((c) => c.courseId == _courseId) ? _courseId! : courses.first.courseId;
          return RefreshIndicator(
            onRefresh: () => ref.refresh(studentExamsProvider(id).future),
            child: ListView(
              padding: const EdgeInsets.all(AppTokens.spaceS4),
              children: [
                DropdownButtonFormField<int>(
                  initialValue: id,
                  decoration: InputDecoration(labelText: l.sChooseCourse),
                  items: [for (final c in courses) DropdownMenuItem(value: c.courseId, child: Text(c.title, overflow: TextOverflow.ellipsis))],
                  onChanged: (v) => setState(() => _courseId = v),
                ),
                const SizedBox(height: AppTokens.spaceS3),
                AsyncView<List<ExamCard>>(
                  value: ref.watch(studentExamsProvider(id)),
                  onRetry: () => ref.invalidate(studentExamsProvider(id)),
                  builder: (exams) => exams.isEmpty ? EmptyState(title: l.sNoExams) : Column(children: [for (final e in exams) _ExamTile(exam: e)]),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _ExamTile extends ConsumerWidget {
  const _ExamTile({required this.exam});
  final ExamCard exam;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final e = exam;
    Future<void> open() async {
      await context.push('/student/exams/${e.id}/take');
      ref.invalidate(studentExamsProvider);
    }

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppTokens.spaceS4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(e.title, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
            if (e.timeLimitMin != null) Text('${e.timeLimitMin} min', style: const TextStyle(color: AppTokens.textSecondary)),
            if (e.bestPct != null) Text(l.sBest(fmtPct(e.bestPct!))),
            const SizedBox(height: AppTokens.spaceS2),
            if (e.locked)
              Text(l.sFinalLocked, style: const TextStyle(color: AppTokens.textSecondary))
            else if (e.openAttemptId != null)
              AppButton(label: l.sResumeExam, variant: AppButtonVariant.compact, onPressed: open)
            else if (e.attemptsLeft == 0)
              Text(l.sNoAttempts, style: const TextStyle(color: AppTokens.textSecondary))
            else
              AppButton(label: l.sStart, variant: AppButtonVariant.compact, onPressed: open),
            if (!e.locked && e.attemptsLeft != null && e.attemptsLeft! > 0) Text(l.sAttemptsLeft('${e.attemptsLeft}'), style: const TextStyle(fontSize: AppTokens.textSm)),
            if (e.lastAttemptId != null)
              Align(alignment: Alignment.centerLeft, child: TextButton(onPressed: () => context.push('/student/attempts/${e.lastAttemptId}/result'), child: Text(l.sViewResult))),
          ],
        ),
      ),
    );
  }
}
