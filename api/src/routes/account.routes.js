const router = require('express').Router();
const { h } = require('../utils/http');
const { authenticate } = require('../middlewares/authenticate');
const { authLimiter } = require('../middlewares/rateLimits');
const { requireMobile } = require('../utils/validate');
const service = require('../services/account.service');

router.use('/account', authenticate);

router.post('/account/change-mobile/start', authLimiter, h((req) => service.startChangeMobile(req.user.id, requireMobile(req.body.newMobile, 'newMobile'))));

router.post('/account/change-mobile/confirm', authLimiter, h((req) =>
  service.confirmChangeMobile(req.user.id, requireMobile(req.body.newMobile, 'newMobile'), req.body.otp, (req.cookies && req.cookies.rt) || req.body.refreshToken)));

router.put('/account/language', h((req) => service.setLanguage(req.user.id, req.body.preferredLang)));

router.post('/account/delete', authLimiter, h((req) => service.deleteAccount(req.user.id, req.body.otp)));

module.exports = router;
