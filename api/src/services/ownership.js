const { one, T } = require('../db/query');
const { notFound } = require('../utils/APIError');

// Resolve an entity and confirm it belongs to the teacher. Another teacher's id is a 404
// (never 403) so ids can't be probed.
const SQL = {
  course: 'SELECT c.course_id, c.course_id AS id, c.teacher_id, c.status FROM dbo.courses c WHERE c.course_id = @id',
  subject: 'SELECT s.subject_id AS id, s.course_id, c.teacher_id FROM dbo.subjects s JOIN dbo.courses c ON c.course_id = s.course_id WHERE s.subject_id = @id',
  module: 'SELECT m.module_id AS id, m.subject_id, m.course_id, c.teacher_id FROM dbo.modules m JOIN dbo.courses c ON c.course_id = m.course_id WHERE m.module_id = @id',
  content: 'SELECT x.content_id AS id, x.module_id, x.course_id, c.teacher_id FROM dbo.contents x JOIN dbo.courses c ON c.course_id = x.course_id WHERE x.content_id = @id',
  batch: 'SELECT b.batch_id AS id, b.course_id, c.teacher_id FROM dbo.batches b JOIN dbo.courses c ON c.course_id = b.course_id WHERE b.batch_id = @id',
  question: 'SELECT q.question_id AS id, q.module_id, q.course_id, c.teacher_id FROM dbo.questions q JOIN dbo.courses c ON c.course_id = q.course_id WHERE q.question_id = @id',
  exam: 'SELECT e.exam_id AS id, e.course_id, e.status, c.teacher_id FROM dbo.exams e JOIN dbo.courses c ON c.course_id = e.course_id WHERE e.exam_id = @id',
};

const LABEL = { course: 'Course', subject: 'Subject', module: 'Module', content: 'Content', batch: 'Batch', question: 'Question', exam: 'Exam' };

async function owned(entity, id, teacherId, tx) {
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) throw notFound(`${LABEL[entity]} not found`);
  const row = await one(SQL[entity], { id: T.int(n) }, tx);
  if (!row || row.teacher_id !== teacherId) throw notFound(`${LABEL[entity]} not found`);
  return row;
}

// Express middleware: owns('course', 'courseId') -> req.owned.course
function owns(entity, param) {
  return async (req, res, next) => {
    try {
      req.owned = req.owned || {};
      req.owned[entity] = await owned(entity, req.params[param], req.user.id);
      next();
    } catch (e) {
      next(e);
    }
  };
}

module.exports = { owned, owns };
