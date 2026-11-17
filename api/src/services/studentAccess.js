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

async function contentWithAccess(studentId, contentId) {
  const c = await one('SELECT * FROM dbo.contents WHERE content_id = @id', { id: T.int(Number(contentId)) });
  if (!c) throw new APIError(404, 'Lesson not found');
  const access = await courseAccess(studentId, c.course_id);
  const progress = await one('SELECT last_position_sec, completed_at FROM dbo.content_progress WHERE student_id = @s AND content_id = @c', {
    s: T.int(studentId), c: T.int(c.content_id),
  });
  if (access.readOnly && !(progress && progress.completed_at)) throw new APIError(403, READ_ONLY_MSG, 'READ_ONLY');
  return { content: c, ...access, progress };
}

module.exports = { courseAccess, requireWritable, contentWithAccess, READ_ONLY_MSG };
