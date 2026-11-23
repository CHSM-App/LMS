const { query, one, T } = require('../db/query');
const { withTransaction } = require('../db/tx');
const uploads = require('./upload.service');
const storage = require('../providers/storage');
const { validateVideoLink, validateHttpUrl } = require('../utils/videoLinks');
const { text, bool } = require('../utils/validate');
const { badRequest, conflict, notFound } = require('../utils/APIError');
const { liveStage } = require('../domain/liveLesson');
const { clock } = require('../utils/clock');
const live = require('./liveLesson.service');

// ---------- Subjects ----------
const subjectOut = (s) => ({ id: s.subject_id, name: s.name, description: s.description, sortOrder: s.sort_order });

async function createSubject(courseId, b) {
  const row = await one(
    `INSERT INTO dbo.subjects (course_id, name, description, sort_order)
     OUTPUT INSERTED.* VALUES (@c, @n, @d, (SELECT ISNULL(MAX(sort_order), 0) + 1 FROM dbo.subjects WHERE course_id = @c))`,
    { c: T.int(courseId), n: T.nvarchar(text(b.name, 'name', { max: 120 }), 120), d: T.nvarchar(text(b.description, 'description', { required: false, max: 1000 }), 1000) },
  );
  return subjectOut(row);
}

async function updateSubject(id, b) {
  const row = await one(
    'UPDATE dbo.subjects SET name = @n, description = @d OUTPUT INSERTED.* WHERE subject_id = @id',
    { id: T.int(id), n: T.nvarchar(text(b.name, 'name', { max: 120 }), 120), d: T.nvarchar(text(b.description, 'description', { required: false, max: 1000 }), 1000) },
  );
  return subjectOut(row);
}

async function deleteSubject(id) {
  const has = await one('SELECT TOP 1 1 AS y FROM dbo.modules WHERE subject_id = @id', { id: T.int(id) });
  if (has) throw conflict('Remove or move its modules first', 'SUBJECT_HAS_MODULES');
  await query('DELETE FROM dbo.subjects WHERE subject_id = @id', { id: T.int(id) });
  return { deleted: true };
}

// ---------- Ordering ----------
// Rewrites sort_order to 1..n in one transaction. The list must be exactly the current children.
async function reorder({ table, idCol, parentCol, parentId, ids }) {
  if (!Array.isArray(ids) || !ids.every((x) => Number.isInteger(x))) throw badRequest('Send the full list of ids in the new order');
  return withTransaction(async (tx) => {
    const rows = await query(`SELECT ${idCol} AS id FROM dbo.${table} WITH (UPDLOCK, HOLDLOCK) WHERE ${parentCol} = @p`, { p: T.int(parentId) }, tx);
    const current = rows.map((r) => r.id).sort((a, b) => a - b);
    const given = [...ids].sort((a, b) => a - b);
    if (current.length !== given.length || current.some((v, i) => v !== given[i])) throw badRequest('Send the full list of ids in the new order');
    await query(`UPDATE dbo.${table} SET sort_order = sort_order + 100000 WHERE ${parentCol} = @p`, { p: T.int(parentId) }, tx);
    for (let i = 0; i < ids.length; i += 1) {
      await query(`UPDATE dbo.${table} SET sort_order = @o WHERE ${idCol} = @id`, { o: T.int(i + 1), id: T.int(ids[i]) }, tx);
    }
    return { ids };
  });
}

// Contents of one module. A live lesson's sessions (rows of one slot) sit next to each other and move as one:
// the list holds one id per lesson (the first session's id, as the curriculum shows it); the full list of rows also works.
async function reorderContents(moduleId, ids) {
  const bad = () => badRequest('Send the full list of ids in the new order');
  if (!Array.isArray(ids) || !ids.every((x) => Number.isInteger(x))) throw bad();
  const rows = await query('SELECT content_id, live_slot_id FROM dbo.contents WHERE module_id = @m ORDER BY sort_order', { m: T.int(moduleId) });
  const groupOf = new Map();
  for (const r of rows) {
    const mates = r.live_slot_id ? rows.filter((x) => String(x.live_slot_id) === String(r.live_slot_id)) : [r];
    groupOf.set(r.content_id, mates.map((x) => x.content_id));
  }
  const firsts = rows.filter((r) => groupOf.get(r.content_id)[0] === r.content_id).map((r) => r.content_id);
  const same = (a, b) => a.length === b.length && [...a].sort((x, y) => x - y).every((v, i) => v === [...b].sort((x, y) => x - y)[i]);
  const full = rows.map((r) => r.content_id);
  if (same(ids, full)) return reorder({ table: 'contents', idCol: 'content_id', parentCol: 'module_id', parentId: moduleId, ids });
  if (!same(ids, firsts)) throw bad();
  return reorder({ table: 'contents', idCol: 'content_id', parentCol: 'module_id', parentId: moduleId, ids: ids.flatMap((id) => groupOf.get(id)) });
}

