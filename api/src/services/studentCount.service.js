const { query, T } = require('../db/query');
const { tableExists } = require('./accountHooks');
const { todayIST } = require('../utils/clock');

// Students counted per teacher = approved enrollments whose access is on and whose dates include today (IST).
// Returns Map<teacherId, count>. Before the enrollment tables exist (Phase 7) every count is 0.
async function countActiveByTeacher(teacherIds) {
  const result = new Map(teacherIds.map((id) => [id, 0]));
  if (!teacherIds.length || !(await tableExists('enrollments'))) return result;
  const ids = teacherIds.filter((x) => Number.isInteger(x)).join(',');
  const rows = await query(
    `SELECT e.teacher_id, COUNT(DISTINCT e.student_id) AS n
     FROM dbo.enrollments e
     JOIN dbo.student_subscriptions s ON s.enrollment_id = e.enrollment_id
     JOIN dbo.users u ON u.user_id = e.student_id AND u.deleted_at IS NULL
     WHERE e.status = 'approved' AND s.access_enabled = 1
       AND @today BETWEEN s.start_date AND s.end_date
       AND e.teacher_id IN (SELECT value FROM STRING_SPLIT(@ids, ','))
     GROUP BY e.teacher_id`,
    { today: T.date(todayIST()), ids: T.varchar(ids) },
  );
  for (const r of rows) result.set(r.teacher_id, r.n);
  return result;
}

module.exports = { countActiveByTeacher };
