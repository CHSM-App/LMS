const { query, one, T } = require('../db/query');
const { heldForSql } = require('./liveSlots');
const { withTransaction } = require('../db/tx');
const { notify } = require('./notification.service');
const { clock, todayIST } = require('../utils/clock');
const { isoDate, text } = require('../utils/validate');
const { badRequest, conflict, notFound } = require('../utils/APIError');

const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);

function accessStatus(row, today = todayIST()) {
  if (!row.start_date) return 'pending';
  if (!row.access_enabled) return 'paused';
  if (today < iso(row.start_date)) return 'upcoming';
  if (today > iso(row.end_date)) return 'expired';
  return 'active';
}

const SELECT = `SELECT e.*, c.title AS course_title, u.public_id AS student_public_id, u.name AS student_name, u.mobile AS student_mobile,
                       b.name AS batch_name, s.start_date, s.end_date, s.access_enabled, p.education
                FROM dbo.enrollments e
                JOIN dbo.courses c ON c.course_id = e.course_id
                JOIN dbo.users u ON u.user_id = e.student_id
                LEFT JOIN dbo.student_profiles p ON p.user_id = e.student_id
                LEFT JOIN dbo.batches b ON b.batch_id = e.batch_id
                LEFT JOIN dbo.student_subscriptions s ON s.enrollment_id = e.enrollment_id`;

const out = (r) => ({
  id: r.enrollment_id,
  course: { id: r.course_id, title: r.course_title },
  student: { publicId: r.student_public_id, name: r.student_name, mobile: r.student_mobile, education: r.education },
  batch: r.batch_id ? { id: r.batch_id, name: r.batch_name } : null,
  status: r.status,
  message: r.message,
  rejectReason: r.reject_reason,
  requestedAt: r.requested_at,
  decidedAt: r.decided_at,
  access: r.start_date ? { startDate: iso(r.start_date), endDate: iso(r.end_date), accessEnabled: r.access_enabled, status: accessStatus(r) } : null,
});

async function owned(id, teacherId, tx, lock = false) {
  const r = await one(
    `${SELECT.replace('FROM dbo.enrollments e', `FROM dbo.enrollments e${lock ? ' WITH (UPDLOCK, HOLDLOCK)' : ''}`)} WHERE e.enrollment_id = @id AND e.teacher_id = @t`,
    { id: T.int(Number(id)), t: T.int(teacherId) },
    tx,
  );
  if (!r) throw notFound('Request not found');
  return r;
}

async function list(teacherId, { status, courseId }) {
  const rows = await query(
    `${SELECT} WHERE e.teacher_id = @t AND (@s IS NULL OR e.status = @s) AND (@c IS NULL OR e.course_id = @c) ORDER BY e.requested_at DESC`,
    { t: T.int(teacherId), s: T.varchar(status || null, 10), c: T.int(courseId ? Number(courseId) : null) },
  );
  return rows.map(out);
}

function dates(body) {
  const startDate = isoDate(body.startDate, 'startDate');
  const endDate = isoDate(body.endDate, 'endDate');
  if (endDate < startDate) throw badRequest('End date must be on or after start date', 'DATE_ORDER');
  return { startDate, endDate };
}

// Batch must belong to the course, be active and have room (locked so two approvals can't overfill it).
async function assertBatchOpen(batchId, courseId, tx, exceptEnrollmentId = null) {
  const b = await one('SELECT * FROM dbo.batches WITH (UPDLOCK, HOLDLOCK) WHERE batch_id = @b AND course_id = @c', { b: T.int(batchId), c: T.int(courseId) }, tx);
  if (!b) throw badRequest('Choose a batch of this course');
  if (b.status !== 'active') throw conflict('This batch is closed', 'BATCH_CLOSED');
  if (b.max_students) {
    const n = await one(
      "SELECT COUNT(*) n FROM dbo.enrollments WITH (UPDLOCK, HOLDLOCK) WHERE batch_id = @b AND status = 'approved' AND (@x IS NULL OR enrollment_id <> @x)",
      { b: T.int(batchId), x: T.int(exceptEnrollmentId) },
      tx,
    );
    if (n.n >= b.max_students) throw conflict(`This batch is full (${b.max_students} students)`, 'BATCH_FULL');
  }
  return b;
}

