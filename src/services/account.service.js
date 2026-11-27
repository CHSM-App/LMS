const { query, one, T } = require('../db/query');
const { withTransaction } = require('../db/tx');
const otpService = require('./otp.service');
const tokenService = require('./token.service');
const { notify } = require('./notification.service');
const { audit } = require('./audit.service');
const hooks = require('./accountHooks');
const { clearAuthCache } = require('../middlewares/authenticate');
const { clock } = require('../utils/clock');
const { badRequest, conflict, notFound } = require('../utils/APIError');
const { maskMobile } = require('../utils/mobile');

async function ensureFree(mobile, tx) {
  const taken = await one('SELECT user_id FROM dbo.users WHERE mobile = @m AND deleted_at IS NULL', { m: T.varchar(mobile, 20) }, tx);
  if (taken) throw conflict('This number is already registered', 'MOBILE_REGISTERED');
}

async function startChangeMobile(userId, newMobile) {
  await ensureFree(newMobile);
  return otpService.send(newMobile, 'change_mobile');
}

async function applyMobileChange(userId, newMobile, { changedBy = null, reason = null } = {}, tx) {
  const u = await one('SELECT user_id, mobile FROM dbo.users WITH (UPDLOCK) WHERE user_id = @id AND deleted_at IS NULL', { id: T.int(userId) }, tx);
  if (!u) throw notFound('User not found');
  await ensureFree(newMobile, tx);
  await query('UPDATE dbo.users SET mobile = @m, updated_at = @now WHERE user_id = @id', { m: T.varchar(newMobile, 20), now: T.datetime(clock.now()), id: T.int(userId) }, tx);
  await query(
    `INSERT INTO dbo.mobile_change_requests (user_id, old_mobile, new_mobile, status, changed_by, reason, completed_at)
     VALUES (@u, @o, @n, 'completed', @by, @r, @now)`,
    { u: T.int(userId), o: T.varchar(u.mobile, 20), n: T.varchar(newMobile, 20), by: T.int(changedBy), r: T.nvarchar(reason, 300), now: T.datetime(clock.now()) },
    tx,
  );
  await notify(userId, { key: 'mobile.changed', vars: { mobile: maskMobile(newMobile) } }, tx);
  return u.mobile;
}

async function confirmChangeMobile(userId, newMobile, otp, currentRefreshToken) {
  await otpService.verify(newMobile, 'change_mobile', otp);
  await withTransaction(async (tx) => {
    await applyMobileChange(userId, newMobile, {}, tx);
    await tokenService.revokeAllForUser(userId, tx, { exceptTokenHash: currentRefreshToken ? tokenService.sha256(currentRefreshToken) : null });
  });
  clearAuthCache(userId);
  return { mobile: newMobile };
}

async function adminChangeMobile(adminId, publicId, newMobile, reason, ip) {
  const target = await one('SELECT user_id FROM dbo.users WHERE public_id = @p AND deleted_at IS NULL', { p: T.uuid(publicId) });
  if (!target) throw notFound('User not found');
  await withTransaction(async (tx) => {
    const old = await applyMobileChange(target.user_id, newMobile, { changedBy: adminId, reason }, tx);
    await tokenService.revokeAllForUser(target.user_id, tx);
    await audit({ adminId, action: 'user.change_mobile', entityType: 'user', entityId: target.user_id, before: { mobile: maskMobile(old) }, after: { mobile: maskMobile(newMobile), reason }, ip }, tx);
  });
  clearAuthCache(target.user_id);
  return { mobile: newMobile };
}

async function deleteAccount(userId, otp) {
  const u = await one('SELECT user_id, mobile, role FROM dbo.users WHERE user_id = @id AND deleted_at IS NULL', { id: T.int(userId) });
  if (!u) throw notFound('User not found');
  if (u.role === 'teacher' && (await hooks.teacherHasStudents(userId))) {
    throw conflict('Contact the admin to close a teacher account', 'TEACHER_HAS_STUDENTS');
  }
  if (u.role === 'admin') throw conflict('Admin accounts are closed by another admin', 'ADMIN_ACCOUNT');
  await otpService.verify(u.mobile, 'delete_account', otp);
  await withTransaction(async (tx) => {
    const now = clock.now();
    await query(
      `UPDATE dbo.users SET name = N'Deleted user', mobile = CONCAT('del-', user_id), email = NULL, city = NULL, photo_key = NULL,
              whatsapp_opt_in = 0, deleted_at = @now, updated_at = @now WHERE user_id = @id`,
      { id: T.int(userId), now: T.datetime(now) },
      tx,
    );
    await query('UPDATE dbo.teacher_profiles SET bio = NULL, qualification = NULL, intro_video_url = NULL, social_links_json = NULL, public_slug = NULL WHERE user_id = @id', { id: T.int(userId) }, tx);
    await query('UPDATE dbo.student_profiles SET education = NULL, class_standard = NULL WHERE user_id = @id', { id: T.int(userId) }, tx);
    await tokenService.revokeAllForUser(userId, tx);
    await hooks.onAccountDeleted(userId, tx);
  });
  clearAuthCache(userId);
  return { deleted: true };
}

// The user's language for the UI, notifications and WhatsApp.
async function setLanguage(userId, lang) {
  if (!['en', 'mr', 'hi'].includes(lang)) throw badRequest('preferredLang: choose en, mr or hi');
  await query('UPDATE dbo.users SET preferred_lang = @l, updated_at = SYSUTCDATETIME() WHERE user_id = @id', { l: T.char(lang, 2), id: T.int(userId) });
  clearAuthCache(userId);
  return { preferredLang: lang };
}

module.exports = { startChangeMobile, confirmChangeMobile, adminChangeMobile, deleteAccount, setLanguage };
