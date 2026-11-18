const { reset, closeAll, clock, createUser } = require('../../setup/helpers');
const { world, asStudent, query, one, T } = require('../../setup/student');
const { activeEnrollment } = require('../../setup/operations');

beforeEach(reset);
afterAll(closeAll);

const mcq = (n, difficulty = 'easy') => ({
  type: 'mcq', text: `Q${n}`, difficulty, marks: 1, negativeMarks: 0.25, explanation: `Because ${n}`,
  options: [{ text: 'wrong', isCorrect: false }, { text: 'right', isCorrect: true }],
});

async function examWorld(over = {}) {
  const w = await world();
  for (let i = 0; i < 6; i += 1) await w.t.post(`/api/v1/teacher/modules/${w.moduleId}/questions`, mcq(i));
  const body = {
    title: 'Unit Test 1', scope: 'module', moduleIds: [w.moduleId], mode: 'mock', selection: 'random', randomMix: [{ moduleId: w.moduleId, easy: 4, medium: 0, hard: 0 }],
    category: 'unit_test_1', weightage: 20, negativeMarking: true, timeLimitMin: 30, passingPct: 50, shuffleQuestions: true, shuffleOptions: true, attemptLimit: 1, batchIds: [], ...over,
  };
  const exam = (await w.t.post(`/api/v1/teacher/courses/${w.courseId}/exams`, body)).body.data;
  const pub = await w.t.post(`/api/v1/teacher/exams/${exam.id}/publish`);
  if (pub.status !== 200) throw new Error(JSON.stringify(pub.body));
  return { ...w, exam };
}

const rightOption = async (questionId) => (await one('SELECT option_id FROM dbo.question_options WHERE question_id = @q AND is_correct = 1', { q: T.int(questionId) })).option_id;

test('start hides answers; starting again resumes the same paper in the same order', async () => {
  clock.set(new Date('2026-06-15T03:00:00Z'));
  const w = await examWorld();
  const a = await w.s.post(`/api/v1/student/exams/${w.exam.id}/attempts`);
  expect(a.status).toBe(201);
  expect(a.body.data.questions).toHaveLength(4);
  expect(JSON.stringify(a.body.data)).not.toMatch(/isCorrect|acceptedAnswers|explanation/);
  expect(new Date(a.body.data.deadlineAt) - new Date('2026-06-15T03:00:00Z')).toBe(30 * 60000);
  const again = await w.s.post(`/api/v1/student/exams/${w.exam.id}/attempts`);
  expect(again.body.data.attemptId).toBe(a.body.data.attemptId);
  expect(again.body.data.questions.map((q) => q.id)).toEqual(a.body.data.questions.map((q) => q.id));
  expect(again.body.data.questions.map((q) => q.options.map((o) => o.id))).toEqual(a.body.data.questions.map((q) => q.options.map((o) => o.id)));
});

test('autosave keeps the last answer; submit scores with negative marking; result review and rank', async () => {
  clock.set(new Date('2026-06-15T03:00:00Z'));
  const w = await examWorld();
  const a = (await w.s.post(`/api/v1/student/exams/${w.exam.id}/attempts`)).body.data;
  const [q1, q2, q3] = a.questions;
  const wrong = q2.options.find((o) => o.text === 'wrong').id;
  await w.s.put(`/api/v1/student/attempts/${a.attemptId}/answers/${q1.id}`, { optionId: wrong });
  await w.s.put(`/api/v1/student/attempts/${a.attemptId}/answers/${q1.id}`, { optionId: await rightOption(q1.id) });
  await w.s.put(`/api/v1/student/attempts/${a.attemptId}/answers/${q2.id}`, { optionId: wrong });
  await w.s.put(`/api/v1/student/attempts/${a.attemptId}/answers/${q3.id}`, { optionId: await rightOption(q3.id) });
  expect((await w.s.get(`/api/v1/student/attempts/${a.attemptId}/result`)).status).toBe(403);
  const sub = await w.s.post(`/api/v1/student/attempts/${a.attemptId}/submit`);
  expect(sub.status).toBe(200);
  expect(sub.body.data).toMatchObject({ score: 1.75, max: 4, passed: false });
  const r = await w.s.get(`/api/v1/student/attempts/${a.attemptId}/result`);
  expect(r.body.data).toMatchObject({ score: 1.75, max: 4, rank: 1 });
  const review = r.body.data.review.find((x) => x.questionId === q2.id);
  expect(review).toMatchObject({ correct: false, marks: -0.25, explanation: expect.stringMatching(/^Because/) });
  expect(review.correctAnswer.optionIds).toHaveLength(1);
  const other = await asStudent(await createUser({ role: 'student' }));
  expect((await other.get(`/api/v1/student/attempts/${a.attemptId}/result`)).status).toBe(404);
  const next = await w.s.post(`/api/v1/student/exams/${w.exam.id}/attempts`);
  expect(next.status).toBe(403);
  expect(next.body.error).toBe('No attempts left');
});

