const { one, T } = require('../db/query');
const otpService = require('./otp.service');
const tokenService = require('./token.service');
const { APIError, notFound } = require('../utils/APIError');
const { selfUser } = require('../serializers/user.serializer');

async function findActiveByMobile(mobile, tx) {
  return one('SELECT * FROM dbo.users WHERE mobile = @m AND deleted_at IS NULL', { m: T.varchar(mobile, 20) }, tx);
}

async function login({ mobile, otp, deviceId }) {
  await otpService.verify(mobile, 'login', otp);
  const user = await findActiveByMobile(mobile);
  if (!user) {
    const reqRow = await one(
      'SELECT TOP 1 status, reject_reason FROM dbo.teacher_requests WHERE mobile = @m ORDER BY request_id DESC',
      { m: T.varchar(mobile, 20) },
    );
    if (reqRow && reqRow.status === 'pending') throw new APIError(403, 'Your request is under review', 'REQUEST_PENDING');
    if (reqRow && reqRow.status === 'rejected') {
      throw new APIError(403, `Your request was rejected: ${reqRow.reject_reason}. You can apply again.`, 'REQUEST_REJECTED');
    }
    throw notFound('No account found for this mobile number');
  }
  if (user.status === 'blocked') throw new APIError(403, 'Your account is blocked. Contact support.', 'ACCOUNT_BLOCKED');
  if (user.status !== 'approved') throw new APIError(403, 'Your request is under review', 'REQUEST_PENDING');
  const tokens = await tokenService.issue(user, { deviceId });
  return { ...tokens, user: selfUser(user) };
}

async function me(userId) {
  const u = await one('SELECT * FROM dbo.users WHERE user_id = @id', { id: T.int(userId) });
  let profile = {};
  if (u.role === 'teacher') {
    const p = await one('SELECT subject, experience_years, qualification, bio, public_slug FROM dbo.teacher_profiles WHERE user_id = @id', { id: T.int(userId) });
    profile = {
      teacherProfile: p ? { subject: p.subject, experienceYears: p.experience_years, qualification: p.qualification, bio: p.bio, publicSlug: p.public_slug } : null,
      // Limited mode banner on web/app (DECISIONS.md).
      subscription: await require('./teacherSubscription.service').currentForTeacher(userId),
    };
  } else if (u.role === 'student') {
    const p = await one('SELECT education, class_standard FROM dbo.student_profiles WHERE user_id = @id', { id: T.int(userId) });
    profile = { studentProfile: p ? { education: p.education, classStandard: p.class_standard } : null };
  }
  return selfUser(u, profile);
}

module.exports = { login, me, findActiveByMobile };
