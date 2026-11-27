// Exam taking: start/resume, autosave, server timer, auto-submit, results and review (spec §5).
const crypto = require('crypto');
const { query, one, T } = require('../db/query');
const { withTransaction } = require('../db/tx');
const questions = require('./question.service');
const results = require('./result.service');
const { requireWritable } = require('./studentAccess');
const { selectQuestions, scoreAttempt, scoreAnswer, mulberry32, shuffle } = require('../domain/exam');
const { clock } = require('../utils/clock');
const { APIError, badRequest, conflict, notFound } = require('../utils/APIError');

const round2 = (n) => Math.round(n * 100) / 100;

// The End date is a due date: unless the teacher turned off allow_late, an attempt started after it is just tagged late.
const startedLate = (exam, attempt) => Boolean(exam.ends_at && attempt.started_at && new Date(attempt.started_at) > new Date(exam.ends_at));

async function examForStudent(examId, studentId) {
  const e = await one("SELECT * FROM dbo.exams WHERE exam_id = @e AND status = 'published'", { e: T.int(Number(examId)) });
  if (!e) throw notFound('Exam not found');
  const { enrollment } = await requireWritable(studentId, e.course_id);
  const targets = await query('SELECT batch_id FROM dbo.exam_batches WHERE exam_id = @e', { e: T.int(e.exam_id) });
  if (targets.length && !targets.some((b) => b.batch_id === enrollment.batch_id)) throw notFound('Exam not found');
  return e;
}

async function attemptsOf(examId, studentId, tx) {
  return query('SELECT * FROM dbo.exam_attempts WHERE exam_id = @e AND student_id = @s ORDER BY attempt_no', { e: T.int(examId), s: T.int(studentId) }, tx);
}

// Paper as shown to the student: no correct flags, no accepted answers, no explanations.
async function paper(attempt, exam) {
  const aq = await query('SELECT question_id, option_order_json FROM dbo.exam_attempt_questions WHERE attempt_id = @a ORDER BY sort_order', { a: T.int(attempt.attempt_id) });
  const full = await questions.load(aq.map((r) => r.question_id));
  const answers = await query('SELECT question_id, answer_json FROM dbo.attempt_answers WHERE attempt_id = @a', { a: T.int(attempt.attempt_id) });
  return {
    attemptId: attempt.public_id,
    examId: exam.exam_id,
    title: exam.title,
    mode: exam.mode,
    startedAt: attempt.started_at,
    deadlineAt: attempt.deadline_at,
    submittedAt: attempt.submitted_at,
    questions: aq.map((row) => {
      const q = full.find((x) => x.id === row.question_id);
      const order = row.option_order_json ? JSON.parse(row.option_order_json) : q.options.map((o) => o.id);
      return {
        id: q.id,
        type: q.type,
        text: q.text,
        marks: q.marks,
        options: order.map((id) => q.options.find((o) => o.id === id)).filter(Boolean).map((o) => ({ id: o.id, text: o.text })),
      };
    }),
    answers: Object.fromEntries(answers.map((a) => [a.question_id, JSON.parse(a.answer_json)])),
  };
}

async function createAttempt(exam, studentId, attemptNo) {
  const seed = crypto.randomInt(1, 2 ** 31 - 1);
  const rng = mulberry32(seed);
  let ids;
  if (exam.selection === 'random') {
    const mix = (await query('SELECT * FROM dbo.exam_modules WHERE exam_id = @e', { e: T.int(exam.exam_id) })).map((m) => ({ moduleId: m.module_id, easy: m.easy_count, medium: m.medium_count, hard: m.hard_count }));
    const pool = await query(
      `SELECT question_id AS id, module_id AS moduleId, difficulty, is_archived AS isArchived FROM dbo.questions
       WHERE is_archived = 0 AND module_id IN (SELECT module_id FROM dbo.exam_modules WHERE exam_id = @e)`,
      { e: T.int(exam.exam_id) },
    );
    try {
      ids = selectQuestions(pool, mix, rng);
    } catch {
      throw conflict('This exam is not ready yet. Please tell your teacher.', 'EXAM_POOL_TOO_SMALL');
    }
  } else {
    ids = (await query('SELECT question_id FROM dbo.exam_questions WHERE exam_id = @e ORDER BY sort_order', { e: T.int(exam.exam_id) })).map((r) => r.question_id);
  }
  if (exam.shuffle_questions) ids = shuffle(ids, rng);
  const full = await questions.load(ids);
  const now = clock.now();
  let deadline = null;
  if (exam.mode === 'mock' && exam.time_limit_min) deadline = new Date(now.getTime() + exam.time_limit_min * 60000);
  return withTransaction(async (tx) => {
    const row = await one(
      `INSERT INTO dbo.exam_attempts (exam_id, student_id, attempt_no, seed, started_at, deadline_at)
       OUTPUT INSERTED.* VALUES (@e, @s, @n, @seed, @now, @d)`,
      { e: T.int(exam.exam_id), s: T.int(studentId), n: T.int(attemptNo), seed: T.int(seed), now: T.datetime(now), d: T.datetime(deadline) },
      tx,
    );
    for (let i = 0; i < ids.length; i += 1) {
      const q = full.find((x) => x.id === ids[i]);
      const optionIds = q.options.map((o) => o.id);
      const order = exam.shuffle_options && q.type !== 'true_false' ? shuffle(optionIds, rng) : optionIds;
      await query('INSERT INTO dbo.exam_attempt_questions (attempt_id, question_id, sort_order, option_order_json) VALUES (@a, @q, @o, @j)', {
        a: T.int(row.attempt_id), q: T.int(ids[i]), o: T.int(i + 1), j: T.varchar(optionIds.length ? JSON.stringify(order) : null, 200),
      }, tx);
    }
    return row;
  });
}

