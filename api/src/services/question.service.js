const { query, one, T } = require('../db/query');
const { withTransaction } = require('../db/tx');
const { validateQuestion, DIFFICULTIES } = require('../domain/exam');
const { APIError } = require('../utils/APIError');
const uploads = require('./upload.service');
const storage = require('../providers/storage');

// Body -> normalized question. Throws 400 with every validation error listed.
function parse(b) {
  const q = {
    type: b.type,
    text: typeof b.text === 'string' ? b.text.trim() : b.text == null ? '' : String(b.text),
    difficulty: b.difficulty || 'medium',
    marks: b.marks === undefined || b.marks === '' ? 1 : Number(b.marks),
    negativeMarks: b.negativeMarks === undefined || b.negativeMarks === '' ? 0 : Number(b.negativeMarks),
    explanation: b.explanation ? String(b.explanation).trim().slice(0, 2000) : null,
    explanationImageKey: b.explanationImageKey ? String(b.explanationImageKey) : null,
    options: Array.isArray(b.options) ? b.options.map((o) => ({ text: String(o.text ?? '').trim(), isCorrect: !!o.isCorrect })) : [],
    acceptedAnswers: Array.isArray(b.acceptedAnswers) ? b.acceptedAnswers.map((a) => String(a).trim()).filter(Boolean) : [],
  };
  if (q.type === 'true_false' && !q.options.length && b.correct !== undefined) {
    q.options = [{ text: 'True', isCorrect: b.correct === true }, { text: 'False', isCorrect: b.correct === false }];
  }
  if (q.type === 'fill_blank') q.options = [];
  else q.acceptedAnswers = [];
  const errors = validateQuestion(q);
  if (q.text.length > 2000) errors.push('The question can be at most 2000 characters');
  if (errors.length) throw new APIError(400, errors[0], 'QUESTION_INVALID', { errors });
  return q;
}

// parse() plus: the solution image must be this teacher's own 'solution' upload.
async function parseFor(teacherId, body) {
  const q = parse(body);
  q.explanationImageKey = await uploads.assertOwnedKey(teacherId, q.explanationImageKey, ['solution']);
  return q;
}

async function insert(mod, q, tx) {
  const row = await one(
    `INSERT INTO dbo.questions (module_id, subject_id, course_id, type, text, difficulty, marks, negative_marks, explanation, explanation_image_key, accepted_answers_json)
     OUTPUT INSERTED.question_id
     VALUES (@m, @s, @c, @type, @text, @d, @marks, @neg, @exp, @img, @acc)`,
    {
      m: T.int(mod.id),
      s: T.int(mod.subject_id),
      c: T.int(mod.course_id),
      type: T.varchar(q.type, 14),
      text: T.nvarchar(q.text, 2000),
      d: T.varchar(q.difficulty, 6),
      marks: T.decimal(q.marks, 5, 2),
      neg: T.decimal(q.negativeMarks, 5, 2),
      exp: T.nvarchar(q.explanation, 2000),
      img: T.varchar(q.explanationImageKey || null, 200),
      acc: T.nvarchar(q.acceptedAnswers.length ? JSON.stringify(q.acceptedAnswers) : null, 1000),
    },
    tx,
  );
  for (let i = 0; i < q.options.length; i += 1) {
    await query(
      'INSERT INTO dbo.question_options (question_id, text, is_correct, sort_order) VALUES (@q, @t, @c, @o)',
      { q: T.int(row.question_id), t: T.nvarchar(q.options[i].text, 500), c: T.bit(q.options[i].isCorrect), o: T.int(i + 1) },
      tx,
    );
  }
  return row.question_id;
}

// Loads full questions (with options) for scoring and display.
async function load(ids, tx) {
  if (!ids.length) return [];
  const list = ids.join(',');
  const qs = await query(`SELECT * FROM dbo.questions WHERE question_id IN (SELECT CAST(value AS INT) FROM STRING_SPLIT(@ids, ','))`, { ids: T.varchar(list) }, tx);
  const opts = await query(`SELECT * FROM dbo.question_options WHERE question_id IN (SELECT CAST(value AS INT) FROM STRING_SPLIT(@ids, ',')) ORDER BY sort_order`, { ids: T.varchar(list) }, tx);
  return qs.map((q) => ({
    id: q.question_id,
    moduleId: q.module_id,
    subjectId: q.subject_id,
    type: q.type,
    text: q.text,
    difficulty: q.difficulty,
    marks: Number(q.marks),
    negativeMarks: Number(q.negative_marks),
    explanation: q.explanation,
    explanationImageKey: q.explanation_image_key || null,
    explanationImageUrl: q.explanation_image_key ? storage.signedUrl(q.explanation_image_key) : null,
    acceptedAnswers: q.accepted_answers_json ? JSON.parse(q.accepted_answers_json) : [],
    isArchived: q.is_archived,
    replacedBy: q.replaced_by,
    options: opts.filter((o) => o.question_id === q.question_id).map((o) => ({ id: o.option_id, text: o.text, isCorrect: o.is_correct })),
  }));
}

async function get(id, tx) {
  return (await load([id], tx))[0];
}

async function create(mod, body, teacherId) {
  const q = await parseFor(teacherId, body);
  const id = await withTransaction((tx) => insert(mod, q, tx));
  return get(id);
}

