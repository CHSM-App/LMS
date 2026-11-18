import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_tokens.g.dart';
import '../../data/models/student_models.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../presentation/providers/student_providers.dart';
import '../../widgets/app_widgets.dart';
import 'student_exams_screen.dart' show fmtPct;
import 'widgets/common.dart';

class ResultScreen extends ConsumerWidget {
  const ResultScreen({super.key, required this.attemptId});
  final String attemptId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l.sResult)),
      body: AsyncView<AttemptResult>(
        value: ref.watch(attemptResultProvider(attemptId)),
        onRetry: () => ref.invalidate(attemptResultProvider(attemptId)),
        builder: (r) => ListView(
          padding: const EdgeInsets.all(AppTokens.spaceS4),
          children: [
            Text(r.title, style: Theme.of(context).textTheme.titleLarge),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(AppTokens.spaceS4),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('${fmtPct(r.score)} / ${fmtPct(r.max)} (${fmtPct(r.pct)}%)', style: const TextStyle(fontSize: AppTokens.textXl, fontWeight: FontWeight.w800, color: AppTokens.heading)),
                    const SizedBox(height: AppTokens.spaceS2),
                    Wrap(spacing: AppTokens.spaceS3, runSpacing: AppTokens.spaceS1, crossAxisAlignment: WrapCrossAlignment.center, children: [
                      if (r.passed != null) StatusBadge(status: r.passed! ? 'approved' : 'rejected', label: r.passed! ? l.sPassed : l.sFailed),
                      if (r.rank != null) Text(l.sRank('${r.rank}', '${r.of}')),
                    ]),
                    if (r.autoSubmitted) Padding(padding: const EdgeInsets.only(top: AppTokens.spaceS2), child: Text(l.sAuto, style: const TextStyle(color: AppTokens.textSecondary))),
                  ],
                ),
              ),
            ),
            SectionTitle(l.sReview),
            for (final (i, q) in r.review.indexed)
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(AppTokens.spaceS4),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('${l.sQuestionN('${i + 1}')} · ${q.marks}', style: const TextStyle(color: AppTokens.textSecondary, fontSize: AppTokens.textSm)),
                      Text(q.text, style: const TextStyle(fontWeight: FontWeight.w700)),
                      const SizedBox(height: AppTokens.spaceS2),
                      Text('${q.correct ? '✓' : '✕'} ${l.sYourAnswer}: ${q.yourAnswer.isEmpty ? l.sNotAnswered : q.yourAnswer}'),
                      if (!q.correct) Text('${l.sCorrectAnswer}: ${q.correctAnswer}', style: const TextStyle(fontWeight: FontWeight.w600)),
                      if (q.explanation != null) Padding(padding: const EdgeInsets.only(top: AppTokens.spaceS1), child: Text(q.explanation!, style: const TextStyle(color: AppTokens.textSecondary))),
                      if (q.explanationImageUrl != null) SolutionImage(url: q.explanationImageUrl!, label: l.sSolutionImage),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
