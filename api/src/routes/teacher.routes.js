const router = require('express').Router();
const { authenticate, authorize } = require('../middlewares/authenticate');

// Every /teacher route: logged-in teacher only. Feature routes are added in Phases 5-7.
router.use('/teacher', authenticate, authorize('teacher'));

module.exports = router;