test('after the deadline, saving is refused and the attempt is auto-submitted with earlier answers', async () => {
  clock.set(new Date('2026-06-15T03:00:00Z'));
  const w = await examWorld();
  const a = (await w.s.post(`/api/v1/student/exams/${w.exam.id}/attempts`)).body.data;
  const [q1, q2] = a.questions;
  await w.s.put(`/api/v1/student/attempts/${a.attemptId}/answers/${q1.id}`, { optionId: await rightOption(q1.id) });
  clock.set(new Date('2026-06-15T03:31:00Z'));
  const late = await w.s.put(`/api/v1/student/attempts/${a.attemptId}/answers/${q2.id}`, { optionId: await rightOption(q2.id) });
  expect(late.status).toBe(409);
  expect(late.body.error).toBe('Time is up');
  const row = await one('SELECT score, auto_submitted, submitted_at FROM dbo.exam_attempts WHERE public_id = @p', { p: T.uuid(a.attemptId) });
  expect(row).toMatchObject({ auto_submitted: true, score: 1 });
  const { runAutoSubmit } = require('../../../src/services/attempt.service');
  expect(await runAutoSubmit()).toBe(0);
});

test('random papers differ between students; batch targeting hides the exam from other batches', async () => {
  clock.set(new Date('2026-06-15T03:00:00Z'));
  const w = await examWorld();
  const papers = new Set();
  for (let i = 0; i < 5; i += 1) {
    const u = await createUser({ role: 'student' });
    await activeEnrollment(w.courseId, w.t.user.user_id, u.user_id, w.batch.id);
    const s = await asStudent(u);
    papers.add((await s.post(`/api/v1/student/exams/${w.exam.id}/attempts`)).body.data.questions.map((q) => q.id).sort().join(','));
  }
  expect(papers.size).toBeGreaterThan(1);
  const evening = (await w.t.post(`/api/v1/teacher/courses/${w.courseId}/batches`, { name: 'Evening', startDate: '2026-01-01' })).body.data;
  const ex2 = (await w.t.post(`/api/v1/teacher/courses/${w.courseId}/exams`, { title: 'Evening only', scope: 'module', moduleIds: [w.moduleId], mode: 'practice', selection: 'random', randomMix: [{ moduleId: w.moduleId, easy: 1 }], category: 'practice', batchIds: [evening.id] })).body.data;
  await w.t.post(`/api/v1/teacher/exams/${ex2.id}/publish`);
  const list = await w.s.get(`/api/v1/student/courses/${w.courseId}/exams`);
  expect(list.body.data.map((e) => e.title)).toEqual(['Unit Test 1']);
  expect((await w.s.post(`/api/v1/student/exams/${ex2.id}/attempts`)).status).toBe(404);
});

