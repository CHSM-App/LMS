// Live lessons: a contents row (type 'live') linked to a live_classes row. The live class carries the time,
// batch, Meet link, attendance and reminders; the content row carries the title, position and recording.
const { query, one, T } = require('../db/query');
const { withTransaction } = require('../db/tx');
const liveClass = require('./liveClass.service');
const uploads = require('./upload.service');
const { validateVideoLink } = require('../utils/videoLinks');
const { clock } = require('../utils/clock');
const { text } = require('../utils/validate');
const { badRequest, conflict } = require('../utils/APIError');

const STATUSES = ['scheduled', 'live', 'completed', 'cancelled'];
const SOURCES = ['upload', 'youtube', 'vimeo', 'bunny'];

async function parseLive(teacherId, courseId, b, currentStatus = 'scheduled') {
  const title = text(b.title, 'title', { max: 200 });
  const status = b.status || currentStatus;
  if (!STATUSES.includes(status)) throw badRequest('status: scheduled, live, completed or cancelled');
  const f = await liveClass.parse(teacherId, {
    courseId, batchId: b.batchId, topic: title, startsAt: b.startsAt, durationMin: b.durationMin, meetLink: b.meetLink, status,
  });
  return { ...f, title };
}

// Returns the new content id. With only a title it is a template (no date yet): batches get sessions later.
async function createLiveLesson(teacherId, mod, b) {
  if (b && !b.startsAt && !b.batchId) return createTemplate(mod, b);
  const f = await parseLive(teacherId, mod.course_id, b);
  if (f.startsAt <= clock.now()) throw badRequest('Choose a time in the future');
  return withTransaction(async (tx) => {
    const lcId = await liveClass.insertLiveClass(f, tx);
    const next = await one('SELECT ISNULL(MAX(sort_order), 0) + 1 AS n FROM dbo.contents WITH (UPDLOCK, HOLDLOCK) WHERE module_id = @m', { m: T.int(mod.id) }, tx);
    const row = await one(
      `INSERT INTO dbo.contents (module_id, course_id, title, type, live_class_id, live_slot_id, sort_order, is_free_preview)
       OUTPUT INSERTED.content_id VALUES (@m, @c, @title, 'live', @lc, NEWID(), @o, 0)`,
      { m: T.int(mod.id), c: T.int(mod.course_id), title: T.nvarchar(f.title, 200), lc: T.int(lcId), o: T.int(next.n) },
      tx,
    );
    await liveClass.notifyNewClass(f, liveClass.lessonLink(mod.course_id, row.content_id), tx);
    return row.content_id;
  });
}

async function createTemplate(mod, b) {
  const title = text(b.title, 'title', { max: 200 });
  return withTransaction(async (tx) => {
    const next = await one('SELECT ISNULL(MAX(sort_order), 0) + 1 AS n FROM dbo.contents WITH (UPDLOCK, HOLDLOCK) WHERE module_id = @m', { m: T.int(mod.id) }, tx);
    const row = await one(
      `INSERT INTO dbo.contents (module_id, course_id, title, type, live_slot_id, sort_order, is_free_preview)
       OUTPUT INSERTED.content_id VALUES (@m, @c, @title, 'live', NEWID(), @o, 0)`,
      { m: T.int(mod.id), c: T.int(mod.course_id), title: T.nvarchar(title, 200), o: T.int(next.n) },
      tx,
    );
    return row.content_id;
  });
}

// existing: the content row joined with its live class (curriculum.loadContent).
// A template (no live class yet) can only be renamed here; its batches are scheduled through sessions.
async function updateLiveLesson(teacherId, existing, b) {
  if (!existing.live_class_id) {
    await withTransaction((tx) => renameSlot(existing, text(b && b.title, 'title', { max: 200 }), tx));
    return;
  }
  const f = await parseLive(teacherId, existing.course_id, b, existing.live_status);
  const moved = f.startsAt.getTime() !== new Date(existing.live_starts_at).getTime();
  if (moved && f.startsAt <= clock.now()) throw badRequest('Choose a time in the future');
  await withTransaction(async (tx) => {
    // Moving the time re-arms both reminders so students are reminded for the new time.
    await query(
      `UPDATE dbo.live_classes SET batch_id = @b, topic = @t, starts_at = @s, duration_min = @d, meet_link = @l, status = @st,
         reminder_sent_at = CASE WHEN starts_at <> @s THEN NULL ELSE reminder_sent_at END,
         reminder2_sent_at = CASE WHEN starts_at <> @s THEN NULL ELSE reminder2_sent_at END
       WHERE live_class_id = @id`,
      {
        b: T.int(f.batchId), t: T.nvarchar(f.title, 200), s: T.datetime(f.startsAt), d: T.int(f.durationMin),
        l: T.varchar(f.meetLink, 300), st: T.varchar(f.status, 10), id: T.int(existing.live_class_id),
      },
      tx,
    );
    await renameSlot(existing, f.title, tx);
  });
}