// ---------- Modules ----------
const moduleOut = (m) => ({ id: m.module_id, name: m.name, sortOrder: m.sort_order, subjectId: m.subject_id });

async function createModule(subject, b) {
  return withTransaction(async (tx) => {
    const next = await one('SELECT ISNULL(MAX(sort_order), 0) + 1 AS n FROM dbo.modules WITH (UPDLOCK, HOLDLOCK) WHERE subject_id = @s', { s: T.int(subject.id) }, tx);
    const row = await one(
      'INSERT INTO dbo.modules (subject_id, course_id, name, sort_order) OUTPUT INSERTED.* VALUES (@s, @c, @n, @o)',
      { s: T.int(subject.id), c: T.int(subject.course_id), n: T.nvarchar(text(b.name, 'name', { max: 160 }), 160), o: T.int(next.n) },
      tx,
    );
    return moduleOut(row);
  });
}

async function updateModule(id, b) {
  const row = await one('UPDATE dbo.modules SET name = @n OUTPUT INSERTED.* WHERE module_id = @id', { id: T.int(id), n: T.nvarchar(text(b.name, 'name', { max: 160 }), 160) });
  return moduleOut(row);
}

async function deleteModule(id) {
  const has = await one('SELECT TOP 1 1 AS y FROM dbo.contents WHERE module_id = @id', { id: T.int(id) });
  if (has) throw conflict('Remove or move its content first', 'MODULE_HAS_CONTENT');
  const questions = await one("SELECT OBJECT_ID('dbo.questions') AS t");
  if (questions.t) {
    const q = await one('SELECT TOP 1 1 AS y FROM dbo.questions WHERE module_id = @id', { id: T.int(id) });
    if (q) throw conflict('This module has questions in its question bank. Move or archive them first.', 'MODULE_HAS_QUESTIONS');
  }
  await query('DELETE FROM dbo.modules WHERE module_id = @id', { id: T.int(id) });
  return { deleted: true };
}

// ---------- Contents ----------
async function parseContent(teacherId, b) {
  const type = b.type;
  if (!['video', 'pdf', 'link'].includes(type)) throw badRequest('type: choose video, pdf, link or live');
  const out = { title: text(b.title, 'title', { max: 200 }), type, videoSource: null, fileKey: null, url: null, isFreePreview: bool(b.isFreePreview) };
  if (type === 'link') out.url = validateHttpUrl(b.url);
  if (type === 'pdf') {
    if (!b.fileKey) throw badRequest('fileKey: upload the PDF first');
    out.fileKey = await uploads.assertOwnedKey(teacherId, b.fileKey, ['pdf']);
  }
  if (type === 'video') {
    out.videoSource = b.videoSource;
    if (b.videoSource === 'upload') {
      if (!b.fileKey) throw badRequest('fileKey: upload the video first');
      out.fileKey = await uploads.assertOwnedKey(teacherId, b.fileKey, ['video', 'demo_video']);
    } else {
      out.url = validateVideoLink(b.videoSource, b.url);
    }
  }
  return out;
}

const contentParams = (c) => ({
  title: T.nvarchar(c.title, 200),
  type: T.varchar(c.type, 5),
  vs: T.varchar(c.videoSource, 8),
  key: T.varchar(c.fileKey, 200),
  url: T.varchar(c.url, 500),
  free: T.bit(c.isFreePreview),
});

