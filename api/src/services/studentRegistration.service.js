const { one, query, T } = require('../db/query');
const { withTransaction } = require('../db/tx');
const otpService = require('./otp.service');
const tokenService = require('./token.service');
const consentService = require('./consent.service');
const { selfUser } = require('../serializers/user.serializer');
const { conflict } = require('../utils/APIError');

async function register(f, { ip, deviceId } = {}) {
  const existing = await one('SELECT role FROM dbo.users WHERE mobile = @m AND deleted_at IS NULL', { m: T.varchar(f.mobile, 20) });
  if (existing && existing.role === 'teacher') throw conflict('This number is registered as a teacher', 'MOBILE_IS_TEACHER');
  if (existing) throw conflict('This number is already registered. Log in instead.', 'MOBILE_REGISTERED');
  await otpService.verify(f.mobile, 'student_register', f.otp);
  const user = await withTransaction(async (tx) => {
    const u = await one(
      `INSERT INTO dbo.users (mobile, name, email, city, role, status, whatsapp_opt_in, preferred_lang)
       OUTPUT INSERTED.* VALUES (@m, @n, @e, @c, 'student', 'approved', @wa, @lang)`,
      {
        m: T.varchar(f.mobile, 20),
        n: T.nvarchar(f.name, 120),
        e: T.varchar(f.email, 160),
        c: T.nvarchar(f.city, 80),
        wa: T.bit(f.whatsappOptIn),
        lang: T.char(['en', 'mr', 'hi'].includes(f.preferredLang) ? f.preferredLang : 'en', 2),
      },
      tx,
    );
    await query('INSERT INTO dbo.student_profiles (user_id, education, class_standard) VALUES (@u, @e, @c)', {
      u: T.int(u.user_id), e: T.nvarchar(f.education, 120), c: T.nvarchar(f.classStandard, 40),
    }, tx);
    await consentService.record({ userId: u.user_id, mobile: f.mobile, type: 'terms_privacy', ip }, tx);
    if (f.whatsappOptIn) await consentService.record({ userId: u.user_id, mobile: f.mobile, type: 'whatsapp', ip }, tx);
    await consentService.linkToUser(f.mobile, u.user_id, tx);
    return u;
  });
  const tokens = await tokenService.issue(user, { deviceId });
  return { ...tokens, user: selfUser(user) };
}

module.exports = { register };
