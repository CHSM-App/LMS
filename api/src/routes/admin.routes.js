const router = require('express').Router();
const { h, page, clientIp } = require('../utils/http');
const { authenticate, authorize } = require('../middlewares/authenticate');
const { paginate } = require('../utils/paginate');
const { requireMobile, text } = require('../utils/validate');
const teacherRequests = require('../services/teacherRequest.service');
const account = require('../services/account.service');

router.use('/admin', authenticate, authorize('admin'));

router.get('/admin/teacher-requests', h(async (req) => {
  const p = paginate(req.query);
  const { rows, total } = await teacherRequests.list({ status: req.query.status, q: req.query.q, ...p });
  return page(rows, total, p);
}));

router.post('/admin/teacher-requests/:id/accept', h((req) => teacherRequests.accept(Number(req.params.id), req.user.id, clientIp(req))));

router.post('/admin/teacher-requests/:id/reject', h((req) =>
  teacherRequests.reject(Number(req.params.id), req.user.id, text(req.body.reason, 'reason', { min: 5, max: 500 }), clientIp(req))));

router.post('/admin/users/:publicId/change-mobile', h((req) =>
  account.adminChangeMobile(req.user.id, req.params.publicId, requireMobile(req.body.newMobile, 'newMobile'), text(req.body.reason, 'reason', { min: 3, max: 300 }), clientIp(req))));

module.exports = router;
