const { query, one, T } = require('../db/query');
const { withTransaction } = require('../db/tx');
const questions = require('./question.service');
const { notifyMany } = require('./notification.service');
const { tableExists } = require('./accountHooks');
const { clock } = require('../utils/clock');
const { text, bool } = require('../utils/validate');
const { APIError, badRequest, conflict } = require('../utils/APIError');

const SCOPES = ['module', 'modules', 'course'];
const MODES = ['practice', 'mock'];
const CATEGORIES = ['unit_test_1', 'unit_test_2', 'final', 'practice'];
const iso = (d) => (d ? new Date(d).toISOString() : null);
const intOrNull = (v) => (v === undefined || v === null || v === '' ? null : Number(v));

async function courseModules(courseId, tx) {
  return query('SELECT module_id AS id, name FROM dbo.modules WHERE course_id = @c ORDER BY subject_id, sort_order', { c: T.int(courseId) }, tx);
}

// Body -> exam fields. Structural errors are 400; completeness problems are reported by validate().
async function parse(courseId, b, tx) {
  const f = {
    title: text(b.title, 'title', { max: 200 }),
    scope: b.scope,
    mode: b.mode,
    selection: b.selection,
    category: b.category,
    weightage: Number(b.weightage || 0),
    totalMarks: b.totalMarks === undefined || b.totalMarks === null || b.totalMarks === '' ? null : Number(b.totalMarks),
    negativeMarking: bool(b.negativeMarking),
    timeLimitMin: intOrNull(b.timeLimitMin),
    passingPct: b.passingPct === undefined || b.passingPct === null || b.passingPct === '' ? null : Number(b.passingPct),
    shuffleQuestions: bool(b.shuffleQuestions),
    shuffleOptions: bool(b.shuffleOptions),
    attemptLimit: intOrNull(b.attemptLimit),
    startsAt: b.startsAt ? new Date(b.startsAt) : null,
    endsAt: b.endsAt ? new Date(b.endsAt) : null,
    allowLate: b.allowLate === undefined || b.allowLate === null ? true : bool(b.allowLate),
    batchIds: Array.isArray(b.batchIds) ? [...new Set(b.batchIds.map(Number))] : [],
    questionIds: Array.isArray(b.questionIds) ? [...new Set(b.questionIds.map(Number))] : [],
    randomMix: Array.isArray(b.randomMix) ? b.randomMix : [],
    moduleIds: Array.isArray(b.moduleIds) ? [...new Set(b.moduleIds.map(Number))] : [],
  };
  if (!SCOPES.includes(f.scope)) throw badRequest('scope: choose module, modules or course');
  if (!MODES.includes(f.mode)) throw badRequest('mode: choose practice or mock');
  if (!['manual', 'random'].includes(f.selection)) throw badRequest('selection: choose manual or random');
  if (!CATEGORIES.includes(f.category)) throw badRequest('category: choose unit_test_1, unit_test_2, final or practice');
  if ([f.startsAt, f.endsAt].some((d) => d && Number.isNaN(d.getTime()))) throw badRequest('Dates must be valid');
  if (!(f.weightage >= 0 && f.weightage <= 100)) throw badRequest('weightage: 0 to 100');
  // Practice: not counted, no timer, unlimited attempts (spec §5).
  if (f.mode === 'practice' || f.category === 'practice') {
    f.mode = 'practice';
    f.category = 'practice';
    f.weightage = 0;
    f.attemptLimit = null;
    f.timeLimitMin = null;
  }
  const mods = await courseModules(courseId, tx);
  const valid = new Set(mods.map((m) => m.id));
  if (f.scope === 'course') f.moduleIds = mods.map((m) => m.id);
  if (f.moduleIds.some((id) => !valid.has(id))) throw badRequest('Choose modules from this course');
  if (f.scope === 'module' && f.moduleIds.length !== 1) throw badRequest('Choose exactly one module for a single-module exam');
  if (f.scope === 'modules' && f.moduleIds.length < 2) throw badRequest('Choose at least two modules');
  if (f.batchIds.length) {
    const rows = await query(
      `SELECT batch_id FROM dbo.batches WHERE course_id = @c AND batch_id IN (SELECT CAST(value AS INT) FROM STRING_SPLIT(@ids, ','))`,
      { c: T.int(courseId), ids: T.varchar(f.batchIds.join(',')) },
      tx,
    );
    if (rows.length !== f.batchIds.length) throw badRequest('Choose batches from this course');
  }
  f.randomMix = f.selection === 'random'
    ? f.randomMix
        .map((m) => ({ moduleId: Number(m.moduleId), easy: Number(m.easy || 0), medium: Number(m.medium || 0), hard: Number(m.hard || 0) }))
        .filter((m) => f.moduleIds.includes(m.moduleId))
    : [];
  if (f.randomMix.some((m) => [m.easy, m.medium, m.hard].some((n) => !Number.isInteger(n) || n < 0))) throw badRequest('Question counts must be whole numbers');
  if (f.selection === 'manual') f.randomMix = [];
  else f.questionIds = [];
  return f;
}

