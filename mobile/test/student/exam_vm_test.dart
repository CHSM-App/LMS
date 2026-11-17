import 'package:fake_async/fake_async.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lms_app/core/network/api_client.dart';
import 'package:lms_app/presentation/viewModels/exam_viewmodel.dart';

import 'fake_student_repo.dart';

void main() {
  final t0 = DateTime.utc(2026, 6, 15, 9);

  ExamViewModel make(FakeStudentRepo repo, DateTime Function() now) => ExamViewModel(repo, 9, now: now);

  test('resume after an app restart: same attempt, saved answers, time left from the server deadline', () {
    fakeAsync((async) {
      var now = t0;
      final repo = FakeStudentRepo(paper: paperFixture(deadlineAt: t0.add(const Duration(minutes: 5)), answers: {1: {'optionId': 12}}));
      final vm = make(repo, () => now);
      vm.start();
      async.flushMicrotasks();
      expect(vm.state.paper!.attemptId, 'a-1');
      expect(vm.state.answers[1], {'optionId': 12});
      expect(vm.state.remaining, const Duration(minutes: 5));
      now = now.add(const Duration(seconds: 30));
      async.elapse(const Duration(seconds: 1));
      expect(vm.state.remaining, const Duration(minutes: 4, seconds: 30));
      vm.dispose();
    });
  });

  test('answers autosave after a short pause; only the last change is sent', () {
    fakeAsync((async) {
      final repo = FakeStudentRepo(paper: paperFixture(deadlineAt: t0.add(const Duration(minutes: 10))));
      final vm = make(repo, () => t0);
      vm.start();
      async.flushMicrotasks();
      vm.answer(2, {'text': 'Pun'});
      vm.answer(2, {'text': 'Mumbai'});
      expect(vm.state.saveStatus, SaveStatus.saving);
      async.elapse(const Duration(seconds: 1));
      expect(repo.saved, ['2:Mumbai']);
      expect(vm.state.saveStatus, SaveStatus.saved);
      vm.dispose();
    });
  });

  test('offline: shows the notice and retries in memory with exponential backoff until it is sent once', () {
    fakeAsync((async) {
      final repo = FakeStudentRepo(paper: paperFixture(deadlineAt: t0.add(const Duration(minutes: 30))))..saveFailures = 3;
      final vm = make(repo, () => t0);
      vm.start();
      async.flushMicrotasks();
      vm.answer(1, {'optionId': 12});
      async.elapse(const Duration(milliseconds: 700)); // first try fails
      expect(vm.state.saveStatus, SaveStatus.offline);
      expect(repo.saved, isEmpty);
      async.elapse(const Duration(milliseconds: 1100)); // retry after 1s fails
      expect(repo.saved, isEmpty);
      async.elapse(const Duration(milliseconds: 2100)); // retry after 2s fails
      expect(repo.saved, isEmpty);
      async.elapse(const Duration(milliseconds: 4100)); // retry after 4s succeeds
      expect(repo.saved, ['1:12']);
      expect(vm.state.saveStatus, SaveStatus.saved);
      async.elapse(const Duration(seconds: 60));
      expect(repo.saved, ['1:12'], reason: 'no duplicate sends');
      vm.dispose();
    });
  });

  test('a newer answer replaces the unsent one for the same question', () {
    fakeAsync((async) {
      final repo = FakeStudentRepo(paper: paperFixture(deadlineAt: t0.add(const Duration(minutes: 30))))..saveFailures = 1;
      final vm = make(repo, () => t0);
      vm.start();
      async.flushMicrotasks();
      vm.answer(1, {'optionId': 11});
      async.elapse(const Duration(milliseconds: 700));
      vm.answer(1, {'optionId': 12});
      async.elapse(const Duration(seconds: 5));
      expect(repo.saved, ['1:12']);
      vm.dispose();
    });
  });

  test('submits automatically when the server deadline passes', () {
    fakeAsync((async) {
      var now = t0;
      final repo = FakeStudentRepo(paper: paperFixture(deadlineAt: t0.add(const Duration(seconds: 3))));
      final vm = make(repo, () => now);
      vm.start();
      async.flushMicrotasks();
      now = now.add(const Duration(seconds: 4));
      async.elapse(const Duration(seconds: 1));
      expect(repo.submits, 1);
      expect(vm.state.submitted, isTrue);
      async.elapse(const Duration(seconds: 5));
      expect(repo.submits, 1, reason: 'submit only once');
      vm.dispose();
    });
  });

  test('TIME_UP from the server ends the attempt and goes to the result', () {
    fakeAsync((async) {
      final repo = FakeStudentRepo(paper: paperFixture(deadlineAt: t0.add(const Duration(minutes: 10))))
        ..saveError = const ApiException(409, 'Time is up', 'TIME_UP');
      final vm = make(repo, () => t0);
      vm.start();
      async.flushMicrotasks();
      vm.answer(1, {'optionId': 12});
      async.elapse(const Duration(seconds: 1));
      expect(vm.state.submitted, isTrue);
      vm.dispose();
    });
  });

  test('practice mode shows feedback after each answer', () {
    fakeAsync((async) {
      final repo = FakeStudentRepo(paper: paperFixture(mode: 'practice'));
      final vm = make(repo, () => t0);
      vm.start();
      async.flushMicrotasks();
      expect(vm.state.remaining, isNull);
      vm.answer(1, {'optionId': 12});
      async.elapse(const Duration(seconds: 1));
      expect(vm.state.feedback[1]!.correct, isTrue);
      vm.dispose();
    });
  });
}