// A batch session of a live lesson is a contents row of the lesson's slot (same module, title and position)
// with its own live class, so the batch gets its own date, Meet link, attendance and recording.

// Validates one session request and parses it (may create a Meet link). Writes nothing.
async function prepareSession(teacherId, content, b) {
  assertLive(content);
  const batchId = b && b.batchId ? Number(b.batchId) : null;
  if (!batchId) throw badRequest('batchId: choose a batch');
  const batch = await one('SELECT status FROM dbo.batches WHERE batch_id = @b AND course_id = @c', { b: T.int(batchId), c: T.int(content.course_id) });
  if (!batch) throw badRequest('Choose a batch of this course');
  if (batch.status === 'closed') throw conflict('This batch is closed', 'BATCH_CLOSED');
  await checkSlot(content, batchId);
  const f = await parseLive(teacherId, content.course_id, { ...b, title: content.title, batchId });
  if (f.startsAt <= clock.now()) throw badRequest('Choose a time in the future');
  return { content, batchId, f };
}

// One session per batch per lesson, and a lesson for all batches takes no single-batch session.
async function checkSlot(content, batchId, tx) {
  const rows = await query(
    `SELECT l.batch_id FROM dbo.contents x LEFT JOIN dbo.live_classes l WITH (UPDLOCK, HOLDLOCK) ON l.live_class_id = x.live_class_id
     WHERE x.live_slot_id = @slot AND x.live_class_id IS NOT NULL`,
    { slot: T.uuid(content.live_slot_id) },
    tx,
  );
  if (rows.some((r) => r.batch_id === null)) throw conflict('This lesson is for all batches. Change it to one batch first.', 'SLOT_ALL_BATCHES');
  if (rows.some((r) => r.batch_id === batchId)) throw conflict(`This batch already has a session of "${content.title}"`, 'SESSION_EXISTS');
}

