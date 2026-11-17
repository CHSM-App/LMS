const { query, T } = require('../db/query');
const { tableExists } = require('./accountHooks');
const { finalResult, rankRows } = require('../domain/exam');

const pct = (score, max) => (max > 0 ? Math.round((score / max) * 10000) / 100 : 0);

// Best submitted attempt per student, ranked. Optional batch filter (ranks within that batch).
async function examResults(examId, { batchId } = {}) {
  let batchFilter = '';
  const params = { e: T.int(examId) };
  if (batchId && (await tableExists('enrollments'))) {
    batchFilter = `AND a.student_id IN (SELECT student_id FROM dbo.enrollments WHERE batch_id = @b AND status = 'approved')`;
    params.b = T.int(Number(batchId));
  }
  const rows = await query(
    `WITH best AS (
       SELECT a.*, ROW_NUMBER() OVER (PARTITION BY a.student_id ORDER BY a.score * 1.0 / NULLIF(a.max_score, 0) DESC, a.submitted_at ASC) AS rn,
              COUNT(*) OVER (PARTITION BY a.student_id) AS attempts
       FROM dbo.exam_attempts a
       WHERE a.exam_id = @e AND a.submitted_at IS NOT NULL ${batchFilter}
     )
     SELECT b.attempt_id, b.score, b.max_score, b.passed, b.submitted_at, b.attempts, b.auto_submitted,
            u.public_id AS student_public_id, u.name AS student_name, u.mobile AS student_mobile
     FROM best b JOIN dbo.users u ON u.user_id = b.student_id
     WHERE b.rn = 1`,
    params,
  );
  return rankRows(
    rows.map((r) => ({
      attemptId: r.attempt_id,
      studentPublicId: r.student_public_id,
      studentName: r.student_name,
      // Visible to the owning teacher only (this route is teacher-scoped).
      studentMobile: r.student_mobile.startsWith('del-') ? null : r.student_mobile,
      score: Number(r.score),
      max: Number(r.max_score),
      pct: pct(Number(r.score), Number(r.max_score)),
      passed: r.passed,
      attempts: r.attempts,
      autoSubmitted: r.auto_submitted,
      submittedAt: r.submitted_at,
    })),
  );
}

async function courseExams(courseId) {
  const exams = await query(
    "SELECT exam_id, title, category, weightage, passing_pct FROM dbo.exams WHERE course_id = @c AND status = 'published'",
    { c: T.int(courseId) },
  );
  return exams.map((e) => ({ examId: e.exam_id, title: e.title, category: e.category, weightage: Number(e.weightage), passingPct: e.passing_pct === null ? null : Number(e.passing_pct) }));
}

async function attemptsFor(courseId, studentId) {
  const rows = await query(
    `SELECT a.exam_id, a.student_id, a.score, a.max_score, a.per_module_json
     FROM dbo.exam_attempts a JOIN dbo.exams e ON e.exam_id = a.exam_id
     WHERE e.course_id = @c AND a.submitted_at IS NOT NULL AND (@s IS NULL OR a.student_id = @s)`,
    { c: T.int(courseId), s: T.int(studentId ?? null) },
  );
  return rows.map((r) => ({
    examId: r.exam_id,
    studentId: r.student_id,
    score: Number(r.score),
    max: Number(r.max_score),
    perModule: r.per_module_json ? JSON.parse(r.per_module_json) : {},
  }));
}

// One student's weighted final result (used by the student app in Phase 9).
async function finalForStudent(courseId, studentId) {
  const exams = await courseExams(courseId);
  const r = finalResult(exams, await attemptsFor(courseId, studentId));
  r.exams = r.exams.map((x) => ({ ...x, title: (exams.find((e) => e.examId === x.examId) || {}).title }));
  return r;
}

// Every student who attempted a graded exam in the course.
async function finalForCourse(courseId) {
  const exams = await courseExams(courseId);
  const attempts = await attemptsFor(courseId, null);
  const ids = [...new Set(attempts.map((a) => a.studentId))];
  if (!ids.length) return [];
  const users = await query(
    `SELECT user_id, public_id, name FROM dbo.users WHERE user_id IN (SELECT CAST(value AS INT) FROM STRING_SPLIT(@ids, ','))`,
    { ids: T.varchar(ids.join(',')) },
  );
  return users
    .map((u) => {
      const r = finalResult(exams, attempts.filter((a) => a.studentId === u.user_id));
      return { studentPublicId: u.public_id, studentName: u.name, weightedPct: r.weightedPct, passed: r.passed, exams: r.exams };
    })
    .sort((a, b) => b.weightedPct - a.weightedPct);
}

// Final Exam unlocks after the student submitted every published Unit Test of the course (spec §5).
async function isFinalUnlocked(courseId, studentId) {
  const missing = await query(
    `SELECT e.exam_id FROM dbo.exams e
     WHERE e.course_id = @c AND e.status = 'published' AND e.category IN ('unit_test_1', 'unit_test_2')
       AND NOT EXISTS (SELECT 1 FROM dbo.exam_attempts a WHERE a.exam_id = e.exam_id AND a.student_id = @s AND a.submitted_at IS NOT NULL)`,
    { c: T.int(courseId), s: T.int(studentId) },
  );
  return missing.length === 0;
}

module.exports = { examResults, finalForStudent, finalForCourse, isFinalUnlocked };