// Contents with their live class (live lessons only) and its batch.
const CONTENT_SELECT = `SELECT x.*, l.starts_at AS live_starts_at, l.duration_min AS live_duration_min, l.meet_link AS live_meet_link,
    l.status AS live_status, l.batch_id AS live_batch_id, b.name AS live_batch_name
  FROM dbo.contents x LEFT JOIN dbo.live_classes l ON l.live_class_id = x.live_class_id LEFT JOIN dbo.batches b ON b.batch_id = l.batch_id`;

const loadContent = (id) => one(`${CONTENT_SELECT} WHERE x.content_id = @id`, { id: T.int(id) });

const hasRecording = (x) => !!x.video_source;

const liveInfo = (x) => ({
  slotId: x.live_slot_id || null,
  liveClassId: x.live_class_id,
  startsAt: x.live_starts_at,
  durationMin: x.live_duration_min,
  batch: x.live_batch_id ? { id: x.live_batch_id, name: x.live_batch_name } : null,
  stage: liveStage({ status: x.live_status, startsAt: x.live_starts_at, durationMin: x.live_duration_min, hasRecording: hasRecording(x) }, clock.now()),
  meetLink: x.live_meet_link,
});

const recordingInfo = (x) => (hasRecording(x) ? { videoSource: x.video_source, url: x.url || (x.file_key ? storage.signedUrl(x.file_key) : null) } : null);

// One batch session of a live lesson (a content row of the lesson's slot).
const sessionOut = (x) => ({ contentId: x.content_id, ...liveInfo(x), recording: recordingInfo(x) });

// Teacher view: their own files get short-lived signed URLs. Live lessons add `live` and `recording`.
function contentOut(x) {
  const fileUrl = x.file_key ? storage.signedUrl(x.file_key) : null;
  const o = {
    id: x.content_id,
    title: x.title,
    type: x.type,
    videoSource: x.video_source,
    fileKey: x.file_key,
    url: x.url || fileUrl,
    isFreePreview: x.is_free_preview,
    sortOrder: x.sort_order,
  };
  if (x.type === 'live') {
    o.live = liveInfo(x);
    o.recording = recordingInfo(x);
  }
  return o;
}

async function createContent(teacherId, mod, b) {
  if (b && b.type === 'live') return contentOut(await loadContent(await live.createLiveLesson(teacherId, mod, b)));
  const c = await parseContent(teacherId, b);
  return withTransaction(async (tx) => {
    const next = await one('SELECT ISNULL(MAX(sort_order), 0) + 1 AS n FROM dbo.contents WITH (UPDLOCK, HOLDLOCK) WHERE module_id = @m', { m: T.int(mod.id) }, tx);
    const row = await one(
      `INSERT INTO dbo.contents (module_id, course_id, title, type, video_source, file_key, url, sort_order, is_free_preview)
       OUTPUT INSERTED.* VALUES (@m, @c, @title, @type, @vs, @key, @url, @o, @free)`,
      { ...contentParams(c), m: T.int(mod.id), c: T.int(mod.course_id), o: T.int(next.n) },
      tx,
    );
    return contentOut(row);
  });
}

async function updateContent(teacherId, id, b) {
  const existing = await loadContent(id);
  if ((existing.type === 'live') !== (!!b && b.type === 'live')) {
    throw badRequest('A live lesson stays live. Delete it and add a new lesson to change its type.', 'LIVE_TYPE_FIXED');
  }
  if (existing.type === 'live') {
    await live.updateLiveLesson(teacherId, existing, b);
    return contentOut(await loadContent(id));
  }
  const c = await parseContent(teacherId, b);
  await query(
    `UPDATE dbo.contents SET title = @title, type = @type, video_source = @vs, file_key = @key, url = @url, is_free_preview = @free
     WHERE content_id = @id`,
    { ...contentParams(c), id: T.int(id) },
  );
  return contentOut(await loadContent(id));
}

async function scheduleSession(teacherId, id, b) {
  const newId = await live.scheduleBatchSession(teacherId, await loadContent(id), b);
  return sessionOut(await loadContent(newId));
}

async function batchOf(courseId, batchId) {
  const batch = await one('SELECT batch_id FROM dbo.batches WHERE batch_id = @b AND course_id = @c', { b: T.int(Number(batchId) || 0), c: T.int(courseId) });
  if (!batch) throw notFound('Batch not found');
  return batch.batch_id;
}