async function writeChildren(examId, f, tx) {
  const p = { e: T.int(examId) };
  await query('DELETE FROM dbo.exam_modules WHERE exam_id = @e', p, tx);
  await query('DELETE FROM dbo.exam_questions WHERE exam_id = @e', p, tx);
  await query('DELETE FROM dbo.exam_batches WHERE exam_id = @e', p, tx);
  for (const id of f.moduleIds) {
    const mix = f.randomMix.find((m) => m.moduleId === id) || { easy: 0, medium: 0, hard: 0 };
    await query('INSERT INTO dbo.exam_modules (exam_id, module_id, easy_count, medium_count, hard_count) VALUES (@e, @m, @a, @b, @c)', {
      e: T.int(examId), m: T.int(id), a: T.int(mix.easy), b: T.int(mix.medium), c: T.int(mix.hard),
    }, tx);
  }
  for (let i = 0; i < f.questionIds.length; i += 1) {
    await query('INSERT INTO dbo.exam_questions (exam_id, question_id, sort_order) VALUES (@e, @q, @o)', { e: T.int(examId), q: T.int(f.questionIds[i]), o: T.int(i + 1) }, tx);
  }
  for (const id of f.batchIds) await query('INSERT INTO dbo.exam_batches (exam_id, batch_id) VALUES (@e, @b)', { e: T.int(examId), b: T.int(id) }, tx);
}

const fieldParams = (f) => ({
  title: T.nvarchar(f.title, 200),
  scope: T.varchar(f.scope, 8),
  mode: T.varchar(f.mode, 8),
  sel: T.varchar(f.selection, 6),
  cat: T.varchar(f.category, 12),
  w: T.decimal(f.weightage, 5, 2),
  tm: T.decimal(f.totalMarks, 6, 2),
  neg: T.bit(f.negativeMarking),
  tl: T.int(f.timeLimitMin),
  pp: T.decimal(f.passingPct, 5, 2),
  shq: T.bit(f.shuffleQuestions),
  sho: T.bit(f.shuffleOptions),
  al: T.int(f.attemptLimit),
  sa: T.datetime(f.startsAt),
  ea: T.datetime(f.endsAt),
  late: T.bit(f.allowLate),
});

async function get(examId, tx) {
  const e = await one('SELECT * FROM dbo.exams WHERE exam_id = @id', { id: T.int(examId) }, tx);
  if (!e) return null;
  const mods = await query('SELECT * FROM dbo.exam_modules WHERE exam_id = @id', { id: T.int(examId) }, tx);
  const qs = await query('SELECT question_id FROM dbo.exam_questions WHERE exam_id = @id ORDER BY sort_order', { id: T.int(examId) }, tx);
  const bs = await query('SELECT batch_id FROM dbo.exam_batches WHERE exam_id = @id ORDER BY batch_id', { id: T.int(examId) }, tx);
  return {
    id: e.exam_id,
    publicId: e.public_id,
    courseId: e.course_id,
    title: e.title,
    scope: e.scope,
    mode: e.mode,
    selection: e.selection,
    category: e.category,
    weightage: Number(e.weightage),
    totalMarks: e.total_marks === null ? null : Number(e.total_marks),
    negativeMarking: e.negative_marking,
    timeLimitMin: e.time_limit_min,
    passingPct: e.passing_pct === null ? null : Number(e.passing_pct),
    shuffleQuestions: e.shuffle_questions,
    shuffleOptions: e.shuffle_options,
    attemptLimit: e.attempt_limit,
    startsAt: iso(e.starts_at),
    endsAt: iso(e.ends_at),
    allowLate: e.allow_late,
    status: e.status,
    publishedAt: iso(e.published_at),
    moduleIds: mods.map((m) => m.module_id),
    randomMix: e.selection === 'random' ? mods.map((m) => ({ moduleId: m.module_id, easy: m.easy_count, medium: m.medium_count, hard: m.hard_count })) : [],
    questionIds: qs.map((q) => q.question_id),
    batchIds: bs.map((b) => b.batch_id),
  };
}

