const router = require('express').Router();
const { h } = require('../utils/http');
const { authenticate, authorize } = require('../middlewares/authenticate');
const { requireActiveTeacherSubscription } = require('../middlewares/teacherSubscription');
const demos = require('../services/demoRequest.service');
const enrollments = require('../services/enrollment.service');
const live = require('../services/liveClass.service');
const ops = require('../services/teacherOps.service');

router.use('/teacher', authenticate, authorize('teacher'));

router.get('/teacher/dashboard', h((req) => ops.dashboard(req.user.id)));

// Live demo requests
router.get('/teacher/demo-requests', h((req) => demos.list(req.user.id, { status: req.query.status, courseId: req.query.course })));
router.post('/teacher/demo-requests/:id/schedule', h((req) => demos.schedule(req.params.id, req.user.id, req.body)));
router.post('/teacher/demo-requests/:id/send-whatsapp', h((req) => demos.sendWhatsApp(req.params.id, req.user.id)));
router.post('/teacher/demo-requests/:id/reject', h((req) => demos.setStatus(req.params.id, req.user.id, 'rejected')));
router.post('/teacher/demo-requests/:id/complete', h((req) => demos.setStatus(req.params.id, req.user.id, 'completed')));

// Enrollments + per-student access
router.get('/teacher/enrollments', h((req) => enrollments.list(req.user.id, { status: req.query.status, courseId: req.query.course })));
router.post('/teacher/enrollments/:id/approve', requireActiveTeacherSubscription, h((req) => enrollments.approve(req.params.id, req.user.id, req.body)));
router.post('/teacher/enrollments/:id/reject', h((req) => enrollments.reject(req.params.id, req.user.id, req.body)));
router.put('/teacher/enrollments/:id/batch', h((req) => enrollments.moveBatch(req.params.id, req.user.id, req.body)));
router.get('/teacher/students', h((req) => enrollments.students(req.user.id, { courseId: req.query.course, batchId: req.query.batch, q: req.query.q })));
router.get('/teacher/students/:studentPublicId/attendance', h((req) => enrollments.studentAttendance(req.user.id, req.params.studentPublicId, req.query.month)));
router.put('/teacher/students/:studentPublicId/access/:courseId', h((req) => enrollments.setAccess(req.user.id, req.params.studentPublicId, req.params.courseId, req.body)));

// Live classes + attendance
router.get('/teacher/live-classes', h((req) => live.list(req.user.id, { courseId: req.query.course, from: req.query.from })));
router.post('/teacher/live-classes', h((req) => live.create(req.user.id, req.body), 201));
router.put('/teacher/live-classes/:id', h((req) => live.update(req.params.id, req.user.id, req.body)));
router.delete('/teacher/live-classes/:id', h((req) => live.cancel(req.params.id, req.user.id)));
router.put('/teacher/live-classes/:id/meet-link', h((req) => live.setMeetLink(req.params.id, req.user.id, req.body)));
router.get('/teacher/live-classes/:id/attendance', h((req) => live.attendanceSheet(req.params.id, req.user.id)));
router.put('/teacher/live-classes/:id/attendance', h((req) => live.saveAttendance(req.params.id, req.user.id, req.body.records)));

// Doubts
router.get('/teacher/doubts', h((req) => ops.listDoubts(req.user.id, { status: req.query.status, courseId: req.query.course })));
router.post('/teacher/doubts/:id/reply', h((req) => ops.replyDoubt(req.params.id, req.user, req.body)));
router.post('/teacher/doubts/:id/close', h((req) => ops.closeDoubt(req.params.id, req.user.id)));

// Class programs
router.get('/teacher/programs', h((req) => ops.listPrograms(req.user.id)));
router.post('/teacher/programs', h((req) => ops.saveProgram(req.user.id, req.body), 201));
router.put('/teacher/programs/:id', h((req) => ops.saveProgram(req.user.id, req.body, req.params.id)));
router.delete('/teacher/programs/:id', h((req) => ops.deleteProgram(req.user.id, req.params.id)));

// Public profile
router.get('/teacher/profile', h((req) => ops.getProfile(req.user.id)));
router.put('/teacher/profile', h((req) => ops.saveProfile(req.user.id, req.body)));

module.exports = router;
