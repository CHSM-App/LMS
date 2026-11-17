const ExcelJS = require('exceljs');
const { app, request, reset, closeAll, createUser } = require('../../setup/helpers');
const { teacher, readyCourse, query, one, T } = require('../../setup/content');

beforeEach(reset);
afterAll(closeAll);

const mcq = (over = {}) => ({
  type: 'mcq', text: '2 + 2 = ?', difficulty: 'easy', marks: 1, negativeMarks: 0.25, explanation: 'Basic addition',
  options: [{ text: '3', isCorrect: false }, { text: '4', isCorrect: true }], ...over,
});

async function bank(t, moduleId, counts = { easy: 3, medium: 2, hard: 1 }) {
  const ids = [];
  for (const [difficulty, n] of Object.entries(counts)) {
    for (let i = 0; i < n; i += 1) ids.push((await t.post(`/api/v1/teacher/modules/${moduleId}/questions`, mcq({ difficulty, text: `${difficulty} ${i}` }))).body.data.id);
  }
  return ids;
}

const examBody = (moduleId, over = {}) => ({
  title: 'Unit Test 1', scope: 'module', moduleIds: [moduleId], mode: 'mock', selection: 'random',
  randomMix: [{ moduleId, easy: 2, medium: 1, hard: 1 }], category: 'unit_test_1', weightage: 20,
  negativeMarking: true, timeLimitMin: 30, passingPct: 40, shuffleQuestions: true, shuffleOptions: true, attemptLimit: 2,
  startsAt: '2026-01-01T03:30:00Z', endsAt: '2026-12-31T18:30:00Z', batchIds: [], ...over,
});

describe('question bank', () => {
  test('create, validation, other teachers 404', async () => {
    const t = await teacher();
    const { moduleId } = await readyCourse(t);
    const bad = await t.post(`/api/v1/teacher/modules/${moduleId}/questions`, mcq({ options: [{ text: 'a', isCorrect: true }, { text: 'b', isCorrect: true }] }));
    expect(bad.status).toBe(400);
    expect(bad.body.details.errors).toContain('MCQ needs exactly one correct option');
    const ok = await t.post(`/api/v1/teacher/modules/${moduleId}/questions`, mcq());
    expect(ok.status).toBe(201);
    expect(ok.body.data).toMatchObject({ type: 'mcq', difficulty: 'easy', marks: 1, negativeMarks: 0.25, isArchived: false });
    expect(ok.body.data.options).toHaveLength(2);
    const fill = await t.post(`/api/v1/teacher/modules/${moduleId}/questions`, { type: 'fill_blank', text: 'Capital of Maharashtra?', acceptedAnswers: ['Mumbai'], marks: 1 });
    expect(fill.status).toBe(201);
    const other = await teacher({ name: 'O' });
    expect((await other.get(`/api/v1/teacher/modules/${moduleId}/questions`)).status).toBe(404);
    expect((await t.get(`/api/v1/teacher/modules/${moduleId}/questions?difficulty=easy`)).body.data).toHaveLength(1);
  });

  test('editing an unused question changes it in place; a used one becomes a new version and the old one is archived', async () => {
    const t = await teacher();
    const { courseId, moduleId } = await readyCourse(t);
    const q1 = (await t.post(`/api/v1/teacher/modules/${moduleId}/questions`, mcq())).body.data;
    const edited = await t.put(`/api/v1/teacher/questions/${q1.id}`, mcq({ text: 'Edited' }));
    expect(edited.body.data.id).toBe(q1.id);
    const exam = await t.post(`/api/v1/teacher/courses/${courseId}/exams`, examBody(moduleId, { selection: 'manual', randomMix: [], questionIds: [q1.id], mode: 'practice', category: 'practice' }));
    await t.post(`/api/v1/teacher/exams/${exam.body.data.id}/publish`);
    const v2 = await t.put(`/api/v1/teacher/questions/${q1.id}`, mcq({ text: 'Version 2' }));
    expect(v2.body.data.id).not.toBe(q1.id);
    const old = await one('SELECT is_archived, replaced_by FROM dbo.questions WHERE question_id = @id', { id: T.int(q1.id) });
    expect(old).toEqual({ is_archived: true, replaced_by: v2.body.data.id });
    const del = await t.del(`/api/v1/teacher/questions/${q1.id}`);
    expect(del.body.data).toEqual({ archived: true });
    expect(await one('SELECT question_id FROM dbo.questions WHERE question_id = @id', { id: T.int(q1.id) })).toBeTruthy();
    const unused = (await t.post(`/api/v1/teacher/modules/${moduleId}/questions`, mcq())).body.data;
    expect((await t.del(`/api/v1/teacher/questions/${unused.id}`)).body.data).toEqual({ deleted: true });
  });
});