async function create(courseId, body) {
  const id = await withTransaction(async (tx) => {
    const f = await parse(courseId, body, tx);
    const row = await one(
      `INSERT INTO dbo.exams (course_id, title, scope, mode, selection, category, weightage, total_marks, negative_marking, time_limit_min,
         passing_pct, shuffle_questions, shuffle_options, attempt_limit, starts_at, ends_at, allow_late)
       OUTPUT INSERTED.exam_id
       VALUES (@c, @title, @scope, @mode, @sel, @cat, @w, @tm, @neg, @tl, @pp, @shq, @sho, @al, @sa, @ea, @late)`,
      { ...fieldParams(f), c: T.int(courseId) },
      tx,
    );
    await writeChildren(row.exam_id, f, tx);
    return row.exam_id;
  });
  return get(id);
}

async function attemptCount(examId, tx) {
  return (await one('SELECT COUNT(*) n FROM dbo.exam_attempts WHERE exam_id = @e', { e: T.int(examId) }, tx)).n;
}

async function update(exam, body) {
  await withTransaction(async (tx) => {
    if (await attemptCount(exam.id, tx)) {
      // Students have taken it: questions, marks and rules are frozen, but the teacher can still fix the schedule
      // (e.g. reopen a closed exam so students who missed it can take it and unlock the Final).
      const startsAt = body.startsAt ? new Date(body.startsAt) : null;
      const endsAt = body.endsAt ? new Date(body.endsAt) : null;
      if ([startsAt, endsAt].some((d) => d && Number.isNaN(d.getTime()))) throw badRequest('Dates must be valid');
      if (startsAt && endsAt && endsAt <= startsAt) throw badRequest('End date must be after start date');
      const allowLate = body.allowLate === undefined || body.allowLate === null ? Boolean(exam.allow_late) : bool(body.allowLate);
      await query('UPDATE dbo.exams SET starts_at = @sa, ends_at = @ea, allow_late = @late WHERE exam_id = @id', {
        sa: T.datetime(startsAt), ea: T.datetime(endsAt), late: T.bit(allowLate), id: T.int(exam.id),
      }, tx);
      return;
    }
    const f = await parse(exam.course_id, body, tx);
    await query(
      `UPDATE dbo.exams SET title = @title, scope = @scope, mode = @mode, selection = @sel, category = @cat, weightage = @w, total_marks = @tm,
         negative_marking = @neg, time_limit_min = @tl, passing_pct = @pp, shuffle_questions = @shq, shuffle_options = @sho,
         attempt_limit = @al, starts_at = @sa, ends_at = @ea, allow_late = @late WHERE exam_id = @id`,
      { ...fieldParams(f), id: T.int(exam.id) },
      tx,
    );
    await writeChildren(exam.id, f, tx);
  });
  return get(exam.id);
}