// Every live lesson of the course (one per slot, in course order) with this batch's session or null.
async function liveSchedule(courseId, batchIdParam) {
  const batchId = await batchOf(courseId, batchIdParam);
  const modules = await query(
    'SELECT m.module_id, m.name FROM dbo.modules m JOIN dbo.subjects s ON s.subject_id = m.subject_id WHERE m.course_id = @c ORDER BY s.sort_order, m.sort_order',
    { c: T.int(courseId) },
  );
  const rows = await query(`${CONTENT_SELECT} WHERE x.course_id = @c AND x.type = 'live' ORDER BY x.sort_order`, { c: T.int(courseId) });
  const out = [];
  for (const m of modules) {
    const seen = new Map();
    for (const x of rows.filter((r) => r.module_id === m.module_id)) {
      const key = String(x.live_slot_id || x.content_id);
      if (!seen.has(key)) {
        const o = { slotId: x.live_slot_id || null, contentId: x.content_id, title: x.title, module: { id: m.module_id, name: m.name }, session: null };
        seen.set(key, o);
        out.push(o);
      }
      if (x.live_batch_id === batchId) seen.get(key).session = sessionOut(x);
    }
  }
  return out;
}

async function scheduleBatch(teacherId, courseId, batchIdParam, b) {
  const batchId = await batchOf(courseId, batchIdParam);
  const ids = await live.scheduleBatch(teacherId, courseId, batchId, b && b.items);
  const sessions = [];
  for (const id of ids) sessions.push(sessionOut(await loadContent(id)));
  return { created: ids.length, sessions };
}

async function setRecording(teacherId, id, b) {
  await live.setRecording(teacherId, await loadContent(id), b);
  return contentOut(await loadContent(id));
}

async function clearRecording(id) {
  await live.clearRecording(await loadContent(id));
  return contentOut(await loadContent(id));
}

async function deleteContent(id) {
  const existing = await loadContent(id);
  if (existing && existing.type === 'live') return live.deleteLiveLesson(existing);
  const progress = await one("SELECT OBJECT_ID('dbo.content_progress') AS t");
  if (progress.t) await query('DELETE FROM dbo.content_progress WHERE content_id = @id', { id: T.int(id) });
  await query('DELETE FROM dbo.contents WHERE content_id = @id', { id: T.int(id) });
  return { deleted: true };
}

// One entry per lesson: the sessions of a live lesson (rows sharing a slot) fold into its first row's `live.sessions`.
function groupLiveSessions(rows) {
  const out = [];
  const bySlot = new Map();
  for (const x of rows) {
    const key = x.type === 'live' && x.live_slot_id ? String(x.live_slot_id) : null;
    if (key && bySlot.has(key)) {
      if (x.live_class_id) bySlot.get(key).live.sessions.push(sessionOut(x));
      continue;
    }
    const o = contentOut(x);
    if (x.type === 'live') o.live.sessions = x.live_class_id ? [sessionOut(x)] : [];
    if (key) bySlot.set(key, o);
    out.push(o);
  }
  return out;
}

// ---------- Full tree ----------
async function curriculum(courseId) {
  const p = { c: T.int(courseId) };
  const subjects = await query('SELECT * FROM dbo.subjects WHERE course_id = @c ORDER BY sort_order', p);
  const modules = await query('SELECT * FROM dbo.modules WHERE course_id = @c ORDER BY sort_order', p);
  const contents = await query(`${CONTENT_SELECT} WHERE x.course_id = @c ORDER BY x.sort_order`, p);
  return {
    subjects: subjects.map((s) => ({
      ...subjectOut(s),
      modules: modules
        .filter((m) => m.subject_id === s.subject_id)
        .map((m) => ({ ...moduleOut(m), contents: groupLiveSessions(contents.filter((x) => x.module_id === m.module_id)) })),
    })),
  };
}

module.exports = {
  createSubject, updateSubject, deleteSubject, createModule, updateModule, deleteModule,
  createContent, updateContent, deleteContent, scheduleSession, liveSchedule, scheduleBatch, setRecording, clearRecording, curriculum, reorder, reorderContents,
};
