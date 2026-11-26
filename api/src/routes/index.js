const router = require('express').Router();

router.use(require('./health.routes'));
router.use(require('./auth.routes'));
router.use(require('./teacherRequests.routes'));
router.use(require('./account.routes'));
router.use(require('./public.routes'));
router.use(require('./notification.routes'));
router.use(require('./pushToken.routes'));
router.use(require('./admin.routes'));
router.use(require('./teacher.routes'));
router.use(require('./teacherExams.routes'));
router.use(require('./teacherOps.routes'));
router.use(require('./student.routes'));
router.use(require('./uploads.routes'));
router.use(require('./files.routes'));

module.exports = router;