async function approve(id, teacherId, body) {
  const batchId = Number(body.batchId);
  if (!Number.isInteger(batchId) || batchId <= 0) throw badRequest('batchId: choose a batch', 'BATCH_REQUIRED');
  const { startDate, endDate } = dates(body);
  const result = await withTransaction(async (tx) => {
    const e = await owned(id, teacherId, tx, true);
    if (e.status !== 'pending') throw conflict(`This request is already ${e.status}`, 'ENROLLMENT_DECIDED');
    const b = await assertBatchOpen(batchId, e.course_id, tx);
    await query("UPDATE dbo.enrollments SET status = 'approved', batch_id = @b, decided_at = @now WHERE enrollment_id = @id", {
      b: T.int(batchId), now: T.datetime(clock.now()), id: T.int(e.enrollment_id),
    }, tx);
    await query('INSERT INTO dbo.student_subscriptions (enrollment_id, start_date, end_date) VALUES (@e, @s, @x)', {
      e: T.int(e.enrollment_id), s: T.date(startDate), x: T.date(endDate),
    }, tx);
    await notify(e.student_id, {
      key: 'enrollment.approved',
      vars: { course: e.course_title, batch: b.name },
      link: '/student',
      whatsapp: { key: 'wa.enrollmentApproved', template: 'enrollment_approved' },
    }, tx);
    return e.enrollment_id;
  });
  return out(await owned(result, teacherId));
}

async function reject(id, teacherId, body) {
  const reason = text(body.reason, 'reason', { min: 5, max: 500 });
  await withTransaction(async (tx) => {
    const e = await owned(id, teacherId, tx, true);
    if (e.status !== 'pending') throw conflict(`This request is already ${e.status}`, 'ENROLLMENT_DECIDED');
    await query("UPDATE dbo.enrollments SET status = 'rejected', reject_reason = @r, decided_at = @now WHERE enrollment_id = @id", {
      r: T.nvarchar(reason, 500), now: T.datetime(clock.now()), id: T.int(e.enrollment_id),
    }, tx);
    await notify(e.student_id, { key: 'enrollment.rejected', vars: { course: e.course_title, reason }, link: '/student' }, tx);
  });
  return out(await owned(id, teacherId));
}

async function moveBatch(id, teacherId, body) {
  const batchId = Number(body.batchId);
  if (!Number.isInteger(batchId) || batchId <= 0) throw badRequest('batchId: choose a batch');
  await withTransaction(async (tx) => {
    const e = await owned(id, teacherId, tx, true);
    if (e.status !== 'approved') throw conflict('Only enrolled students can change batch');
    const b = await assertBatchOpen(batchId, e.course_id, tx, e.enrollment_id);
    await query('UPDATE dbo.enrollments SET batch_id = @b WHERE enrollment_id = @id', { b: T.int(batchId), id: T.int(e.enrollment_id) }, tx);
    await notify(e.student_id, { key: 'batch.changed', vars: { course: e.course_title, batch: b.name }, link: '/student' }, tx);
  });
  return out(await owned(id, teacherId));
}

// Teacher's enrolled students (approved), with access status.
async function students(teacherId, { courseId, batchId, q }) {
  const params = { t: T.int(teacherId), c: T.int(courseId ? Number(courseId) : null), b: T.int(batchId ? Number(batchId) : null), q: T.nvarchar(q ? `%${q}%` : null, 140) };
  const rows = await query(
    `${SELECT} WHERE e.teacher_id = @t AND e.status = 'approved' AND u.deleted_at IS NULL
       AND (@c IS NULL OR e.course_id = @c) AND (@b IS NULL OR e.batch_id = @b)
       AND (@q IS NULL OR u.name LIKE @q OR u.mobile LIKE @q)
     ORDER BY u.name`,
    params,
  );
  // Attendance per enrollment (so a student in two courses gets one figure per course).
  // Held = this enrollment's classes (course-wide or its batch) where attendance was taken, same rule as the student's own progress.
  const att = new Map();
  if (rows.length) {
    const stats = await query(
      `SELECT e.enrollment_id,
              (SELECT COUNT(*) FROM dbo.live_classes l
                WHERE l.course_id = e.course_id AND ${heldForSql('l', 'e.batch_id', 'e.student_id')} AND l.status <> 'cancelled'
                  AND EXISTS (SELECT 1 FROM dbo.attendance a WHERE a.live_class_id = l.live_class_id)) AS held,
              (SELECT COUNT(*) FROM dbo.attendance a JOIN dbo.live_classes l ON l.live_class_id = a.live_class_id
                WHERE l.course_id = e.course_id AND a.student_id = e.student_id AND a.present = 1) AS attended
       FROM dbo.enrollments e JOIN dbo.users u ON u.user_id = e.student_id
       WHERE e.teacher_id = @t AND e.status = 'approved' AND u.deleted_at IS NULL
         AND (@c IS NULL OR e.course_id = @c) AND (@b IS NULL OR e.batch_id = @b)
         AND (@q IS NULL OR u.name LIKE @q OR u.mobile LIKE @q)`,
      params,
    );
    stats.forEach((x) => att.set(x.enrollment_id, { held: x.held, attended: x.attended, pct: x.held > 0 ? Math.round((x.attended / x.held) * 100) : 0 }));
  }
  return rows.map((r) => ({
    attendance: att.get(r.enrollment_id) || { held: 0, attended: 0, pct: 0 },
    enrollmentId: r.enrollment_id,
    publicId: r.student_public_id,
    name: r.student_name,
    mobile: r.student_mobile,
    education: r.education,
    course: { id: r.course_id, title: r.course_title },
    batch: r.batch_id ? { id: r.batch_id, name: r.batch_name } : null,
    enrolledAt: r.decided_at,
    startDate: iso(r.start_date),
    endDate: iso(r.end_date),
    accessEnabled: r.access_enabled,
    subscriptionStatus: accessStatus(r),
  }));
}

