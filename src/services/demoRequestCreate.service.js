// Public live-demo request (spec §3.3): OTP-verified, goes to that course's teacher.
const { one, T } = require('../db/query');
const { withTransaction } = require('../db/tx');
const otpService = require('./otp.service');
const consentService = require('./consent.service');
const { notify } = require('./notification.service');
const catalog = require('./publicCatalog.service');
const { conflict } = require('../utils/APIError');

async function create(fields, ip) {
  const course = await catalog.findPublished(fields.courseSlug);
  const pending = await one(
    "SELECT TOP 1 1 AS y FROM dbo.demo_requests WHERE course_id = @c AND mobile = @m AND status IN ('pending', 'scheduled')",
    { c: T.int(course.course_id), m: T.varchar(fields.mobile, 20) },
  );
  if (pending) throw conflict('You already have a pending demo request for this course', 'DEMO_PENDING');
  await otpService.verify(fields.mobile, 'demo_request', fields.otp);
  await withTransaction(async (tx) => {
    await one(
      `INSERT INTO dbo.demo_requests (course_id, teacher_id, name, mobile, email, education, class_standard, preferred_time, message, whatsapp_opt_in)
       OUTPUT INSERTED.demo_request_id VALUES (@c, @t, @n, @m, @em, @e, @cls, @pt, @msg, @wa)`,
      {
        c: T.int(course.course_id),
        t: T.int(course.teacher_id),
        n: T.nvarchar(fields.name, 120),
        m: T.varchar(fields.mobile, 20),
        em: T.varchar(fields.email, 160),
        e: T.nvarchar(fields.education, 120),
        cls: T.nvarchar(fields.classStandard, 40),
        pt: T.nvarchar(fields.preferredTime, 80),
        msg: T.nvarchar(fields.message, 1000),
        wa: T.bit(fields.whatsappOptIn),
      },
      tx,
    );
    await consentService.record({ mobile: fields.mobile, type: 'terms_privacy', ip }, tx);
    if (fields.whatsappOptIn) await consentService.record({ mobile: fields.mobile, type: 'whatsapp', ip }, tx);
    await notify(course.teacher_id, { key: 'demo.new', vars: { course: course.title, name: fields.name }, link: '/teacher/requests' }, tx);
  });
  return { status: 'pending', teacherName: course.teacher_name };
}

module.exports = { create };
