const router = require('express').Router();
const { h, clientIp } = require('../utils/http');
const { uploadFields } = require('../middlewares/upload');
const { publicFormLimiter } = require('../middlewares/rateLimits');
const { requireMobile, text, int, email, bool } = require('../utils/validate');
const { badRequest } = require('../utils/APIError');
const service = require('../services/teacherRequest.service');

router.post(
  '/teacher-requests',
  publicFormLimiter,
  uploadFields([{ name: 'photo', kind: 'image' }, { name: 'idDocument', kind: 'document' }]),
  h(async (req) => {
    const b = req.body;
    const fields = {
      name: text(b.name, 'name', { max: 120 }),
      mobile: requireMobile(b.mobile),
      otp: text(b.otp, 'otp', { min: 6, max: 6 }),
      courseName: text(b.courseName, 'courseName', { max: 200 }),
      subject: text(b.subject, 'subject', { max: 120 }),
      experienceYears: int(b.experienceYears, 'experienceYears', { min: 0, max: 60 }),
      email: email(b.email),
      city: text(b.city, 'city', { required: false, max: 80 }),
      qualification: text(b.qualification, 'qualification', { required: false, max: 160 }),
      whatsappOptIn: bool(b.whatsappOptIn),
    };
    if (!bool(b.acceptTerms)) throw badRequest('Accept the Terms and Privacy Policy to continue', 'TERMS_REQUIRED');
    return service.create(fields, req.uploads || {}, clientIp(req));
  }, 201),
);

module.exports = router;
