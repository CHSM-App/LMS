// Course access for students. Normal: approved enrollment + access on + today (IST) within the dates.
// Teacher blocked (spec §6): read-only, and only lessons the student already completed.
const { one, T } = require('../db/query');
const { forBatchSql } = require('./liveSlots');
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
    l.meet_link AS live_meet_link, l.status AS live_status,
    (SELECT STRING_AGG(CAST(ly.batch_id AS VARCHAR(12)), ',') FROM dbo.contents y JOIN dbo.live_classes ly ON ly.live_class_id = y.live_class_id
      WHERE y.live_slot_id = x.live_slot_id AND ly.batch_id IS NOT NULL) AS slot_batch_ids
  FROM dbo.contents x LEFT JOIN dbo.live_classes l ON l.live_class_id = x.live_class_id`;

// Live lesson rules; need aliases x (contents) and l (live_classes) and the student's batch expression.
// Own session: a live class for the student's batch, or for all batches when the batch has none of its own.
const ownSql = (batchExpr) => `(x.live_class_id IS NOT NULL AND ${forBatchSql('l', batchExpr)})`;
// Placeholder: the student's batch has no session of the lesson yet, so its first row stands in as "Schedule coming soon"
// (shown without date, Meet link or recording).
const placeholderSql = (batchExpr) => `(x.type = 'live' AND x.live_slot_id IS NOT NULL
  AND x.content_id = (SELECT MIN(y.content_id) FROM dbo.contents y WHERE y.live_slot_id = x.live_slot_id)
  AND NOT EXISTS (SELECT 1 FROM dbo.contents y JOIN dbo.live_classes ly ON ly.live_class_id = y.live_class_id
                  WHERE y.live_slot_id = x.live_slot_id AND (ly.batch_id IS NULL OR ly.batch_id = ${batchExpr})))`;
const visibleSql = (batchExpr) => `(x.type <> 'live' OR ${ownSql(batchExpr)} OR ${placeholderSql(batchExpr)})`;
// Lessons that count for progress and "next lesson": placeholders ("Schedule coming soon") do not.
const countedSql = (batchExpr) => `(x.type <> 'live' OR ${ownSql(batchExpr)})`;
// 1 when the row is shown as a placeholder (not the student's own session).
const placeholderFlagSql = (batchExpr) => `CASE WHEN ${ownSql(batchExpr)} THEN 0 ELSE 1 END`;

// c: row from CONTENT_SQL. Same rule as ownSql.
const isVisible = (c, enrollment) => {
  if (!c.live_class_id) return true;
  const mine = enrollment && enrollment.batch_id;
  if (c.live_batch_id) return c.live_batch_id === mine;
  return !String(c.slot_batch_ids || '').split(',').includes(String(mine));
};

const loadContent = (contentId) => {
  const id = Number(contentId);
  if (!Number.isInteger(id) || id <= 0) return null;
  return one(`${CONTENT_SQL} WHERE x.content_id = @id`, { id: T.int(id) });
};

async function isPlaceholder(c, enrollment) {
  const r = await one(`SELECT 1 AS y FROM dbo.contents x WHERE x.content_id = @id AND ${placeholderSql('@b')}`, {
    id: T.int(c.content_id), b: T.int((enrollment && enrollment.batch_id) ?? null),
  });
  return !!r;
}

async function contentWithAccess(studentId, contentId) {
  const c = await loadContent(contentId);
  if (!c) throw new APIError(404, 'Lesson not found');
  const access = await courseAccess(studentId, c.course_id);
  if (!isVisible(c, access.enrollment)) {
    if (!(await isPlaceholder(c, access.enrollment))) throw new APIError(404, 'Lesson not found');
    c.is_placeholder = 1;
  } else if (c.type === 'live' && !c.live_class_id) c.is_placeholder = 1;
  const progress = await one('SELECT last_position_sec, completed_at FROM dbo.content_progress WHERE student_id = @s AND content_id = @c', {
    s: T.int(studentId), c: T.int(c.content_id),
  });
  if (access.readOnly && !(progress && progress.completed_at)) throw new APIError(403, READ_ONLY_MSG, 'READ_ONLY');
  return { content: c, ...access, progress };
}

module.exports = { courseAccess, requireWritable, contentWithAccess, loadContent, isVisible, visibleSql, countedSql, placeholderFlagSql, READ_ONLY_MSG };
