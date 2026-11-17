import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_client.dart';
import '../../data/models/student_models.dart';
import '../../data/repositories/student_repository.dart';

enum SaveStatus { idle, saving, saved, offline }

@immutable
class ExamState {
  const ExamState({this.paper, this.answers = const {}, this.feedback = const {}, this.saveStatus = SaveStatus.idle, this.remaining, this.submitted = false, this.submitting = false, this.error});
  final ExamPaper? paper;
  final Map<int, Json> answers;
  final Map<int, PracticeFeedback> feedback;
  final SaveStatus saveStatus;
  final Duration? remaining; // null for untimed (practice) attempts
  final bool submitted;
  final bool submitting;
  final String? error;

  int get answeredCount => answers.length;

  ExamState copyWith({ExamPaper? paper, Map<int, Json>? answers, Map<int, PracticeFeedback>? feedback, SaveStatus? saveStatus, Duration? remaining, bool? submitted, bool? submitting, String? error}) =>
      ExamState(
        paper: paper ?? this.paper,
        answers: answers ?? this.answers,
        feedback: feedback ?? this.feedback,
        saveStatus: saveStatus ?? this.saveStatus,
        remaining: remaining ?? this.remaining,
        submitted: submitted ?? this.submitted,
        submitting: submitting ?? this.submitting,
        error: error ?? this.error,
      );
}

/// Runs one exam attempt. The server deadline drives the timer (so a restarted app resumes with the
/// right time left), answers autosave after a short pause, and unsent answers retry in memory with
/// exponential backoff (Flutter_ARCHITECTURE §15.11). The sqflite outbox is greyed out (DECISIONS.md).
class ExamViewModel extends StateNotifier<ExamState> {
  ExamViewModel(this._repo, this.examId, {DateTime Function()? now, this.debounce = const Duration(milliseconds: 600)})
      : _now = now ?? DateTime.now,
        super(const ExamState());

  final StudentRepository _repo;
  final int examId;
  final Duration debounce;
  final DateTime Function() _now;

  final _debouncers = <int, Timer>{};
  final _unsent = <int, Json>{};
  Timer? _ticker;
  Timer? _retry;
  int _retryStep = 0;
  bool _inFlight = false;

  static const maxBackoff = Duration(seconds: 30);

  Future<void> start() async {
    try {
      final paper = await _repo.startAttempt(examId);
      if (!mounted) return;
      state = state.copyWith(paper: paper, answers: Map.of(paper.answers), remaining: _left(paper));
      if (paper.deadlineAt != null) _ticker = Timer.periodic(const Duration(seconds: 1), (_) => _tick());
    } on ApiException catch (e) {
      if (mounted) state = state.copyWith(error: e.message);
    }
  }

  Duration? _left(ExamPaper p) {
    if (p.deadlineAt == null) return null;
    final d = p.deadlineAt!.difference(_now());
    return d.isNegative ? Duration.zero : d;
  }

  void _tick() {
    final p = state.paper;
    if (p == null || state.submitted) return;
    final left = _left(p)!;
    state = state.copyWith(remaining: left);
    if (left == Duration.zero) submit();
  }

  void answer(int questionId, Json value) {
    if (state.submitted) return;
    state = state.copyWith(answers: {...state.answers, questionId: value}, saveStatus: SaveStatus.saving);
    _unsent[questionId] = value; // a newer answer replaces an unsent older one
    _debouncers[questionId]?.cancel();
    _debouncers[questionId] = Timer(debounce, _flush);
  }

  Future<void> _flush() async {
    if (_inFlight || _unsent.isEmpty || state.submitted) return;
    _inFlight = true;
    try {
      while (_unsent.isNotEmpty && mounted && !state.submitted) {
        final qid = _unsent.keys.first;
        final value = _unsent[qid]!;
        final fb = await _repo.saveAnswer(state.paper!.attemptId, qid, value);
        if (identical(_unsent[qid], value)) _unsent.remove(qid);
        if (!mounted) return;
        if (fb != null) state = state.copyWith(feedback: {...state.feedback, qid: fb});
      }
      _retryStep = 0;
      if (mounted && !state.submitted) state = state.copyWith(saveStatus: _unsent.isEmpty ? SaveStatus.saved : SaveStatus.saving);
    } on ApiException catch (e) {
      if (!mounted) return;
      if (e.code == 'TIME_UP' || e.code == 'ATTEMPT_SUBMITTED') {
        _finish();
        return;
      }
      state = state.copyWith(saveStatus: SaveStatus.offline);
      _scheduleRetry();
    } finally {
      _inFlight = false;
    }
  }

  void _scheduleRetry() {
    _retry?.cancel();
    final ms = math.min(maxBackoff.inMilliseconds, 1000 * (1 << math.min(_retryStep, 5)));
    _retryStep++;
    _retry = Timer(Duration(milliseconds: ms), _flush);
  }

  /// Sends what's unsent (best effort), then submits. Safe to call more than once.
  Future<void> submit() async {
    if (state.submitted || state.submitting || state.paper == null) return;
    state = state.copyWith(submitting: true);
    for (final t in _debouncers.values) {
      t.cancel();
    }
    if (_unsent.isNotEmpty) await _flush();
    try {
      await _repo.submit(state.paper!.attemptId);
    } on ApiException catch (e) {
      // Already submitted / time up: the server has the attempt; anything else, the server auto-submits at the deadline.
      if (e.code != 'ATTEMPT_SUBMITTED' && e.code != 'TIME_UP' && !e.isNetwork && mounted) state = state.copyWith(error: e.message);
    }
    _finish();
  }

  void _finish() {
    _ticker?.cancel();
    _retry?.cancel();
    if (mounted) state = state.copyWith(submitted: true, submitting: false);
  }

  @override
  void dispose() {
    _ticker?.cancel();
    _retry?.cancel();
    for (final t in _debouncers.values) {
      t.cancel();
    }
    super.dispose();
  }
}
