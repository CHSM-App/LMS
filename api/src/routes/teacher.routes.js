const router = require('express').Router();
const { h } = require('../utils/http');
const { authenticate, authorize } = require('../middlewares/authenticate');
const { requireActiveTeacherSubscription } = require('../middlewares/teacherSubscription');
const { owns } = require('../services/ownership');
const courses = require('../services/course.service');
const cur = require('../services/curriculum.service');
const batches = require('../services/batch.service');

// Every /teacher route: logged-in teacher only, and only their own data (404 otherwise).
router.use('/teacher', authenticate, authorize('teacher'));

// Courses
router.get('/teacher/courses', h((req) => courses.list(req.user.id)));
router.post('/teacher/courses', h((req) => courses.create(req.user.id, req.body), 201));
router.get('/teacher/courses/:courseId', owns('course', 'courseId'), h(async (req) => ({
  ...courses.serialize(await courses.getById(req.owned.course.id)),
  readiness: await courses.readiness(req.owned.course.id),
})));
router.put('/teacher/courses/:courseId', owns('course', 'courseId'), h((req) => courses.update(req.user.id, req.owned.course.id, req.body)));
router.delete('/teacher/courses/:courseId', owns('course', 'courseId'), h((req) => courses.remove(req.owned.course.id)));
router.post(
  '/teacher/courses/:courseId/status',
  owns('course', 'courseId'),
  (req, res, next) => (req.body && req.body.status === 'published' ? requireActiveTeacherSubscription(req, res, next) : next()),
  h((req) => courses.setStatus(req.owned.course.id, req.body.status)),
);
router.get('/teacher/courses/:courseId/curriculum', owns('course', 'courseId'), h((req) => cur.curriculum(req.owned.course.id)));

// Subjects
router.post('/teacher/courses/:courseId/subjects', owns('course', 'courseId'), h((req) => cur.createSubject(req.owned.course.id, req.body), 201));
router.put('/teacher/subjects/:subjectId', owns('subject', 'subjectId'), h((req) => cur.updateSubject(req.owned.subject.id, req.body)));
router.delete('/teacher/subjects/:subjectId', owns('subject', 'subjectId'), h((req) => cur.deleteSubject(req.owned.subject.id)));
router.put('/teacher/courses/:courseId/subjects/order', owns('course', 'courseId'), h((req) =>
  cur.reorder({ table: 'subjects', idCol: 'subject_id', parentCol: 'course_id', parentId: req.owned.course.id, ids: req.body.subjectIds })));

// Modules
router.post('/teacher/subjects/:subjectId/modules', owns('subject', 'subjectId'), h((req) => cur.createModule(req.owned.subject, req.body), 201));
router.put('/teacher/modules/:moduleId', owns('module', 'moduleId'), h((req) => cur.updateModule(req.owned.module.id, req.body)));
router.delete('/teacher/modules/:moduleId', owns('module', 'moduleId'), h((req) => cur.deleteModule(req.owned.module.id)));
router.put('/teacher/subjects/:subjectId/modules/order', owns('subject', 'subjectId'), h((req) =>
  cur.reorder({ table: 'modules', idCol: 'module_id', parentCol: 'subject_id', parentId: req.owned.subject.id, ids: req.body.moduleIds })));

// Contents
router.post('/teacher/modules/:moduleId/contents', owns('module', 'moduleId'), h((req) => cur.createContent(req.user.id, req.owned.module, req.body), 201));
router.put('/teacher/contents/:contentId', owns('content', 'contentId'), h((req) => cur.updateContent(req.user.id, req.owned.content.id, req.body)));
router.delete('/teacher/contents/:contentId', owns('content', 'contentId'), h((req) => cur.deleteContent(req.owned.content.id)));
router.post('/teacher/contents/:contentId/sessions', owns('content', 'contentId'), h((req) => cur.scheduleSession(req.user.id, req.owned.content.id, req.body), 201));
router.put('/teacher/contents/:contentId/recording', owns('content', 'contentId'), h((req) => cur.setRecording(req.user.id, req.owned.content.id, req.body)));
router.delete('/teacher/contents/:contentId/recording', owns('content', 'contentId'), h((req) => cur.clearRecording(req.owned.content.id)));
router.put('/teacher/modules/:moduleId/contents/order', owns('module', 'moduleId'), h((req) =>
  cur.reorderContents(req.owned.module.id, req.body.contentIds)));

// Batches
router.get('/teacher/courses/:courseId/batches', owns('course', 'courseId'), h((req) => batches.list(req.owned.course.id)));
router.post('/teacher/courses/:courseId/batches', owns('course', 'courseId'), h((req) => batches.create(req.owned.course.id, req.body), 201));
router.put('/teacher/batches/:batchId', owns('batch', 'batchId'), h((req) => batches.update(req.owned.batch.id, req.body)));

module.exports = router;
