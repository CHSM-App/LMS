const { query, one, T } = require('../db/query');
const { withTransaction } = require('../db/tx');
const meet = require('../providers/meet');
const whatsapp = require('../providers/whatsapp');
const { notifyMany } = require('./notification.service');
const { msg } = require('../i18n/messages');
const { owned } = require('./ownership');
const { clock } = require('../utils/clock');
const { text } = require('../utils/validate');
const { badRequest, notFound } = require('../utils/APIError');

const istParts = (d) => {
  const x = new Date(new Date(d).getTime() + 330 * 60000).toISOString();
  return { date: x.slice(0, 10), time: x.slice(11, 16) };
};

const out = (r) => ({
  id: r.live_class_id,
  course: { id: r.course_id, title: r.course_title },
  batch: r.batch_id ? { id: r.batch_id, name: r.batch_name } : null,
  topic: r.topic,
  startsAt: r.starts_at,
  durationMin: r.duration_min,
  meetLink: r.meet_link,
  status: r.status,
});

const SELECT = `SELECT l.*, c.title AS course_title, c.teacher_id, b.name AS batch_name FROM dbo.live_classes l
                JOIN dbo.courses c ON c.course_id = l.course_id LEFT JOIN dbo.batches b ON b.batch_id = l.batch_id`;

async function get(id, teacherId) {
  const r = await one(`${SELECT} WHERE l.live_class_id = @id`, { id: T.int(Number(id)) });
  if (!r || (teacherId && r.teacher_id !== teacherId)) throw notFound('Live class not found');
  return r;
}

// Students the class is for: approved enrollments of the course, in the batch (or every batch when batch is null).
async function targetStudents(courseId, batchId, tx) {
  return query(
    `SELECT u.user_id, u.public_id, u.name, u.mobile, u.whatsapp_opt_in, u.preferred_lang
     FROM dbo.enrollments e JOIN dbo.users u ON u.user_id = e.student_id
     WHERE e.course_id = @c AND e.status = 'approved' AND u.deleted_at IS NULL AND (@b IS NULL OR e.batch_id = @b)
     ORDER BY u.name`,
    { c: T.int(courseId), b: T.int(batchId ?? null) },
    tx,
  );
}

async function parse(teacherId, b) {
  const course = await owned('course', b.courseId, teacherId);
  let batchId = b.batchId ? Number(b.batchId) : null;
  if (batchId) {
    const batch = await one('SELECT batch_id FROM dbo.batches WHERE batch_id = @b AND course_id = @c', { b: T.int(batchId), c: T.int(course.id) });
    if (!batch) throw badRequest('Choose a batch of this course');
  } else batchId = null;
  const startsAt = new Date(b.startsAt);
  if (!b.startsAt || Number.isNaN(startsAt.getTime())) throw badRequest('startsAt: choose a date and time');
  const durationMin = b.durationMin ? Number(b.durationMin) : 60;
  if (!Number.isInteger(durationMin) || durationMin < 5 || durationMin > 600) throw badRequest('durationMin: 5 to 600 minutes');
  let meetLink = b.meetLink ? String(b.meetLink).trim() : null;
  if (meetLink && !meet.isMeetLink(meetLink)) throw badRequest('Enter a Google Meet link like https://meet.google.com/abc-defg-hij', 'INVALID_MEET_LINK');
  const topic = text(b.topic, 'topic', { max: 200 });
  if (!meetLink) meetLink = await meet.createLink({ title: topic, start: startsAt, durationMin });
  if (!meetLink) throw badRequest('Paste a Meet link', 'MEET_LINK_REQUIRED');
  return { courseId: course.id, batchId, topic, startsAt, durationMin, meetLink, status: b.status || 'scheduled' };
}

async function create(teacherId, body) {
  const f = await parse(teacherId, body);
  if (f.startsAt <= clock.now()) throw badRequest('Choose a time in the future');
  const id = await withTransaction(async (tx) => {
    const row = await one(
      `INSERT INTO dbo.live_classes (course_id, batch_id, topic, starts_at, duration_min, meet_link)
       OUTPUT INSERTED.live_class_id VALUES (@c, @b, @t, @s, @d, @l)`,
      { c: T.int(f.courseId), b: T.int(f.batchId), t: T.nvarchar(f.topic, 200), s: T.datetime(f.startsAt), d: T.int(f.durationMin), l: T.varchar(f.meetLink, 300) },
      tx,
    );
    const { date, time } = istParts(f.startsAt);
    const students = await targetStudents(f.courseId, f.batchId, tx);
    await notifyMany(students.map((s) => s.user_id), { key: 'liveClass.new', vars: { topic: f.topic, date, time }, link: '/student/live-classes' }, tx);
    return row.live_class_id;
  });
  return out(await get(id));
}