// Always a boolean: practice attempts have no deadline, and auto_submitted is NOT NULL.
const expired = (a) => Boolean(a.deadline_at && !a.submitted_at && new Date(a.deadline_at) <= clock.now());

async function startOrResume(examId, studentId) {
  const exam = await examForStudent(examId, studentId);
  const all = await attemptsOf(exam.exam_id, studentId);
  let open = all.find((a) => !a.submitted_at);
  if (open && expired(open)) {
    await submitRow(open, exam, true);
    open = null;
  }
  if (open) return { created: false, data: await paper(open, exam) };
  const now = clock.now();
  if (exam.starts_at && now < new Date(exam.starts_at)) throw new APIError(403, 'This exam has not opened yet', 'EXAM_NOT_OPEN');
  if (exam.ends_at && !exam.allow_late && now > new Date(exam.ends_at)) throw new APIError(403, 'This exam has closed', 'EXAM_CLOSED');
  if (exam.category === 'final' && !(await results.isFinalUnlocked(exam.course_id, studentId))) {
    throw new APIError(403, 'Complete the Unit Tests first', 'FINAL_LOCKED');
  }
  if (exam.mode === 'mock' && exam.attempt_limit && all.length >= exam.attempt_limit) throw new APIError(403, 'No attempts left', 'NO_ATTEMPTS_LEFT');
  let row;
  try {
    row = await createAttempt(exam, studentId, all.length + 1);
  } catch (err) {
    if (err.number === 2627 || err.number === 2601) {
      const again = (await attemptsOf(exam.exam_id, studentId)).find((a) => !a.submitted_at);
      if (again) return { created: false, data: await paper(again, exam) };
    }
    throw err;
  }
  return { created: true, data: await paper(row, exam) };
}

async function ownedAttempt(publicId, studentId) {
  if (!/^[0-9a-fA-F-]{36}$/.test(String(publicId))) throw notFound('Attempt not found');
  const a = await one('SELECT * FROM dbo.exam_attempts WHERE public_id = @p AND student_id = @s', { p: T.uuid(publicId), s: T.int(studentId) });
  if (!a) throw notFound('Attempt not found');
  const exam = await one('SELECT * FROM dbo.exams WHERE exam_id = @e', { e: T.int(a.exam_id) });
  return { a, exam };
}

function answerFrom(q, body) {
  if (q.type === 'mcq' || q.type === 'true_false') {
    if (body.optionId === null || body.optionId === undefined) return null;
    const id = Number(body.optionId);
    if (!q.options.some((o) => o.id === id)) throw badRequest('Choose one of the options');
    return { optionId: id };
  }
  if (q.type === 'multi_correct') {
    const ids = Array.isArray(body.optionIds) ? [...new Set(body.optionIds.map(Number))] : [];
    if (ids.some((id) => !q.options.some((o) => o.id === id))) throw badRequest('Choose from the options');
    return { optionIds: ids };
  }
  return { text: String(body.text ?? '').slice(0, 500) };
}

const correctAnswer = (q) => (q.type === 'fill_blank' ? { acceptedAnswers: q.acceptedAnswers } : { optionIds: q.options.filter((o) => o.isCorrect).map((o) => o.id) });