// Used = part of a published exam's manual set, or shown to a student in an attempt.
async function isUsed(id, tx) {
  const r = await one(
    `SELECT CASE WHEN EXISTS (SELECT 1 FROM dbo.exam_attempt_questions WHERE question_id = @id)
              OR EXISTS (SELECT 1 FROM dbo.exam_questions eq JOIN dbo.exams e ON e.exam_id = eq.exam_id WHERE eq.question_id = @id AND e.status = 'published')
            THEN 1 ELSE 0 END AS used`,
    { id: T.int(id) },
    tx,
  );
  return !!r.used;
}

async function update(questionRow, body, teacherId) {
  const q = await parseFor(teacherId, body);
  const newId = await withTransaction(async (tx) => {
    const current = await one('SELECT * FROM dbo.questions WITH (UPDLOCK) WHERE question_id = @id', { id: T.int(questionRow.id) }, tx);
    if (current.is_archived) throw new APIError(409, 'This question is archived. Edit its newest version instead.', 'QUESTION_ARCHIVED');
    if (await isUsed(questionRow.id, tx)) {
      const mod = { id: current.module_id, subject_id: current.subject_id, course_id: current.course_id };
      const id = await insert(mod, q, tx);
      await query('UPDATE dbo.questions SET is_archived = 1, replaced_by = @n WHERE question_id = @id', { n: T.int(id), id: T.int(questionRow.id) }, tx);
      // Draft exams follow the new version; published exams keep what students saw.
      await query(
        `UPDATE eq SET question_id = @n FROM dbo.exam_questions eq JOIN dbo.exams e ON e.exam_id = eq.exam_id
         WHERE eq.question_id = @id AND e.status = 'draft'`,
        { n: T.int(id), id: T.int(questionRow.id) },
        tx,
      );
      return id;
    }
    await query(
      `UPDATE dbo.questions SET type = @type, text = @text, difficulty = @d, marks = @marks, negative_marks = @neg, explanation = @exp, explanation_image_key = @img,
         accepted_answers_json = @acc WHERE question_id = @id`,
      {
        id: T.int(questionRow.id),
        type: T.varchar(q.type, 14),
        text: T.nvarchar(q.text, 2000),
        d: T.varchar(q.difficulty, 6),
        marks: T.decimal(q.marks, 5, 2),
        neg: T.decimal(q.negativeMarks, 5, 2),
        exp: T.nvarchar(q.explanation, 2000),
        img: T.varchar(q.explanationImageKey || null, 200),
        acc: T.nvarchar(q.acceptedAnswers.length ? JSON.stringify(q.acceptedAnswers) : null, 1000),
      },
      tx,
    );
    await query('DELETE FROM dbo.question_options WHERE question_id = @id', { id: T.int(questionRow.id) }, tx);
    for (let i = 0; i < q.options.length; i += 1) {
      await query(
        'INSERT INTO dbo.question_options (question_id, text, is_correct, sort_order) VALUES (@q, @t, @c, @o)',
        { q: T.int(questionRow.id), t: T.nvarchar(q.options[i].text, 500), c: T.bit(q.options[i].isCorrect), o: T.int(i + 1) },
        tx,
      );
    }
    return questionRow.id;
  });
  return get(newId);
}

async function remove(questionRow) {
  return withTransaction(async (tx) => {
    if (await isUsed(questionRow.id, tx)) {
      await query('UPDATE dbo.questions SET is_archived = 1 WHERE question_id = @id', { id: T.int(questionRow.id) }, tx);
      return { archived: true };
    }
    await query('DELETE FROM dbo.exam_questions WHERE question_id = @id', { id: T.int(questionRow.id) }, tx);
    await query('DELETE FROM dbo.question_options WHERE question_id = @id', { id: T.int(questionRow.id) }, tx);
    await query('DELETE FROM dbo.questions WHERE question_id = @id', { id: T.int(questionRow.id) }, tx);
    return { deleted: true };
  });
}

async function list(moduleId, { type, difficulty, archived }) {
  const rows = await query(
    `SELECT question_id FROM dbo.questions WHERE module_id = @m
       AND (@type IS NULL OR type = @type) AND (@d IS NULL OR difficulty = @d) AND is_archived = @arch
     ORDER BY question_id`,
    { m: T.int(moduleId), type: T.varchar(type || null, 14), d: T.varchar(DIFFICULTIES.includes(difficulty) ? difficulty : null, 6), arch: T.bit(archived === 'true') },
  );
  const full = await load(rows.map((r) => r.question_id));
  return full.sort((a, b) => a.id - b.id);
}

// Counts per difficulty of active questions in a module (for the exam builder).
async function counts(moduleIds, tx) {
  if (!moduleIds.length) return {};
  const rows = await query(
    `SELECT module_id, difficulty, COUNT(*) n FROM dbo.questions
     WHERE is_archived = 0 AND module_id IN (SELECT CAST(value AS INT) FROM STRING_SPLIT(@ids, ','))
     GROUP BY module_id, difficulty`,
    { ids: T.varchar(moduleIds.join(',')) },
    tx,
  );
  const out = {};
  for (const id of moduleIds) out[id] = { easy: 0, medium: 0, hard: 0 };
  for (const r of rows) out[r.module_id][r.difficulty] = r.n;
  return out;
}

module.exports = { parse, insert, load, get, create, update, remove, list, counts, isUsed };
