const fs = require('fs');
const path = require('path');
const router = require('express').Router();
const { h, page, clientIp } = require('../utils/http');
const { badRequest } = require('../utils/APIError');
const { paginate } = require('../utils/paginate');
const { publicFormLimiter } = require('../middlewares/rateLimits');
const { requireMobile, text, bool, requiredEmail } = require('../utils/validate');
const catalog = require('../services/publicCatalog.service');
const demoCreate = require('../services/demoRequestCreate.service');

const LEGAL_DIR = path.join(__dirname, '../../content/legal');

router.get('/public/legal/:doc', h((req) => {
  const { doc } = req.params;
  if (!['terms', 'privacy'].includes(doc)) throw badRequest('doc: must be terms or privacy');
  const lang = ['en', 'mr', 'hi'].includes(req.query.lang) ? req.query.lang : 'en';
  const file = [path.join(LEGAL_DIR, `${doc}.${lang}.md`), path.join(LEGAL_DIR, `${doc}.en.md`)].find((f) => fs.existsSync(f));
  return {
    doc,
    version: process.env.POLICY_VERSION || '1.0',
    support: process.env.SUPPORT_CONTACT || null,
    markdown: fs.readFileSync(file, 'utf8'),
  };
}));

router.get('/public/config', h(() => ({ supportContact: process.env.SUPPORT_CONTACT || null, policyVersion: process.env.POLICY_VERSION || '1.0' })));

// Catalog (no login)
router.get('/public/courses', h(async (req) => {
  const p = paginate(req.query);
  const { rows, total } = await catalog.list({ q: req.query.q, language: req.query.language, subject: req.query.subject, teacher: req.query.teacher, ...p });
  return page(rows, total, p);
}));
router.get('/public/filters', h(() => catalog.filters()));
router.get('/public/courses/:slug', h((req) => catalog.details(req.params.slug)));
router.get('/public/teachers/:slug', h((req) => catalog.teacherPage(req.params.slug)));

// Live demo request (OTP-verified)
router.post('/public/demo-requests', publicFormLimiter, h((req) => {
  const b = req.body;
  if (!bool(b.acceptTerms)) throw badRequest('Accept the Terms and Privacy Policy to continue', 'TERMS_REQUIRED');
  return demoCreate.create({
    courseSlug: text(b.courseSlug, 'courseSlug', { max: 220 }),
    name: text(b.name, 'name', { max: 120 }),
    mobile: requireMobile(b.mobile),
    otp: text(b.otp, 'otp', { min: 6, max: 6 }),
    education: text(b.education, 'education', { max: 120 }),
    email: requiredEmail(b.email),
    classStandard: text(b.classStandard, 'classStandard', { required: false, max: 40 }),
    preferredTime: text(b.preferredTime, 'preferredTime', { required: false, max: 80 }),
    message: text(b.message, 'message', { required: false, max: 1000 }),
    whatsappOptIn: bool(b.whatsappOptIn),
  }, clientIp(req));
}, 201));

module.exports = router;