async function saveAnswer(publicId, studentId, questionId, body) {
  const { a, exam } = await ownedAttempt(publicId, studentId);
  if (a.submitted_at) throw conflict('This attempt is already submitted', 'ATTEMPT_SUBMITTED');
  if (expired(a)) {
    await submitRow(a, exam, true);
    throw conflict('Time is up', 'TIME_UP');
  }
  const qid = Number(questionId);
  const inPaper = await one('SELECT 1 AS y FROM dbo.exam_attempt_questions WHERE attempt_id = @a AND question_id = @q', { a: T.int(a.attempt_id), q: T.int(qid) });
  if (!inPaper) throw notFound('Question not in this attempt');
  const q = await questions.get(qid);
  const answer = answerFrom(q, body || {});
  const params = { a: T.int(a.attempt_id), q: T.int(qid), j: T.nvarchar(JSON.stringify(answer), 1000), now: T.datetime(clock.now()) };
  await withTransaction(async (tx) => {
    const up = await query('UPDATE dbo.attempt_answers WITH (UPDLOCK, SERIALIZABLE) SET answer_json = @j, saved_at = @now OUTPUT INSERTED.question_id WHERE attempt_id = @a AND question_id = @q', params, tx);
    if (!up.length) await query('INSERT INTO dbo.attempt_answers (attempt_id, question_id, answer_json, saved_at) VALUES (@a, @q, @j, @now)', params, tx);
  });
  if (exam.mode === 'practice') {
    const r = scoreAnswer(q, answer, { negativeMarking: false });
    return { saved: true, correct: r.correct, explanation: q.explanation, explanationImageUrl: q.explanationImageUrl, correctAnswer: correctAnswer(q) };
  }
  return { saved: true, savedAt: clock.now() };
}

async function submitRow(a, exam, auto) {
  return withTransaction(async (tx) => {
    const locked = await one('SELECT * FROM dbo.exam_attempts WITH (UPDLOCK) WHERE attempt_id = @a', { a: T.int(a.attempt_id) }, tx);
    if (locked.submitted_at) return locked;
    const qids = (await query('SELECT question_id FROM dbo.exam_attempt_questions WHERE attempt_id = @a', { a: T.int(a.attempt_id) }, tx)).map((r) => r.question_id);
    const qs = await questions.load(qids, tx);
    const saved = await query('SELECT question_id, answer_json, saved_at FROM dbo.attempt_answers WHERE attempt_id = @a', { a: T.int(a.attempt_id) }, tx);
    // Only answers saved before the deadline count.
    const answers = Object.fromEntries(
      saved.filter((s) => !locked.deadline_at || new Date(s.saved_at) <= new Date(locked.deadline_at)).map((s) => [s.question_id, JSON.parse(s.answer_json)]),
    );
    const r = scoreAttempt(qs, answers, { negativeMarking: exam.negative_marking });
    const passed = exam.passing_pct === null ? null : (r.max ? (r.score / r.max) * 100 : 0) >= Number(exam.passing_pct);
    for (const q of qs) {
      if (answers[q.id] === undefined) continue;
      await query('UPDATE dbo.attempt_answers SET is_correct = @c, marks_awarded = @m WHERE attempt_id = @a AND question_id = @q', {
        c: T.bit(r.perQuestion[q.id].correct), m: T.decimal(r.perQuestion[q.id].marks, 5, 2), a: T.int(a.attempt_id), q: T.int(q.id),
      }, tx);
    }
    const now = clock.now();
    const submittedAt = auto && locked.deadline_at && new Date(locked.deadline_at) < now ? new Date(locked.deadline_at) : now;
    return one(
      `UPDATE dbo.exam_attempts SET submitted_at = @at, auto_submitted = @auto, score = @s, max_score = @m, passed = @p, per_module_json = @pm
       OUTPUT INSERTED.* WHERE attempt_id = @a`,
      {
        at: T.datetime(submittedAt), auto: T.bit(auto), s: T.decimal(r.score, 7, 2), m: T.decimal(r.max, 7, 2), p: T.bit(passed),
        pm: T.nvarchar(JSON.stringify(r.perModule)), a: T.int(a.attempt_id),
      },
      tx,
    );
  });
}

async function submit(publicId, studentId) {
  const { a, exam } = await ownedAttempt(publicId, studentId);
  const row = await submitRow(a, exam, expired(a));
  return { attemptId: row.public_id, score: Number(row.score), max: Number(row.max_score), pct: row.max_score > 0 ? round2((row.score / row.max_score) * 100) : 0, passed: row.passed, autoSubmitted: row.auto_submitted };
}

