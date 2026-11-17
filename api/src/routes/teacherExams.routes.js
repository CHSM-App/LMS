const router = require('express').Router();
const { h } = require('../utils/http');
const { authenticate, authorize } = require('../middlewares/authenticate');
const { uploadFields } = require('../middlewares/upload');
const { owns } = require('../services/ownership');
const questions = require('../services/question.service');
const importer = require('../services/questionImport.service');
const exams = require('../services/exam.service');
const results = require('../services/result.service');
const { badRequest } = require('../utils/APIError');

router.use('/teacher', authenticate, authorize('teacher'));

// Question bank (per module)
router.get('/teacher/modules/:moduleId/questions', owns('module', 'moduleId'), h((req) => questions.list(req.owned.module.id, req.query)));
router.post('/teacher/modules/:moduleId/questions', owns('module', 'moduleId'), h((req) => questions.create(req.owned.module, req.body), 201));
router.get('/teacher/modules/:moduleId/question-counts', owns('module', 'moduleId'), h(async (req) => (await questions.counts([req.owned.module.id]))[req.owned.module.id]));
router.put('/teacher/questions/:questionId', owns('question', 'questionId'), h((req) => questions.update(req.owned.question, req.body)));
router.delete('/teacher/questions/:questionId', owns('question', 'questionId'), h((req) => questions.remove(req.owned.question)));

router.get('/teacher/questions/import-template', async (req, res, next) => {
  try {
    const buf = await importer.template();
    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.set('Content-Disposition', 'attachment; filename="question-import-template.xlsx"');
    res.send(buf);
  } catch (e) {
    next(e);
  }
});
router.post(
  '/teacher/modules/:moduleId/questions/import',
  owns('module', 'moduleId'),
  uploadFields([{ name: 'file', kind: 'xlsx' }]),
  h((req) => {
    if (!req.uploads.file) throw badRequest('Choose the Excel file to import');
    return importer.importFile(req.owned.module, req.uploads.file.buffer);
  }),
);

// Exams
router.get('/teacher/courses/:courseId/exams', owns('course', 'courseId'), h((req) => exams.list(req.owned.course.id)));
router.post('/teacher/courses/:courseId/exams', owns('course', 'courseId'), h((req) => exams.create(req.owned.course.id, req.body), 201));
router.get('/teacher/exams/:examId', owns('exam', 'examId'), h((req) => exams.get(req.owned.exam.id)));
router.put('/teacher/exams/:examId', owns('exam', 'examId'), h((req) => exams.update(req.owned.exam, req.body)));
router.delete('/teacher/exams/:examId', owns('exam', 'examId'), h((req) => exams.remove(req.owned.exam)));
router.post('/teacher/exams/:examId/validate', owns('exam', 'examId'), h((req) => exams.validate(req.owned.exam.id)));
router.post('/teacher/exams/:examId/publish', owns('exam', 'examId'), h((req) => exams.publish(req.owned.exam.id)));
router.post('/teacher/exams/:examId/unpublish', owns('exam', 'examId'), h((req) => exams.unpublish(req.owned.exam.id)));

// Results
router.get('/teacher/exams/:examId/results', owns('exam', 'examId'), h((req) => results.examResults(req.owned.exam.id, { batchId: req.query.batch })));
router.get('/teacher/courses/:courseId/final-results', owns('course', 'courseId'), h((req) => results.finalForCourse(req.owned.course.id)));

module.exports = router;
