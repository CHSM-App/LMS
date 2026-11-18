// Course access for students. Normal: approved enrollment + access on + today (IST) within the dates.
// Teacher blocked (spec §6): read-only, and only lessons the student already completed.
const { one, T } = require('../db/query');
const { APIError } = require('../utils/APIError');
const { accessError, loadEnrollment } = require('../middlewares/enrollment');

const READ_ONLY_MSG = "This course is read-only because the teacher's account is inactive";

async function courseAccess(studentId, courseId) {
  const e = await loadEnrollment(studentId, courseId);
  if (e && e.status === 'approved' && e.teacher_status === 'blocked') return { enrollment: e, readOnly: true };
  const err = accessError(e);
  if (err) throw err;
  return { enrollment: e, readOnly: false };
}

// For writes (progress, doubts, exams, downloads of new lessons).
async function requireWritable(studentId, courseId) {
  const a = await courseAccess(studentId, courseId);
  if (a.readOnly) throw new APIError(403, READ_ONLY_MSG, 'READ_ONLY');
  return a;
}

// Contents with their live class (live lessons). A live lesson for one batch is invisible to other batches.
const CONTENT_SQL = `SELECT x.*, l.batch_id AS live_batch_id, l.starts_at AS live_starts_at, l.duration_min AS live_duration_min,
    l.meet_link AS live_meet_link, l.status AS live_status
  FROM dbo.contents x LEFT JOIN dbo.live_classes l ON l.live_class_id = x.live_class_id`;

// The same rule as SQL; needs aliases x (contents) and l (live_classes) and the student's batch expression.
const visibleSql = (batchExpr) => `(x.live_class_id IS NULL OR l.batch_id IS NULL OR l.batch_id = ${batchExpr})`;

const isVisible = (c, enrollment) => !c.live_class_id || !c.live_batch_id || c.live_batch_id === (enrollment && enrollment.batch_id);

const loadContent = (contentId) => {
  const id = Number(contentId);
  if (!Number.isInteger(id) || id <= 0) return null;
  return one(`${CONTENT_SQL} WHERE x.content_id = @id`, { id: T.int(id) });
};

async function contentWithAccess(studentId, contentId) {
  const c = await loadContent(contentId);
  if (!c) throw new APIError(404, 'Lesson not found');
  const access = await courseAccess(studentId, c.course_id);
  if (!isVisible(c, access.enrollment)) throw new APIError(404, 'Lesson not found');
  const progress = await one('SELECT last_position_sec, completed_at FROM dbo.content_progress WHERE student_id = @s AND content_id = @c', {
    s: T.int(studentId), c: T.int(c.content_id),
  });
  if (access.readOnly && !(progress && progress.completed_at)) throw new APIError(403, READ_ONLY_MSG, 'READ_ONLY');
  return { content: c, ...access, progress };
}

module.exports = { courseAccess, requireWritable, contentWithAccess, loadContent, isVisible, visibleSql, READ_ONLY_MSG };
