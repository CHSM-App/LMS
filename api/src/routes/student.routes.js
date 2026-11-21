const router = require('express').Router();
const { h } = require('../utils/http');
const { authenticate, authorize } = require('../middlewares/authenticate');
const { uploadFields } = require('../middlewares/upload');
const students = require('../services/student.service');
const attempts = require('../services/attempt.service');
const downloads = require('../services/download.service');
const results = require('../services/result.service');
const { courseAccess } = require('../services/studentAccess');

router.use('/student', authenticate, authorize('student'));

router.get('/student/dashboard', h((req) => students.dashboard(req.user.id)));
router.get('/student/enrollments', h((req) => students.myEnrollments(req.user.id)));
router.post('/student/enrollments', h((req) => students.requestEnrollment(req.user, req.body), 201));

// Learning
router.get('/student/courses/:courseId', h((req) => students.courseView(req.user.id, req.params.courseId)));
router.get('/student/contents/:contentId', h((req) => students.contentView(req.user.id, req.params.contentId)));
router.post('/student/contents/:contentId/progress', h((req) => students.saveProgress(req.user.id, req.params.contentId, req.body)));
router.post('/student/progress/sync', h((req) => students.syncProgress(req.user.id, req.body.items)));
router.get('/student/live-classes', h((req) => students.liveClasses(req.user.id)));
router.post('/student/live-classes/:id/join', h((req) => students.joinLiveClass(req.user.id, req.params.id)));
router.get('/student/progress', h((req) => students.progress(req.user.id)));
router.get('/student/attendance', h((req) => students.attendanceHistory(req.user.id)));

// Exams
router.get('/student/courses/:courseId/exams', h((req) => attempts.examsForCourse(req.params.courseId, req.user.id)));
router.post('/student/exams/:examId/attempts', async (req, res, next) => {
  try {
    const r = await attempts.startOrResume(req.params.examId, req.user.id);
    res.status(r.created ? 201 : 200).json({ success: true, data: r.data });
  } catch (e) {
    next(e);
  }
});
router.put('/student/attempts/:attemptId/answers/:questionId', h((req) => attempts.saveAnswer(req.params.attemptId, req.user.id, req.params.questionId, req.body)));
router.post('/student/attempts/:attemptId/submit', h((req) => attempts.submit(req.params.attemptId, req.user.id)));
router.get('/student/attempts/:attemptId/result', h((req) => attempts.result(req.params.attemptId, req.user.id)));
router.get('/student/courses/:courseId/final-result', h(async (req) => {
  await courseAccess(req.user.id, req.params.courseId);
  return results.finalForStudent(Number(req.params.courseId), req.user.id);
}));

// Doubts (multipart: optional image/pdf attachment up to 5 MB)
router.get('/student/doubts', h((req) => students.myDoubts(req.user.id)));
router.post('/student/doubts', uploadFields([{ name: 'attachment', kind: 'attachment' }]), h((req) =>
  students.askDoubt(req.user.id, req.body, req.uploads && req.uploads.attachment), 201));

// Profile
router.get('/student/profile', h((req) => students.profile(req.user.id)));
router.put('/student/profile', h((req) => students.saveProfile(req.user.id, req.body)));

// Offline downloads (mobile app only)
router.get('/student/devices', h((req) => downloads.listDevices(req.user.id)));
router.post('/student/devices', h((req) => downloads.registerDevice(req.user.id, req.body), 201));
router.delete('/student/devices/:deviceId', h((req) => downloads.removeDevice(req.user.id, req.params.deviceId)));
router.post('/student/contents/:contentId/download', h((req) => downloads.issue(req.user.id, req.params.contentId, req.get('x-device-id'))));
router.post('/student/downloads/renew', h((req) => downloads.renew(req.user.id, req.body.deviceId, req.body.contentIds)));

module.exports = router;