// Every reason the exam can't be published yet, as plain sentences.
async function validate(examId) {
  const e = await get(examId);
  const problems = [];
  if (e.mode === 'mock' && !e.timeLimitMin) problems.push('Mock exams need a time limit');
  if (e.mode === 'mock' && e.passingPct === null) problems.push('Mock exams need a passing percentage');
  if (e.startsAt && e.endsAt && new Date(e.endsAt) <= new Date(e.startsAt)) problems.push('End date must be after start date');
  if (!e.moduleIds.length) problems.push('Choose at least one module');
  const mods = await courseModules(e.courseId);
  const name = (id) => (mods.find((m) => m.id === id) || {}).name || `#${id}`;
  if (e.selection === 'random') {
    const have = await questions.counts(e.moduleIds);
    let total = 0;
    for (const m of e.randomMix) {
      for (const d of ['easy', 'medium', 'hard']) {
        total += m[d];
        if (m[d] > have[m.moduleId][d]) problems.push(`Module '${name(m.moduleId)}' has ${have[m.moduleId][d]} ${d} questions, exam needs ${m[d]}`);
      }
    }
    if (!total) problems.push('Set how many questions to pick from each module');
  } else {
    if (!e.questionIds.length) problems.push('Choose the questions for this exam');
    const qs = await questions.load(e.questionIds);
    if (qs.some((q) => q.isArchived)) problems.push('Some chosen questions are archived. Replace them with their newest version.');
    if (qs.some((q) => !e.moduleIds.includes(q.moduleId))) problems.push("Some chosen questions are outside this exam's modules");
    const sum = Math.round(qs.reduce((a, q) => a + q.marks, 0) * 100) / 100;
    if (e.totalMarks !== null && e.totalMarks !== sum) problems.push(`Total marks is ${e.totalMarks} but the chosen questions add up to ${sum}`);
  }
  if (e.category === 'final') {
    const others = await one(
      `SELECT ISNULL(SUM(weightage), 0) AS w FROM dbo.exams
       WHERE course_id = @c AND status = 'published' AND category <> 'practice' AND exam_id <> @id`,
      { c: T.int(e.courseId), id: T.int(e.id) },
    );
    const total = Math.round((Number(others.w) + e.weightage) * 100) / 100;
    if (total !== 100) problems.push(`Weightages must total 100% (now ${total}%)`);
  }
  return { ok: problems.length === 0, problems };
}

async function publish(examId) {
  const v = await validate(examId);
  if (!v.ok) throw new APIError(422, 'Fix these before publishing', 'EXAM_NOT_READY', { problems: v.problems });
  await query("UPDATE dbo.exams SET status = 'published', published_at = @now WHERE exam_id = @id", { id: T.int(examId), now: T.datetime(clock.now()) });
  const e = await get(examId);
  await notifyStudents(e);
  return e;
}

// Enrolled students (in the targeted batches) hear about a new exam. Enrollments arrive in Phase 7.
async function notifyStudents(e) {
  if (!(await tableExists('enrollments'))) return;
  const course = await one('SELECT title FROM dbo.courses WHERE course_id = @c', { c: T.int(e.courseId) });
  const rows = await query(
    `SELECT DISTINCT student_id FROM dbo.enrollments WHERE course_id = @c AND status = 'approved'
       AND (NOT EXISTS (SELECT 1 FROM dbo.exam_batches WHERE exam_id = @e) OR batch_id IN (SELECT batch_id FROM dbo.exam_batches WHERE exam_id = @e))`,
    { c: T.int(e.courseId), e: T.int(e.id) },
  );
  await notifyMany(rows.map((r) => r.student_id), { key: 'exam.published', vars: { exam: e.title, course: course.title }, link: '/student/exams' });
}

async function unpublish(examId) {
  if (await attemptCount(examId)) throw conflict('Students have already taken this exam. It stays published.', 'EXAM_HAS_ATTEMPTS');
  await query("UPDATE dbo.exams SET status = 'draft' WHERE exam_id = @id", { id: T.int(examId) });
  return get(examId);
}

async function remove(exam) {
  if (exam.status !== 'draft' || (await attemptCount(exam.id))) throw conflict('Only draft exams without attempts can be deleted', 'EXAM_LOCKED');
  await withTransaction(async (tx) => {
    const p = { e: T.int(exam.id) };
    await query('DELETE FROM dbo.exam_modules WHERE exam_id = @e', p, tx);
    await query('DELETE FROM dbo.exam_questions WHERE exam_id = @e', p, tx);
    await query('DELETE FROM dbo.exam_batches WHERE exam_id = @e', p, tx);
    await query('DELETE FROM dbo.exams WHERE exam_id = @e', p, tx);
  });
  return { deleted: true };
}

async function list(courseId) {
  const rows = await query(
    `SELECT e.exam_id, (SELECT COUNT(*) FROM dbo.exam_attempts a WHERE a.exam_id = e.exam_id AND a.submitted_at IS NOT NULL) AS attempts
     FROM dbo.exams e WHERE e.course_id = @c ORDER BY e.created_at DESC`,
    { c: T.int(courseId) },
  );
  const out = [];
  for (const r of rows) out.push({ ...(await get(r.exam_id)), attemptCount: r.attempts });
  return out;
}

module.exports = { create, update, get, validate, publish, unpublish, remove, list, CATEGORIES };
