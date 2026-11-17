// Phase 7+ fixtures: students, demo requests and enrollments inserted directly.
const { query, one, T, createUser } = require('./helpers');

async function demoRequest(courseId, teacherId, over = {}) {
  return one(
    `INSERT INTO dbo.demo_requests (course_id, teacher_id, name, mobile, education, status)
     OUTPUT INSERTED.* VALUES (@c, @t, @n, @m, @e, 'pending')`,
    { c: T.int(courseId), t: T.int(teacherId), n: T.nvarchar(over.name || 'Asha', 120), m: T.varchar(over.mobile || '+919811100001', 20), e: T.nvarchar('12th', 120) },
  );
}

async function student(over = {}) {
  return createUser({ role: 'student', ...over });
}

async function enrollment(courseId, teacherId, studentId, { status = 'pending', batchId = null } = {}) {
  return one(
    `INSERT INTO dbo.enrollments (student_id, course_id, teacher_id, batch_id, status, requested_at)
     OUTPUT INSERTED.* VALUES (@s, @c, @t, @b, @st, SYSUTCDATETIME())`,
    { s: T.int(studentId), c: T.int(courseId), t: T.int(teacherId), b: T.int(batchId), st: T.varchar(status, 10) },
  );
}

async function activeEnrollment(courseId, teacherId, studentId, batchId, { start = '2020-01-01', end = '2099-12-31', access = true } = {}) {
  const e = await enrollment(courseId, teacherId, studentId, { status: 'approved', batchId });
  await query(
    'INSERT INTO dbo.student_subscriptions (enrollment_id, start_date, end_date, access_enabled) VALUES (@e, @s, @x, @a)',
    { e: T.int(e.enrollment_id), s: T.date(start), x: T.date(end), a: T.bit(access) },
  );
  return e;
}

module.exports = { demoRequest, student, enrollment, activeEnrollment, query, one, T };