// Attendance calendar of one student across all of this teacher's courses they are enrolled in.
// Days are IST days; only classes where attendance was taken (and not cancelled) appear.
async function studentAttendance(teacherId, studentPublicId, month) {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(String(month || ''));
  if (!m) throw badRequest('month: use YYYY-MM');
  const [year, mon] = [Number(m[1]), Number(m[2])];
  const IST = 330 * 60000;
  const from = new Date(Date.UTC(year, mon - 1, 1) - IST);
  const to = new Date(Date.UTC(year, mon, 1) - IST);
  const stu = await one(
    `SELECT u.user_id, u.public_id, u.name FROM dbo.users u
     WHERE u.public_id = @p AND u.deleted_at IS NULL
       AND EXISTS (SELECT 1 FROM dbo.enrollments e WHERE e.student_id = u.user_id AND e.teacher_id = @t AND e.status = 'approved')`,
    { p: T.uuid(studentPublicId), t: T.int(teacherId) },
  );
  if (!stu) throw notFound('Student not found');
  const courses = await query(
    `SELECT c.course_id, c.title FROM dbo.enrollments e JOIN dbo.courses c ON c.course_id = e.course_id
     WHERE e.student_id = @s AND e.teacher_id = @t AND e.status = 'approved' ORDER BY c.title`,
    { s: T.int(stu.user_id), t: T.int(teacherId) },
  );
  const rows = await query(
    `SELECT l.live_class_id, l.course_id, c.title AS course_title, l.topic, l.starts_at, a.present
     FROM dbo.attendance a
     JOIN dbo.live_classes l ON l.live_class_id = a.live_class_id
     JOIN dbo.courses c ON c.course_id = l.course_id
     WHERE a.student_id = @s AND l.status <> 'cancelled' AND l.starts_at >= @from AND l.starts_at < @to
       AND EXISTS (SELECT 1 FROM dbo.enrollments e WHERE e.student_id = @s AND e.teacher_id = @t AND e.status = 'approved' AND e.course_id = l.course_id)
     ORDER BY l.starts_at, l.live_class_id`,
    { s: T.int(stu.user_id), t: T.int(teacherId), from: T.datetime(from), to: T.datetime(to) },
  );
  const days = new Map();
  for (const r of rows) {
    const ist = new Date(new Date(r.starts_at).getTime() + IST).toISOString();
    const date = ist.slice(0, 10);
    if (!days.has(date)) days.set(date, { date, classes: [] });
    days.get(date).classes.push({
      liveClassId: r.live_class_id,
      course: { id: r.course_id, title: r.course_title },
      topic: r.topic,
      time: ist.slice(11, 16),
      present: !!r.present,
    });
  }
  return {
    student: { publicId: stu.public_id, name: stu.name },
    month: `${m[1]}-${m[2]}`,
    courses: courses.map((c) => ({ id: c.course_id, title: c.title })),
    days: [...days.values()],
  };
}

async function setAccess(teacherId, studentPublicId, courseId, body) {
  const { startDate, endDate } = dates(body);
  const accessEnabled = body.accessEnabled !== false && body.accessEnabled !== 'false';
  await withTransaction(async (tx) => {
    const e = await one(
      `SELECT e.enrollment_id FROM dbo.enrollments e JOIN dbo.users u ON u.user_id = e.student_id
       WHERE u.public_id = @p AND e.course_id = @c AND e.teacher_id = @t AND e.status = 'approved'`,
      { p: T.uuid(studentPublicId), c: T.int(Number(courseId)), t: T.int(teacherId) },
      tx,
    );
    if (!e) throw notFound('Student not found in this course');
    const updated = await query(
      'UPDATE dbo.student_subscriptions SET start_date = @s, end_date = @x, access_enabled = @a OUTPUT INSERTED.enrollment_id WHERE enrollment_id = @e',
      { s: T.date(startDate), x: T.date(endDate), a: T.bit(accessEnabled), e: T.int(e.enrollment_id) },
      tx,
    );
    if (!updated.length) {
      await query('INSERT INTO dbo.student_subscriptions (enrollment_id, start_date, end_date, access_enabled) VALUES (@e, @s, @x, @a)', {
        e: T.int(e.enrollment_id), s: T.date(startDate), x: T.date(endDate), a: T.bit(accessEnabled),
      }, tx);
    }
  });
  return { startDate, endDate, accessEnabled };
}

module.exports = { list, approve, reject, moveBatch, students, studentAttendance, setAccess, accessStatus };
