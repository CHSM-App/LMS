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
  expect(review).toHaveProperty('explanationImageUrl', null);
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

test('dashboard latestExam is null when no exam is published', async () => {
  const w = await world();
  expect((await w.s.get('/api/v1/student/dashboard')).body.data.latestExam).toBeNull();
});

test('dashboard shows the latest published exam of my courses', async () => {
  clock.set(new Date('2026-06-15T03:00:00Z'));
  const w2 = await examWorld();
  const d = (await w2.s.get('/api/v1/student/dashboard')).body.data;
  expect(d.latestExam).toMatchObject({ id: w2.exam.id, title: 'Unit Test 1', courseId: w2.courseId, course: 'Class 10 Maths', status: 'notStarted', locked: false });
  await w2.s.post(`/api/v1/student/exams/${w2.exam.id}/attempts`);
  expect((await w2.s.get('/api/v1/student/dashboard')).body.data.latestExam.status).toBe('inProgress');
});

describe('End date is a due date: late attempts are allowed and tagged', () => {
  const late = { startsAt: '2026-06-01T00:00:00Z', endsAt: '2026-06-10T00:00:00Z' };

  test('after the End date the exam can still be taken, with the full time limit, and is marked late', async () => {
    clock.set(new Date('2026-06-15T03:00:00Z'));
    const w = await examWorld(late);
    const list = (await w.s.get(`/api/v1/student/courses/${w.courseId}/exams`)).body.data;
    expect(list[0]).toMatchObject({ overdue: true, locked: false });
    const a = await w.s.post(`/api/v1/student/exams/${w.exam.id}/attempts`);
    expect(a.status).toBe(201);
    expect(new Date(a.body.data.deadlineAt) - new Date('2026-06-15T03:00:00Z')).toBe(30 * 60000);
    const res = await w.s.post(`/api/v1/student/attempts/${a.body.data.attemptId}/submit`);
    expect(res.status).toBe(200);
    const r = (await w.s.get(`/api/v1/student/attempts/${a.body.data.attemptId}/result`)).body.data;
    expect(r.late).toBe(true);
    const after = (await w.s.get(`/api/v1/student/courses/${w.courseId}/exams`)).body.data[0];
    expect(after).toMatchObject({ overdue: false, lastAttemptLate: true });
    const teacherRows = (await w.t.get(`/api/v1/teacher/exams/${w.exam.id}/results`)).body.data;
    expect(teacherRows[0].late).toBe(true);
  });

  test('taken before the End date is not late; before the Start date is still refused', async () => {
    clock.set(new Date('2026-06-05T03:00:00Z'));
    const w = await examWorld(late);
    const a = await w.s.post(`/api/v1/student/exams/${w.exam.id}/attempts`);
    await w.s.post(`/api/v1/student/attempts/${a.body.data.attemptId}/submit`);
    expect((await w.s.get(`/api/v1/student/attempts/${a.body.data.attemptId}/result`)).body.data.late).toBe(false);
    clock.set(new Date('2026-05-20T03:00:00Z'));
    const w2 = await examWorld({ ...late, title: 'Later exam' });
    const early = await w2.s.post(`/api/v1/student/exams/${w2.exam.id}/attempts`);
    expect(early.status).toBe(403);
    expect(early.body.code || early.body.error).toMatch(/EXAM_NOT_OPEN|not opened/);
  });
});

test('exam list flags an exam that has not opened yet; dashboard latest exam carries the date flags', async () => {
  clock.set(new Date('2026-06-05T03:00:00Z'));
  const w = await examWorld({ startsAt: '2026-06-10T00:00:00Z', endsAt: '2026-06-20T00:00:00Z' });
  expect((await w.s.get(`/api/v1/student/courses/${w.courseId}/exams`)).body.data[0]).toMatchObject({ notOpen: true, overdue: false });
  expect((await w.s.get('/api/v1/student/dashboard')).body.data.latestExam).toMatchObject({ notOpen: true, overdue: false, startsAt: expect.any(String), endsAt: expect.any(String) });
  clock.set(new Date('2026-06-25T03:00:00Z'));
  expect((await w.s.get('/api/v1/student/dashboard')).body.data.latestExam).toMatchObject({ notOpen: false, overdue: true });
});