describe('excel import', () => {
  test('template has the header and one example per type', async () => {
    const t = await teacher();
    const res = await t.get('/api/v1/teacher/questions/import-template').buffer(true).parse((r, cb) => {
      const chunks = [];
      r.on('data', (c) => chunks.push(c));
      r.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(res.status).toBe(200);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(res.body);
    const ws = wb.getWorksheet('Questions');
    expect(ws.getRow(1).values.slice(1)).toEqual(['type', 'question', 'option_a', 'option_b', 'option_c', 'option_d', 'option_e', 'correct', 'difficulty', 'marks', 'negative_marks', 'explanation']);
    expect(ws.rowCount).toBe(5);
  });

  test('imports valid rows, reports bad rows, keeps formulas as text and Marathi intact', async () => {
    const t = await teacher();
    const { moduleId } = await readyCourse(t);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Questions');
    ws.addRow(['type', 'question', 'option_a', 'option_b', 'option_c', 'option_d', 'option_e', 'correct', 'difficulty', 'marks', 'negative_marks', 'explanation']);
    ws.addRow(['mcq', 'महाराष्ट्राची राजधानी?', 'मुंबई', 'पुणे', '', '', '', 'A', 'easy', 1, 0, '']);
    ws.addRow(['true_false', 'Sun rises in the east', 'True', 'False', '', '', '', 'True', 'easy', 1, 0, '']);
    ws.addRow(['mcq', 'Two correct?', 'x', 'y', '', '', '', 'A,B', 'easy', 1, 0, '']);
    ws.addRow(['fill_blank', { formula: 'CMD()' }, '', '', '', '', '', 'cmd', 'medium', 1, 0, '']);
    ws.addRow(['essay', 'Unknown type', '', '', '', '', '', '', 'easy', 1, 0, '']);
    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    const res = await request(app)
      .post(`/api/v1/teacher/modules/${moduleId}/questions/import`)
      .set('Authorization', `Bearer ${t.token}`)
      .attach('file', buf, 'questions.xlsx');
    expect(res.status).toBe(200);
    expect(res.body.data.imported).toBe(3);
    expect(res.body.data.errors).toEqual([
      { row: 4, field: 'correct', message: 'MCQ needs exactly one correct option' },
      { row: 6, field: 'type', message: 'Choose a question type: MCQ, True/False, Fill in the blank or Multiple correct' },
    ]);
    expect(res.body.data.errorFileUrl).toMatch(/^\/api\/v1\/files\/import_errors\//);
    const texts = (await query('SELECT text FROM dbo.questions WHERE module_id = @m', { m: T.int(moduleId) })).map((r) => r.text);
    expect(texts).toEqual(expect.arrayContaining(['महाराष्ट्राची राजधानी?', '=CMD()']));
  });

  test('more than 2000 rows is refused', async () => {
    const t = await teacher();
    const { moduleId } = await readyCourse(t);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Questions');
    ws.addRow(['type', 'question']);
    for (let i = 0; i < 2001; i += 1) ws.addRow(['mcq', `q${i}`]);
    const res = await request(app)
      .post(`/api/v1/teacher/modules/${moduleId}/questions/import`)
      .set('Authorization', `Bearer ${t.token}`)
      .attach('file', Buffer.from(await wb.xlsx.writeBuffer()), 'q.xlsx');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Maximum 2000 rows per import');
  });
});

describe('exam builder', () => {
  test('validate lists every problem; publish refuses until fixed', async () => {
    const t = await teacher();
    const { courseId, moduleId } = await readyCourse(t);
    await bank(t, moduleId, { easy: 3, medium: 1, hard: 1 });
    const exam = await t.post(`/api/v1/teacher/courses/${courseId}/exams`, examBody(moduleId, {
      randomMix: [{ moduleId, easy: 2, medium: 1, hard: 3 }], timeLimitMin: null, endsAt: '2025-01-01T00:00:00Z',
    }));
    expect(exam.status).toBe(201);
    const v = await t.post(`/api/v1/teacher/exams/${exam.body.data.id}/validate`);
    expect(v.body.data.ok).toBe(false);
    expect(v.body.data.problems).toEqual(expect.arrayContaining([
      "Module 'Linear equations' has 1 hard questions, exam needs 3",
      'Mock exams need a time limit',
      'End date must be after start date',
    ]));
    expect((await t.post(`/api/v1/teacher/exams/${exam.body.data.id}/publish`)).status).toBe(422);
  });

  test('practice exams force weightage 0 and no attempt limit or timer', async () => {
    const t = await teacher();
    const { courseId, moduleId } = await readyCourse(t);
    await bank(t, moduleId);
    const res = await t.post(`/api/v1/teacher/courses/${courseId}/exams`, examBody(moduleId, { mode: 'practice', category: 'practice', weightage: 50 }));
    expect(res.body.data).toMatchObject({ mode: 'practice', category: 'practice', weightage: 0, attemptLimit: null, timeLimitMin: null });
  });

  test('weightages must total 100 before a final exam is published', async () => {
    const t = await teacher();
    const { courseId, moduleId } = await readyCourse(t);
    await bank(t, moduleId, { easy: 6, medium: 3, hard: 3 });
    const ut1 = await t.post(`/api/v1/teacher/courses/${courseId}/exams`, examBody(moduleId, { weightage: 20 }));
    expect((await t.post(`/api/v1/teacher/exams/${ut1.body.data.id}/publish`)).status).toBe(200);
    const fin = await t.post(`/api/v1/teacher/courses/${courseId}/exams`, examBody(moduleId, { title: 'Final', category: 'final', weightage: 70 }));
    const res = await t.post(`/api/v1/teacher/exams/${fin.body.data.id}/publish`);
    expect(res.status).toBe(422);
    expect(res.body.details.problems).toContain('Weightages must total 100% (now 90%)');
    await t.put(`/api/v1/teacher/exams/${fin.body.data.id}`, examBody(moduleId, { title: 'Final', category: 'final', weightage: 80 }));
    expect((await t.post(`/api/v1/teacher/exams/${fin.body.data.id}/publish`)).status).toBe(200);
  });

  test('manual selection: questions must be in scope and total marks must match', async () => {
    const t = await teacher();
    const { courseId, moduleId } = await readyCourse(t);
    const ids = await bank(t, moduleId, { easy: 2, medium: 0, hard: 0 });
    const exam = await t.post(`/api/v1/teacher/courses/${courseId}/exams`, examBody(moduleId, { selection: 'manual', randomMix: [], questionIds: ids, totalMarks: 5 }));
    const v = await t.post(`/api/v1/teacher/exams/${exam.body.data.id}/validate`);
    expect(v.body.data.problems).toContain('Total marks is 5 but the chosen questions add up to 2');
  });

  test('batch targeting must use this course\'s batches', async () => {
    const t = await teacher();
    const { courseId, moduleId } = await readyCourse(t);
    const other = await readyCourse(t);
    const foreign = (await t.post(`/api/v1/teacher/courses/${other.courseId}/batches`, { name: 'X', startDate: '2026-01-01' })).body.data.id;
    const res = await t.post(`/api/v1/teacher/courses/${courseId}/exams`, examBody(moduleId, { batchIds: [foreign] }));
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Choose batches from this course');
    const own = (await t.post(`/api/v1/teacher/courses/${courseId}/batches`, { name: 'Morning', startDate: '2026-01-01' })).body.data.id;
    const ok = await t.post(`/api/v1/teacher/courses/${courseId}/exams`, examBody(moduleId, { batchIds: [own] }));
    expect(ok.body.data.batchIds).toEqual([own]);
  });

  test('delete only drafts without attempts', async () => {
    const t = await teacher();
    const { courseId, moduleId } = await readyCourse(t);
    await bank(t, moduleId);
    const draft = await t.post(`/api/v1/teacher/courses/${courseId}/exams`, examBody(moduleId));
    expect((await t.del(`/api/v1/teacher/exams/${draft.body.data.id}`)).status).toBe(200);
    const pub = await t.post(`/api/v1/teacher/courses/${courseId}/exams`, examBody(moduleId));
    await t.post(`/api/v1/teacher/exams/${pub.body.data.id}/publish`);
    expect((await t.del(`/api/v1/teacher/exams/${pub.body.data.id}`)).status).toBe(409);
  });
});

describe('results', () => {
  async function attempt(examId, studentId, score, max, submittedAt, perModule = {}) {
    await query(
      `INSERT INTO dbo.exam_attempts (exam_id, student_id, attempt_no, seed, started_at, submitted_at, score, max_score, passed, per_module_json)
       VALUES (@e, @s, (SELECT ISNULL(MAX(attempt_no),0)+1 FROM dbo.exam_attempts WHERE exam_id=@e AND student_id=@s), 1, @at, @at, @sc, @mx, 1, @pm)`,
      { e: T.int(examId), s: T.int(studentId), at: T.datetime(new Date(submittedAt)), sc: T.decimal(score, 7, 2), mx: T.decimal(max, 7, 2), pm: T.nvarchar(JSON.stringify(perModule)) },
    );
  }

  test('exam results rank students; final results are weighted from best attempts', async () => {
    const t = await teacher();
    const { courseId, moduleId } = await readyCourse(t);
    await bank(t, moduleId, { easy: 6, medium: 3, hard: 3 });
    const ut1 = (await t.post(`/api/v1/teacher/courses/${courseId}/exams`, examBody(moduleId, { weightage: 20 }))).body.data.id;
    const ut2 = (await t.post(`/api/v1/teacher/courses/${courseId}/exams`, examBody(moduleId, { title: 'UT2', category: 'unit_test_2', weightage: 20 }))).body.data.id;
    const fin = (await t.post(`/api/v1/teacher/courses/${courseId}/exams`, examBody(moduleId, { title: 'Final', category: 'final', weightage: 60 }))).body.data.id;
    for (const id of [ut1, ut2, fin]) await t.post(`/api/v1/teacher/exams/${id}/publish`);
    const asha = await createUser({ role: 'student', name: 'Asha' });
    const ravi = await createUser({ role: 'student', name: 'Ravi' });
    await attempt(ut1, asha.user_id, 8, 10, '2026-02-01T10:00:00Z');
    await attempt(ut1, asha.user_id, 6, 10, '2026-02-02T10:00:00Z');
    await attempt(ut1, ravi.user_id, 8, 10, '2026-02-01T09:00:00Z');
    await attempt(ut2, asha.user_id, 6, 10, '2026-03-01T10:00:00Z');
    await attempt(fin, asha.user_id, 70, 100, '2026-04-01T10:00:00Z');

    const r = await t.get(`/api/v1/teacher/exams/${ut1}/results`);
    expect(r.body.data.map((x) => [x.studentName, x.score, x.rank])).toEqual([['Ravi', 8, 1], ['Asha', 8, 2]]);
    expect(r.body.data[0].studentMobile).toBeTruthy();

    const f = await t.get(`/api/v1/teacher/courses/${courseId}/final-results`);
    const ashaRow = f.body.data.find((x) => x.studentName === 'Asha');
    expect(ashaRow.weightedPct).toBe(70);
    expect(ashaRow.passed).toBe(true);
    const other = await teacher({ name: 'O' });
    expect((await other.get(`/api/v1/teacher/exams/${ut1}/results`)).status).toBe(404);
  });
});