async function scheduleBatchSession(teacherId, content, b) {
  const prepared = await prepareSession(teacherId, content, b);
  return withTransaction((tx) => insertSession(prepared, tx));
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Many lessons for one batch in one go: every item is validated first, then all are written in one transaction.
async function scheduleBatch(teacherId, courseId, batchId, items) {
  if (!Array.isArray(items) || !items.length) throw badRequest('items: add at least one lesson');
  const prepared = [];
  for (const it of items) {
    const slot = String((it && it.slotId) || '');
    if (!UUID.test(slot)) throw badRequest('slotId: unknown lesson');
    const content = await one('SELECT TOP 1 * FROM dbo.contents WHERE course_id = @c AND live_slot_id = @slot ORDER BY sort_order', { c: T.int(courseId), slot: T.uuid(slot) });
    if (!content) throw badRequest('slotId: unknown lesson');
    prepared.push(await prepareSession(teacherId, content, { ...it, batchId }));
  }
  return withTransaction(async (tx) => {
    const ids = [];
    for (const p of prepared) ids.push(await insertSession(p, tx));
    return ids;
  });
}

// Writes a prepared session inside tx and returns its content id.
async function insertSession({ content, batchId, f }, tx) {
  await checkSlot(content, batchId, tx);
  const lcId = await liveClass.insertLiveClass(f, tx);
  // The lesson still has its template row (added without a date): it becomes this first session.
  const template = await one('SELECT TOP 1 content_id FROM dbo.contents WITH (UPDLOCK) WHERE live_slot_id = @slot AND live_class_id IS NULL', { slot: T.uuid(content.live_slot_id) }, tx);
  if (template) {
    await query('UPDATE dbo.contents SET live_class_id = @lc WHERE content_id = @id', { lc: T.int(lcId), id: T.int(template.content_id) }, tx);
    await liveClass.notifyNewClass(f, liveClass.lessonLink(content.course_id, template.content_id), tx);
    return template.content_id;
  }
  // The new session goes right after its lesson; later lessons move down by one (two steps because sort_order is unique per module).
  const last = await one('SELECT MAX(sort_order) AS p FROM dbo.contents WHERE live_slot_id = @slot', { slot: T.uuid(content.live_slot_id) }, tx);
  const mp = { m: T.int(content.module_id), p: T.int(last.p) };
  await query('UPDATE dbo.contents SET sort_order = sort_order + 100001 WHERE module_id = @m AND sort_order > @p', mp, tx);
  await query('UPDATE dbo.contents SET sort_order = sort_order - 100000 WHERE module_id = @m AND sort_order > 100000', mp, tx);
  const row = await one(
    `INSERT INTO dbo.contents (module_id, course_id, title, type, live_class_id, live_slot_id, sort_order, is_free_preview)
     OUTPUT INSERTED.content_id VALUES (@m, @c, @title, 'live', @lc, @slot, @o, 0)`,
    {
      m: T.int(content.module_id), c: T.int(content.course_id), title: T.nvarchar(content.title, 200), lc: T.int(lcId),
      slot: T.uuid(content.live_slot_id), o: T.int(last.p + 1),
    },
    tx,
  );
  await liveClass.notifyNewClass(f, liveClass.lessonLink(content.course_id, row.content_id), tx);
  return row.content_id;
}

// Every session of a lesson carries the lesson's title (content title and live class topic).
async function renameSlot(existing, title, tx) {
  const p = { title: T.nvarchar(title, 200), id: T.int(existing.content_id), slot: T.uuid(existing.live_slot_id ?? null) };
  await query('UPDATE dbo.contents SET title = @title WHERE content_id = @id OR (@slot IS NOT NULL AND live_slot_id = @slot)', p, tx);
  await query(
    `UPDATE l SET topic = @title FROM dbo.live_classes l JOIN dbo.contents x ON x.live_class_id = l.live_class_id
     WHERE x.content_id = @id OR (@slot IS NOT NULL AND x.live_slot_id = @slot)`,
    p, tx,
  );
}

function assertLive(existing) {
  if (existing.type !== 'live') throw conflict('Only live lessons have recordings', 'NOT_LIVE_LESSON');
}

async function setRecording(teacherId, existing, b) {
  assertLive(existing);
  if (!existing.live_class_id) throw conflict('Schedule this lesson for a batch first', 'LIVE_NOT_SCHEDULED');
  const source = b && b.videoSource;
  if (!SOURCES.includes(source)) throw badRequest('videoSource: choose upload, youtube, vimeo or bunny');
  let fileKey = null;
  let url = null;
  if (source === 'upload') {
    if (!b.fileKey) throw badRequest('fileKey: upload the recording first');
    fileKey = await uploads.assertOwnedKey(teacherId, b.fileKey, ['video']);
  } else {
    url = validateVideoLink(source, b.url);
  }
  await query('UPDATE dbo.contents SET video_source = @vs, file_key = @key, url = @url WHERE content_id = @id', {
    vs: T.varchar(source, 8), key: T.varchar(fileKey, 200), url: T.varchar(url, 500), id: T.int(existing.content_id),
  });
}

async function clearRecording(existing) {
  assertLive(existing);
  await query('UPDATE dbo.contents SET video_source = NULL, file_key = NULL, url = NULL WHERE content_id = @id', { id: T.int(existing.content_id) });
}

// Deletes the lesson with every session of its slot. Refused, and nothing deleted, once any session has attendance.
async function deleteLiveLesson(existing) {
  const sessions = await query(
    'SELECT content_id, live_class_id FROM dbo.contents WHERE content_id = @id OR (@slot IS NOT NULL AND live_slot_id = @slot)',
    { id: T.int(existing.content_id), slot: T.uuid(existing.live_slot_id ?? null) },
  );
  const ids = sessions.map((r) => Number(r.content_id)).join(',');
  const lcs = sessions.filter((r) => r.live_class_id).map((r) => Number(r.live_class_id)).join(',') || '0';
  const att = await one(`SELECT TOP 1 1 AS y FROM dbo.attendance WHERE live_class_id IN (${lcs})`);
  if (att) throw conflict('Students attended this lesson, so it cannot be deleted. Cancel it instead.', 'LIVE_HAS_ATTENDANCE');
  await withTransaction(async (tx) => {
    const tables = await one("SELECT OBJECT_ID('dbo.content_progress') AS cp, OBJECT_ID('dbo.offline_downloads') AS od", {}, tx);
    if (tables.cp) await query(`DELETE FROM dbo.content_progress WHERE content_id IN (${ids})`, {}, tx);
    if (tables.od) await query(`DELETE FROM dbo.offline_downloads WHERE content_id IN (${ids})`, {}, tx);
    await query(`DELETE FROM dbo.contents WHERE content_id IN (${ids})`, {}, tx);
    await query(`DELETE FROM dbo.live_classes WHERE live_class_id IN (${lcs})`, {}, tx);
  });
  return { deleted: true };
}

module.exports = { renameSlot, scheduleBatchSession, scheduleBatch, createLiveLesson, updateLiveLesson, setRecording, clearRecording, deleteLiveLesson };
