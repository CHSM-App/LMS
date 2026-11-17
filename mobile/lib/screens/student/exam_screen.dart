import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_tokens.g.dart';
import '../../data/models/student_models.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../presentation/providers/student_providers.dart';
import '../../presentation/viewModels/exam_viewmodel.dart';
import '../../widgets/app_widgets.dart';

String _clock(Duration d) => '${d.inMinutes}:${(d.inSeconds % 60).toString().padLeft(2, '0')}';

/// Exam attempt. Leaving and reopening (even after the app is killed) resumes the same attempt
/// with the time the server says is left.
class ExamScreen extends ConsumerWidget {
  const ExamScreen({super.key, required this.examId});
  final int examId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final s = ref.watch(examProvider(examId));
    final vm = ref.read(examProvider(examId).notifier);
    ref.listen<ExamState>(examProvider(examId), (prev, next) {
      if (next.submitted && !(prev?.submitted ?? false) && next.paper != null) {
        context.pushReplacement('/student/attempts/${next.paper!.attemptId}/result');
      }
    });

    final paper = s.paper;
    if (paper == null) {
      return Scaffold(appBar: AppBar(), body: s.error != null ? EmptyState(title: s.error!) : const Center(child: CircularProgressIndicator()));
    }
    final low = s.remaining != null && s.remaining! < const Duration(minutes: 1);
    return Scaffold(
      appBar: AppBar(
        title: Text(paper.title, overflow: TextOverflow.ellipsis),
        actions: [
          if (s.remaining != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppTokens.spaceS4),
              child: Center(
                child: Semantics(
                  label: l.sTimeLeft(_clock(s.remaining!)),
                  liveRegion: low,
                  child: Text(_clock(s.remaining!), style: TextStyle(fontSize: AppTokens.textLg, fontWeight: FontWeight.w800, color: low ? AppTokens.errorText : AppTokens.heading, fontFeatures: const [FontFeature.tabularFigures()])),
                ),
              ),
            ),
        ],
      ),
      body: Column(
        children: [
          Container(
            width: double.infinity,
            color: AppTokens.surface,
            padding: const EdgeInsets.symmetric(horizontal: AppTokens.spaceS4, vertical: AppTokens.spaceS2),
            child: Wrap(
              spacing: AppTokens.spaceS4,
              children: [
                Text(l.sAnswered('${s.answeredCount}', paper.questions.length)),
                Semantics(
                  liveRegion: true,
                  child: Text(
                    switch (s.saveStatus) {
                      SaveStatus.saving => l.sSaving,
                      SaveStatus.saved => l.sSaved,
                      SaveStatus.offline => l.sOffline,
                      SaveStatus.idle => '',
                    },
                    style: TextStyle(color: s.saveStatus == SaveStatus.offline ? AppTokens.errorText : AppTokens.textSecondary, fontWeight: FontWeight.w600),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.all(AppTokens.spaceS4),
              itemCount: paper.questions.length + 1,
              itemBuilder: (context, i) {
                if (i == paper.questions.length) {
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: AppTokens.spaceS4),
                    child: AppButton(label: l.sSubmit, loading: s.submitting, expand: true, onPressed: () => _confirm(context, l, s, vm)),
                  );
                }
                final q = paper.questions[i];
                return _QuestionCard(index: i, q: q, value: s.answers[q.id], feedback: s.feedback[q.id], onChanged: (a) => vm.answer(q.id, a));
              },
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _confirm(BuildContext context, AppLocalizations l, ExamState s, ExamViewModel vm) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: Text(l.sSubmitTitle),
        content: Text(l.sSubmitBody('${s.answeredCount}', s.paper!.questions.length)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: Text(l.sKeepGoing)),
          TextButton(onPressed: () => Navigator.pop(c, true), child: Text(l.sSubmitNow)),
        ],
      ),
    );
    if (ok == true) await vm.submit();
  }
}

class _QuestionCard extends StatefulWidget {
  const _QuestionCard({required this.index, required this.q, required this.value, required this.feedback, required this.onChanged});
  final int index;
  final ExamQuestion q;
  final Json? value;
  final PracticeFeedback? feedback;
  final ValueChanged<Json> onChanged;

  @override
  State<_QuestionCard> createState() => _QuestionCardState();
}

class _QuestionCardState extends State<_QuestionCard> {
  late final _text = TextEditingController(text: (widget.value?['text'] ?? '') as String);

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final q = widget.q;
    final v = widget.value;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppTokens.spaceS4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('${l.sQuestionN('${widget.index + 1}')} · ${q.marks}', style: const TextStyle(color: AppTokens.textSecondary, fontSize: AppTokens.textSm)),
            const SizedBox(height: AppTokens.spaceS2),
            Text(q.text, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: AppTokens.spaceS3),
            if (q.type == 'mcq' || q.type == 'true_false')
              RadioGroup<int>(
                groupValue: v?['optionId'] as int?,
                onChanged: (id) => id == null ? null : widget.onChanged({'optionId': id}),
                child: Column(children: [for (final o in q.options) RadioListTile<int>(value: o.id, title: Text(o.text))]),
              ),
            if (q.type == 'multi_correct')
              for (final o in q.options)
                CheckboxListTile(
                  value: ((v?['optionIds'] as List?) ?? const []).contains(o.id),
                  title: Text(o.text),
                  onChanged: (on) {
                    final ids = [...((v?['optionIds'] as List?) ?? const []).cast<int>()];
                    on == true ? ids.add(o.id) : ids.remove(o.id);
                    widget.onChanged({'optionIds': ids});
                  },
                ),
            if (q.type == 'fill_blank') AppTextField(label: l.sYourAnswer, controller: _text, onChanged: (t) => widget.onChanged({'text': t})),
            if (widget.feedback != null)
              AppBanner(
                kind: widget.feedback!.correct ? 'success' : 'error',
                message: '${widget.feedback!.correct ? l.sCorrect : l.sWrong}${widget.feedback!.explanation == null ? '' : ' — ${widget.feedback!.explanation}'}',
              ),
          ],
        ),
      ),
    );
  }
}