async function result(publicId, studentId) {
  let { a, exam } = await ownedAttempt(publicId, studentId);
  if (expired(a)) a = await submitRow(a, exam, true);
  if (!a.submitted_at) throw new APIError(403, 'Submit the exam to see the result', 'NOT_SUBMITTED');
  const ranked = await results.examResults(exam.exam_id);
  const me = await one('SELECT public_id FROM dbo.users WHERE user_id = @s', { s: T.int(studentId) });
  const mine = ranked.find((r) => String(r.studentPublicId).toLowerCase() === String(me.public_id).toLowerCase());
  const qids = (await query('SELECT question_id FROM dbo.exam_attempt_questions WHERE attempt_id = @a ORDER BY sort_order', { a: T.int(a.attempt_id) })).map((r) => r.question_id);
  const qs = await questions.load(qids);
  const answers = await query('SELECT * FROM dbo.attempt_answers WHERE attempt_id = @a', { a: T.int(a.attempt_id) });
  return {
    attemptId: a.public_id,
    exam: { id: exam.exam_id, title: exam.title, category: exam.category, mode: exam.mode },
    score: Number(a.score),
    max: Number(a.max_score),
    pct: a.max_score > 0 ? round2((a.score / a.max_score) * 100) : 0,
    passed: a.passed,
    autoSubmitted: a.auto_submitted,
    late: startedLate(exam, a),
    submittedAt: a.submitted_at,
    rank: mine ? mine.rank : null,
    of: ranked.length,
    perModule: a.per_module_json ? JSON.parse(a.per_module_json) : {},
    review: qids.map((id) => {
      const q = qs.find((x) => x.id === id);
      const ans = answers.find((x) => x.question_id === id);
      return {
        questionId: id,
        type: q.type,
        text: q.text,
        options: q.options.map((o) => ({ id: o.id, text: o.text })),
        yourAnswer: ans ? JSON.parse(ans.answer_json) : null,
        correct: ans ? !!ans.is_correct : false,
        marks: ans && ans.marks_awarded !== null ? Number(ans.marks_awarded) : 0,
        correctAnswer: correctAnswer(q),
        explanation: q.explanation,
        explanationImageUrl: q.explanationImageUrl,
      };
    }),
  };
}

async function examsForCourse(courseId, studentId) {
  const { enrollment } = await requireWritable(studentId, courseId);
  const rows = await query(
    `SELECT e.* FROM dbo.exams e WHERE e.course_id = @c AND e.status = 'published'
       AND (NOT EXISTS (SELECT 1 FROM dbo.exam_batches b WHERE b.exam_id = e.exam_id)
            OR EXISTS (SELECT 1 FROM dbo.exam_batches b WHERE b.exam_id = e.exam_id AND b.batch_id = @b))
     ORDER BY e.published_at`,
    { c: T.int(Number(courseId)), b: T.int(enrollment.batch_id) },
  );
  const unlocked = await results.isFinalUnlocked(Number(courseId), studentId);
  const out = [];
  for (const e of rows) {
    const atts = await attemptsOf(e.exam_id, studentId);
    const submitted = atts.filter((x) => x.submitted_at);
    const best = submitted.sort((x, y) => y.score / y.max_score - x.score / x.max_score)[0];
    const open = atts.find((x) => !x.submitted_at && !expired(x));
    out.push({
      id: e.exam_id,
      title: e.title,
      category: e.category,
      mode: e.mode,
      timeLimitMin: e.time_limit_min,
      startsAt: e.starts_at,
      endsAt: e.ends_at,
      locked: e.category === 'final' && !unlocked,
      attemptsUsed: atts.length,
      attemptsLeft: e.mode === 'mock' && e.attempt_limit ? Math.max(0, e.attempt_limit - atts.length) : null,
      // Past the due date and nothing submitted yet: still open, shown as overdue.
      allowLate: !!e.allow_late,
      closed: Boolean(e.ends_at && !e.allow_late && clock.now() > new Date(e.ends_at)),
      notOpen: Boolean(e.starts_at && clock.now() < new Date(e.starts_at)),
      overdue: Boolean(e.ends_at && clock.now() > new Date(e.ends_at) && !submitted.length),
      lastAttemptLate: submitted.length ? startedLate(e, submitted[submitted.length - 1]) : false,
      openAttemptId: open ? open.public_id : null,
      lastAttemptId: submitted.length ? submitted[submitted.length - 1].public_id : null,
      best: best ? { score: Number(best.score), max: Number(best.max_score), pct: best.max_score > 0 ? round2((best.score / best.max_score) * 100) : 0 } : null,
    });
  }
  return out;
}

// Job + lazy path: submit every attempt whose deadline has passed.
async function runAutoSubmit() {
  const due = await query('SELECT * FROM dbo.exam_attempts WHERE submitted_at IS NULL AND deadline_at IS NOT NULL AND deadline_at <= @now', { now: T.datetime(clock.now()) });
  for (const a of due) {
    const exam = await one('SELECT * FROM dbo.exams WHERE exam_id = @e', { e: T.int(a.exam_id) });
    await submitRow(a, exam, true);
  }
  return due.length;
}

module.exports = { startOrResume, saveAnswer, submit, result, examsForCourse, runAutoSubmit };
