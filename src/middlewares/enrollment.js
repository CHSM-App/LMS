const { one, T } = require('../db/query');
const { todayIST } = require('../utils/clock');
const { APIError } = require('../utils/APIError');

const iso = (d) => new Date(d).toISOString().slice(0, 10);

// Student may use a course only with an approved enrollment, access switched on, and today (IST) inside the dates.
// Sets req.enrollment. Blocked-teacher read-only handling is added in Phase 9.
async function loadEnrollment(studentId, courseId) {
  return one(
    `SELECT e.enrollment_id, e.course_id, e.batch_id, e.teacher_id, e.status, s.start_date, s.end_date, s.access_enabled,
            t.status AS teacher_status
     FROM dbo.enrollments e
     JOIN dbo.users t ON t.user_id = e.teacher_id
     LEFT JOIN dbo.student_subscriptions s ON s.enrollment_id = e.enrollment_id
     WHERE e.student_id = @s AND e.course_id = @c`,
    { s: T.int(studentId), c: T.int(Number(courseId)) },
  );
}

function accessError(e) {
  if (!e || e.status !== 'approved' || !e.start_date) return new APIError(403, "You're not enrolled in this course", 'NOT_ENROLLED');
  if (!e.access_enabled) return new APIError(403, 'Your access to this course is paused', 'ACCESS_PAUSED');
  const today = todayIST();
  if (today < iso(e.start_date)) return new APIError(403, `Your access starts on ${iso(e.start_date)}`, 'ACCESS_NOT_STARTED');
  if (today > iso(e.end_date)) return new APIError(403, 'Your access to this course has ended', 'ACCESS_ENDED');
  return null;
}

async function requireActiveEnrollment(req, res, next) {
  try {
    const e = await loadEnrollment(req.user.id, req.params.courseId);
    const err = accessError(e);
    if (err) return next(err);
    req.enrollment = e;
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { requireActiveEnrollment, loadEnrollment, accessError };
