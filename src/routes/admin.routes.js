const router = require('express').Router();
const { h, page, clientIp } = require('../utils/http');
const { authenticate, authorize } = require('../middlewares/authenticate');
const { paginate } = require('../utils/paginate');
const { requireMobile, text, isoDate, bool } = require('../utils/validate');
const teacherRequests = require('../services/teacherRequest.service');
const account = require('../services/account.service');
const teachers = require('../services/adminTeacher.service');
const subscriptions = require('../services/teacherSubscription.service');

router.use('/admin', authenticate, authorize('admin'));

router.get('/admin/dashboard', h(() => teachers.dashboard()));

// Teacher requests
router.get('/admin/teacher-requests', h(async (req) => {
  const p = paginate(req.query);
  const { rows, total } = await teacherRequests.list({ status: req.query.status, q: req.query.q, ...p });
  return page(rows, total, p);
}));
router.post('/admin/teacher-requests/:id/accept', h((req) => teacherRequests.accept(Number(req.params.id), req.user.id, clientIp(req))));
router.post('/admin/teacher-requests/:id/reject', h((req) =>
  teacherRequests.reject(Number(req.params.id), req.user.id, text(req.body.reason, 'reason', { min: 5, max: 500 }), clientIp(req))));

// Teachers
router.get('/admin/teachers', h(async (req) => {
  const p = paginate(req.query);
  const { rows, total } = await teachers.list({ status: req.query.status, q: req.query.q, ...p });
  return page(rows, total, p);
}));
router.get('/admin/teachers/:publicId', h((req) => teachers.detail(req.params.publicId)));
router.post('/admin/teachers/:publicId/block', h((req) =>
  teachers.block(req.params.publicId, req.user.id, text(req.body.reason, 'reason', { min: 5, max: 500 }), clientIp(req))));
router.post('/admin/teachers/:publicId/activate', h((req) => teachers.activate(req.params.publicId, req.user.id, clientIp(req))));

// Teacher subscriptions
const subscriptionBody = (b) => ({
  planType: b.planType,
  startDate: isoDate(b.startDate, 'startDate'),
  endDate: isoDate(b.endDate, 'endDate', { required: false }),
});
router.get('/admin/subscriptions', h(async (req) => {
  const p = paginate(req.query);
  const { rows, total } = await subscriptions.list({ teacherPublicId: req.query.teacher, status: req.query.status, ...p });
  return page(rows, total, p);
}));
router.post('/admin/subscriptions', h((req) =>
  subscriptions.create({ teacherPublicId: req.body.teacherPublicId, ...subscriptionBody(req.body) }, req.user.id, clientIp(req)), 201));
router.put('/admin/subscriptions/:id', h((req) =>
  subscriptions.update(Number(req.params.id), { ...subscriptionBody(req.body), blocked: bool(req.body.blocked) }, req.user.id, clientIp(req))));

// Users
router.post('/admin/users/:publicId/change-mobile', h((req) =>
  account.adminChangeMobile(req.user.id, req.params.publicId, requireMobile(req.body.newMobile, 'newMobile'), text(req.body.reason, 'reason', { min: 3, max: 300 }), clientIp(req))));

// Audit log
router.get('/admin/audit-log', h(async (req) => {
  const p = paginate(req.query);
  const { rows, total } = await teachers.auditLog({ action: req.query.action, from: req.query.from, to: req.query.to, ...p });
  return page(rows, total, p);
}));

module.exports = router;
