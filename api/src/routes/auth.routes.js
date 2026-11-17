const router = require('express').Router();
const { h } = require('../utils/http');
const { authLimiter } = require('../middlewares/rateLimits');
const { authenticate } = require('../middlewares/authenticate');
const { requireMobile, text, bool, email } = require('../utils/validate');
const { badRequest } = require('../utils/APIError');
const { clientIp } = require('../utils/http');
const registration = require('../services/studentRegistration.service');
const otpService = require('../services/otp.service');
const authService = require('../services/auth.service');
const tokenService = require('../services/token.service');

const PUBLIC_PURPOSES = ['login', 'teacher_register', 'student_register', 'demo_request', 'delete_account'];
const COOKIE = 'rt';
const cookieOpts = { httpOnly: true, secure: true, sameSite: 'strict', path: '/api/v1/auth', maxAge: tokenService.REFRESH_TTL_MS };
const isMobileClient = (req) => req.get('x-client') === 'mobile';

function sendTokens(req, res, { accessToken, refreshToken, user }) {
  if (isMobileClient(req)) return { accessToken, refreshToken, user };
  res.cookie(COOKIE, refreshToken, cookieOpts);
  return user ? { accessToken, user } : { accessToken };
}

router.post('/auth/otp/send', authLimiter, h(async (req) => {
  const { purpose } = req.body;
  if (!PUBLIC_PURPOSES.includes(purpose)) throw badRequest('purpose: not allowed');
  return otpService.send(requireMobile(req.body.mobile), purpose);
}));

router.post('/auth/login', authLimiter, h(async (req, res) => {
  const result = await authService.login({ mobile: requireMobile(req.body.mobile), otp: req.body.otp, deviceId: req.body.deviceId });
  return sendTokens(req, res, result);
}));

// Student registration (spec §4): name*, mobile*, OTP*, education*, city, email. Logs the student in.
router.post('/auth/register-student', authLimiter, h(async (req, res) => {
  const b = req.body;
  if (!bool(b.acceptTerms)) throw badRequest('Accept the Terms and Privacy Policy to continue', 'TERMS_REQUIRED');
  const result = await registration.register({
    name: text(b.name, 'name', { max: 120 }),
    mobile: requireMobile(b.mobile),
    otp: text(b.otp, 'otp', { min: 6, max: 6 }),
    education: text(b.education, 'education', { max: 120 }),
    classStandard: text(b.classStandard, 'classStandard', { required: false, max: 40 }),
    city: text(b.city, 'city', { required: false, max: 80 }),
    email: email(b.email),
    preferredLang: b.preferredLang,
    whatsappOptIn: bool(b.whatsappOptIn),
  }, { ip: clientIp(req), deviceId: b.deviceId });
  return sendTokens(req, res, result);
}, 201));

router.post('/auth/refresh', h(async (req, res) => {
  const token = (req.cookies && req.cookies[COOKIE]) || req.body.refreshToken;
  const result = await tokenService.rotate(token);
  return sendTokens(req, res, result);
}));

router.post('/auth/logout', h(async (req, res) => {
  const token = (req.cookies && req.cookies[COOKIE]) || req.body.refreshToken;
  // Mobile logout with a deviceId also revokes that device's offline downloads.
  if (token && req.body.deviceId) {
    const owner = await tokenService.ownerOf(token);
    if (owner) await require('../services/download.service').revokeDevice(owner, String(req.body.deviceId).slice(0, 64), 'logout');
  }
  await tokenService.revokeByToken(token);
  res.clearCookie(COOKIE, { ...cookieOpts, maxAge: undefined });
  return { loggedOut: true };
}));

router.get('/auth/me', authenticate, h((req) => authService.me(req.user.id)));

module.exports = router;