test('practice shows correctness straight away; Final locked until Unit Tests are submitted; window enforced', async () => {
  clock.set(new Date('2026-06-15T03:00:00Z'));
  const w = await examWorld({ mode: 'practice', category: 'practice' });
  const a = (await w.s.post(`/api/v1/student/exams/${w.exam.id}/attempts`)).body.data;
  expect(a.deadlineAt).toBeNull();
  const q = a.questions[0];
  const saved = await w.s.put(`/api/v1/student/attempts/${a.attemptId}/answers/${q.id}`, { optionId: await rightOption(q.id) });
  expect(saved.body.data).toMatchObject({ correct: true, explanation: expect.any(String) });
  // No timer: submitting is a normal (not auto) submit.
  const done = await w.s.post(`/api/v1/student/attempts/${a.attemptId}/submit`);
  expect(done.status).toBe(200);
  expect(done.body.data).toMatchObject({ score: 1, autoSubmitted: false });
  const ut = (await w.t.post(`/api/v1/teacher/courses/${w.courseId}/exams`, { title: 'UT1', scope: 'module', moduleIds: [w.moduleId], mode: 'mock', selection: 'random', randomMix: [{ moduleId: w.moduleId, easy: 1 }], category: 'unit_test_1', weightage: 40, timeLimitMin: 10, passingPct: 40 })).body.data;
  await w.t.post(`/api/v1/teacher/exams/${ut.id}/publish`);
  const fin = (await w.t.post(`/api/v1/teacher/courses/${w.courseId}/exams`, { title: 'Final', scope: 'module', moduleIds: [w.moduleId], mode: 'mock', selection: 'random', randomMix: [{ moduleId: w.moduleId, easy: 1 }], category: 'final', weightage: 60, timeLimitMin: 10, passingPct: 40 })).body.data;
  expect((await w.t.post(`/api/v1/teacher/exams/${fin.id}/publish`)).status).toBe(200);
  const locked = await w.s.post(`/api/v1/student/exams/${fin.id}/attempts`);
  expect(locked.status).toBe(403);
  expect(locked.body.error).toBe('Complete the Unit Tests first');
  const utA = (await w.s.post(`/api/v1/student/exams/${ut.id}/attempts`)).body.data;
  await w.s.post(`/api/v1/student/attempts/${utA.attemptId}/submit`);
  expect((await w.s.post(`/api/v1/student/exams/${fin.id}/attempts`)).status).toBe(201);
  const final = await w.s.get(`/api/v1/student/courses/${w.courseId}/final-result`);
  expect(final.body.data.exams.map((e) => e.category).sort()).toEqual(['final', 'unit_test_1']);
  await query("UPDATE dbo.exams SET starts_at = '2027-01-01' WHERE exam_id = @e", { e: T.int(ut.id) });
  const closed = await w.s.post(`/api/v1/student/exams/${ut.id}/attempts`);
  expect(closed.status).toBe(403);
});

// Review Focus (Phase 9 #2): two tabs on one attempt see the same deadline; the last write per question wins.
test('two tabs share one attempt: same deadline and paper, last answer wins', async () => {
  clock.set(new Date('2026-06-15T03:00:00Z'));
  const w = await examWorld();
  const tab1 = (await w.s.post(`/api/v1/student/exams/${w.exam.id}/attempts`)).body.data;
  clock.set(new Date('2026-06-15T03:07:00Z'));
  const tab2 = (await w.s.post(`/api/v1/student/exams/${w.exam.id}/attempts`)).body.data;
  expect(tab2.attemptId).toBe(tab1.attemptId);
  expect(tab2.deadlineAt).toBe(tab1.deadlineAt);
  const q = tab1.questions[0];
  const [o1, o2] = q.options;
  expect((await w.s.put(`/api/v1/student/attempts/${tab1.attemptId}/answers/${q.id}`, { optionId: o1.id })).status).toBe(200);
  expect((await w.s.put(`/api/v1/student/attempts/${tab2.attemptId}/answers/${q.id}`, { optionId: o2.id })).status).toBe(200);
  const again = (await w.s.post(`/api/v1/student/exams/${w.exam.id}/attempts`)).body.data;
  expect(again.answers[q.id]).toEqual({ optionId: o2.id });
});