async function update(id, teacherId, body) {
  await get(id, teacherId);
  const f = await parse(teacherId, body);
  if (!['scheduled', 'live', 'completed', 'cancelled'].includes(f.status)) throw badRequest('status: scheduled, live, completed or cancelled');
  await query(
    `UPDATE dbo.live_classes SET course_id = @c, batch_id = @b, topic = @t, starts_at = @s, duration_min = @d, meet_link = @l, status = @st,
       reminder_sent_at = CASE WHEN starts_at <> @s THEN NULL ELSE reminder_sent_at END WHERE live_class_id = @id`,
    { c: T.int(f.courseId), b: T.int(f.batchId), t: T.nvarchar(f.topic, 200), s: T.datetime(f.startsAt), d: T.int(f.durationMin), l: T.varchar(f.meetLink, 300), st: T.varchar(f.status, 10), id: T.int(Number(id)) },
  );
  return out(await get(id));
}

async function cancel(id, teacherId) {
  await get(id, teacherId);
  await query("UPDATE dbo.live_classes SET status = 'cancelled' WHERE live_class_id = @id", { id: T.int(Number(id)) });
  return out(await get(id));
}

async function list(teacherId, { courseId, from }) {
  const rows = await query(
    `${SELECT} WHERE c.teacher_id = @t AND (@c IS NULL OR l.course_id = @c) AND (@f IS NULL OR l.starts_at >= @f) ORDER BY l.starts_at DESC`,
    { t: T.int(teacherId), c: T.int(courseId ? Number(courseId) : null), f: T.datetime(from ? new Date(from) : null) },
  );
  return rows.map(out);
}

async function attendanceSheet(id, teacherId) {
  const lc = await get(id, teacherId);
  const students = await targetStudents(lc.course_id, lc.batch_id);
  const marks = await query('SELECT student_id, present FROM dbo.attendance WHERE live_class_id = @id', { id: T.int(lc.live_class_id) });
  return students.map((s) => {
    const m = marks.find((x) => x.student_id === s.user_id);
    return { studentPublicId: s.public_id, name: s.name, present: m ? m.present : null };
  });
}

// records: [{ studentPublicId, present }]. Upsert; every student must be one the class is for.
async function saveAttendance(id, teacherId, records) {
  const lc = await get(id, teacherId);
  if (!Array.isArray(records) || !records.length) throw badRequest('records: mark at least one student');
  const allowed = await targetStudents(lc.course_id, lc.batch_id);
  const byPublic = new Map(allowed.map((s) => [String(s.public_id).toLowerCase(), s.user_id]));
  const resolved = records.map((r) => ({ studentId: byPublic.get(String(r.studentPublicId).toLowerCase()), present: !!r.present }));
  if (resolved.some((r) => !r.studentId)) throw badRequest('Some students are not in this class', 'NOT_IN_CLASS');
  await withTransaction(async (tx) => {
    for (const r of resolved) {
      const updated = await query(
        'UPDATE dbo.attendance WITH (UPDLOCK, SERIALIZABLE) SET present = @p, marked_at = @now OUTPUT INSERTED.student_id WHERE live_class_id = @l AND student_id = @s',
        { p: T.bit(r.present), now: T.datetime(clock.now()), l: T.int(lc.live_class_id), s: T.int(r.studentId) },
        tx,
      );
      if (!updated.length) {
        await query('INSERT INTO dbo.attendance (live_class_id, student_id, present, marked_at) VALUES (@l, @s, @p, @now)', {
          l: T.int(lc.live_class_id), s: T.int(r.studentId), p: T.bit(r.present), now: T.datetime(clock.now()),
        }, tx);
      }
    }
  });
  return attendanceSheet(id, teacherId);
}

// Job: 30 minutes before a class, notify its students once (WhatsApp too if they opted in).
async function runLiveClassReminders() {
  const now = clock.now();
  const due = await query(
    `${SELECT} WHERE l.status = 'scheduled' AND l.reminder_sent_at IS NULL AND l.starts_at > @now AND l.starts_at <= @soon`,
    { now: T.datetime(now), soon: T.datetime(new Date(now.getTime() + 30 * 60000)) },
  );
  for (const lc of due) {
    const claimed = await query(
      'UPDATE dbo.live_classes SET reminder_sent_at = @now OUTPUT INSERTED.live_class_id WHERE live_class_id = @id AND reminder_sent_at IS NULL',
      { now: T.datetime(now), id: T.int(lc.live_class_id) },
    );
    if (!claimed.length) continue;
    const { date, time } = istParts(lc.starts_at);
    const students = await targetStudents(lc.course_id, lc.batch_id);
    await notifyMany(students.map((s) => s.user_id), { key: 'liveClass.reminder', vars: { topic: lc.topic, time }, link: '/student/live-classes' });
    for (const s of students.filter((x) => x.whatsapp_opt_in)) {
      await whatsapp.send(s.mobile, msg(s.preferred_lang, 'wa.liveClass', { topic: lc.topic, course: lc.course_title, date, time, link: lc.meet_link }), { template: 'live_class' }).catch(() => null);
    }
  }
  return due.length;
}

module.exports = { create, update, cancel, list, get, out, attendanceSheet, saveAttendance, runLiveClassReminders, targetStudents };