describe('allowLate: the teacher decides whether the exam can be taken after the End date', () => {
  const dates = { startsAt: '2026-06-01T00:00:00Z', endsAt: '2026-06-10T00:00:00Z' };

  test('allowLate defaults to true and is saved with the exam', async () => {
    const w = await examWorld(dates);
    expect((await w.t.get(`/api/v1/teacher/exams/${w.exam.id}`)).body.data.allowLate).toBe(true);
    expect(w.exam.allowLate).toBe(true);
  });

  test('allowLate false: after the End date a new attempt is refused and the list says closed', async () => {
    clock.set(new Date('2026-06-15T03:00:00Z'));
    const w = await examWorld({ ...dates, allowLate: false });
    expect(w.exam.allowLate).toBe(false);
    expect((await w.s.get(`/api/v1/student/courses/${w.courseId}/exams`)).body.data[0]).toMatchObject({ closed: true, allowLate: false });
    const r = await w.s.post(`/api/v1/student/exams/${w.exam.id}/attempts`);
    expect(r.status).toBe(403);
    expect(JSON.stringify(r.body)).toMatch(/EXAM_CLOSED|closed/);
  });

  test('allowLate false: before the End date the exam works and is not closed', async () => {
    clock.set(new Date('2026-06-05T03:00:00Z'));
    const w = await examWorld({ ...dates, allowLate: false });
    expect((await w.s.get(`/api/v1/student/courses/${w.courseId}/exams`)).body.data[0].closed).toBe(false);
    expect((await w.s.post(`/api/v1/student/exams/${w.exam.id}/attempts`)).status).toBe(201);
  });
});

describe('schedule can be changed after students have taken the exam', () => {
  test('teacher can reopen a closed exam (allowLate on, later End date); other fields stay locked', async () => {
    clock.set(new Date('2026-06-05T03:00:00Z'));
    const w = await examWorld({ startsAt: '2026-06-01T00:00:00Z', endsAt: '2026-06-10T00:00:00Z', allowLate: false });
    const a = await w.s.post(`/api/v1/student/exams/${w.exam.id}/attempts`);
    await w.s.post(`/api/v1/student/attempts/${a.body.data.attemptId}/submit`);
    clock.set(new Date('2026-06-15T03:00:00Z'));
    const put = await w.t.put(`/api/v1/teacher/exams/${w.exam.id}`, { ...w.exam, title: 'Changed title', allowLate: true, endsAt: '2026-06-30T00:00:00Z' });
    expect(put.status).toBe(200);
    const now = (await w.t.get(`/api/v1/teacher/exams/${w.exam.id}`)).body.data;
    expect(now).toMatchObject({ allowLate: true, title: 'Unit Test 1' });
    expect(now.endsAt).toBe('2026-06-30T00:00:00.000Z');
    expect((await w.s.get(`/api/v1/student/courses/${w.courseId}/exams`)).body.data[0].closed).toBe(false);
  });

  test('End date must still be after the Start date', async () => {
    clock.set(new Date('2026-06-05T03:00:00Z'));
    const w = await examWorld({ startsAt: '2026-06-01T00:00:00Z', endsAt: '2026-06-10T00:00:00Z' });
    const a = await w.s.post(`/api/v1/student/exams/${w.exam.id}/attempts`);
    await w.s.post(`/api/v1/student/attempts/${a.body.data.attemptId}/submit`);
    const bad = await w.t.put(`/api/v1/teacher/exams/${w.exam.id}`, { ...w.exam, endsAt: '2026-05-01T00:00:00Z' });
    expect(bad.status).toBe(400);
  });
});

describe('a closed, missed unit test does not block the Final forever', () => {
  async function withFinal(w) {
    const body = { ...w.exam, title: 'Final', category: 'final', weightage: 80, allowLate: true, startsAt: null, endsAt: null };
    const created = await w.t.post(`/api/v1/teacher/courses/${w.courseId}/exams`, body);
    if (created.status !== 201) throw new Error(JSON.stringify(created.body));
    const f = created.body.data;
    const pub = await w.t.post(`/api/v1/teacher/exams/${f.id}/publish`);
    if (pub.status !== 200) throw new Error(JSON.stringify(pub.body));
    return f;
  }
  const finalRow = async (w) => (await w.s.get(`/api/v1/student/courses/${w.courseId}/exams`)).body.data.find((e) => e.category === 'final');

  test('unit test closed (allowLate off) and not taken: Final opens after the End date, not before', async () => {
    clock.set(new Date('2026-06-05T03:00:00Z'));
    const w = await examWorld({ startsAt: '2026-06-01T00:00:00Z', endsAt: '2026-06-10T00:00:00Z', allowLate: false });
    await withFinal(w);
    expect((await finalRow(w)).locked).toBe(true);
    clock.set(new Date('2026-06-15T03:00:00Z'));
    expect((await finalRow(w)).locked).toBe(false);
  });

  test('unit test past its date but late is allowed: Final stays locked until the student submits it', async () => {
    clock.set(new Date('2026-06-15T03:00:00Z'));
    const w = await examWorld({ startsAt: '2026-06-01T00:00:00Z', endsAt: '2026-06-10T00:00:00Z', allowLate: true });
    await withFinal(w);
    expect((await finalRow(w)).locked).toBe(true);
  });
});
