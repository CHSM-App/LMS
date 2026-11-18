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

// Returns the new content id.
async function createLiveLesson(teacherId, mod, b) {
  const f = await parseLive(teacherId, mod.course_id, b);
  if (f.startsAt <= clock.now()) throw badRequest('Choose a time in the future');
  return withTransaction(async (tx) => {
    const lcId = await liveClass.insertLiveClass(f, tx);
    const next = await one('SELECT ISNULL(MAX(sort_order), 0) + 1 AS n FROM dbo.contents WITH (UPDLOCK, HOLDLOCK) WHERE module_id = @m', { m: T.int(mod.id) }, tx);
    const row = await one(
      `INSERT INTO dbo.contents (module_id, course_id, title, type, live_class_id, sort_order, is_free_preview)
       OUTPUT INSERTED.content_id VALUES (@m, @c, @title, 'live', @lc, @o, 0)`,
      { m: T.int(mod.id), c: T.int(mod.course_id), title: T.nvarchar(f.title, 200), lc: T.int(lcId), o: T.int(next.n) },
      tx,
    );
    await liveClass.notifyNewClass(f, liveClass.lessonLink(mod.course_id, row.content_id), tx);
    return row.content_id;
  });
}

// existing: the content row joined with its live class (curriculum.loadContent).
async function updateLiveLesson(teacherId, existing, b) {
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
    await query('UPDATE dbo.contents SET title = @title WHERE content_id = @id', { title: T.nvarchar(f.title, 200), id: T.int(existing.content_id) }, tx);
  });
}

function assertLive(existing) {
  if (existing.type !== 'live') throw conflict('Only live lessons have recordings', 'NOT_LIVE_LESSON');
}

async function setRecording(teacherId, existing, b) {
  assertLive(existing);
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

// Refused once attendance exists, so the attendance record is never lost.
async function deleteLiveLesson(existing) {
  const p = { id: T.int(existing.content_id), lc: T.int(existing.live_class_id) };
  const att = await one('SELECT TOP 1 1 AS y FROM dbo.attendance WHERE live_class_id = @lc', p);
  if (att) throw conflict('Students attended this lesson, so it cannot be deleted. Cancel it instead.', 'LIVE_HAS_ATTENDANCE');
  await withTransaction(async (tx) => {
    const tables = await one("SELECT OBJECT_ID('dbo.content_progress') AS cp, OBJECT_ID('dbo.offline_downloads') AS od", {}, tx);
    if (tables.cp) await query('DELETE FROM dbo.content_progress WHERE content_id = @id', p, tx);
    if (tables.od) await query('DELETE FROM dbo.offline_downloads WHERE content_id = @id', p, tx);
    await query('DELETE FROM dbo.contents WHERE content_id = @id', p, tx);
    await query('DELETE FROM dbo.live_classes WHERE live_class_id = @lc', p, tx);
  });
  return { deleted: true };
}

module.exports = { createLiveLesson, updateLiveLesson, setRecording, clearRecording, deleteLiveLesson };
