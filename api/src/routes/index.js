const router = require('express').Router();

router.use(require('./health.routes'));
router.use(require('./auth.routes'));
router.use(require('./teacherRequests.routes'));
router.use(require('./account.routes'));
router.use(require('./public.routes'));
router.use(require('./admin.routes'));

module.exports = router;
