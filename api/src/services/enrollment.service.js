const { query, one, T } = require('../db/query');
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
  const rows = await query(
    `${SELECT} WHERE e.teacher_id = @t AND e.status = 'approved' AND u.deleted_at IS NULL
       AND (@c IS NULL OR e.course_id = @c) AND (@b IS NULL OR e.batch_id = @b)
       AND (@q IS NULL OR u.name LIKE @q OR u.mobile LIKE @q)
     ORDER BY u.name`,
    { t: T.int(teacherId), c: T.int(courseId ? Number(courseId) : null), b: T.int(batchId ? Number(batchId) : null), q: T.nvarchar(q ? `%${q}%` : null, 140) },
  );
  return rows.map((r) => ({
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

module.exports = { list, approve, reject, moveBatch, students, setAccess, accessStatus };
