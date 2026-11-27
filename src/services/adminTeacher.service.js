const { query, one, T } = require('../db/query');
const { withTransaction } = require('../db/tx');
const { audit } = require('./audit.service');
const { notify } = require('./notification.service');
const tokenService = require('./token.service');
const studentCount = require('./studentCount.service');
const subscriptions = require('./teacherSubscription.service');
const { clearAuthCache } = require('../middlewares/authenticate');
const { publicUrl } = require('../providers/storage');
const { conflict, notFound } = require('../utils/APIError');
const { todayIST } = require('../utils/clock');

const serialize = (r, count) => ({
  publicId: r.public_id,
  name: r.name,
  mobile: r.mobile,
  subject: r.subject,
  status: r.status,
  joinedAt: r.created_at,
  studentCount: count ?? 0,
});

async function list({ status, q, offset, limit }) {
  const params = {
    s: T.varchar(status || null, 10),
    q: T.nvarchar(q ? `%${q}%` : null, 140),
    off: T.int(offset),
    lim: T.int(limit),
  };
  const where = `WHERE u.role = 'teacher' AND u.deleted_at IS NULL AND (@s IS NULL OR u.status = @s)
                 AND (@q IS NULL OR u.name LIKE @q OR u.mobile LIKE @q OR p.subject LIKE @q)`;
  const rows = await query(
    `SELECT u.user_id, u.public_id, u.name, u.mobile, u.status, u.created_at, p.subject
     FROM dbo.users u LEFT JOIN dbo.teacher_profiles p ON p.user_id = u.user_id ${where}
     ORDER BY u.created_at DESC, u.user_id DESC OFFSET @off ROWS FETCH NEXT @lim ROWS ONLY`,
    params,
  );
  const { n } = await one(`SELECT COUNT(*) n FROM dbo.users u LEFT JOIN dbo.teacher_profiles p ON p.user_id = u.user_id ${where}`, params);
  const counts = await studentCount.countActiveByTeacher(rows.map((r) => r.user_id));
  return { rows: rows.map((r) => serialize(r, counts.get(r.user_id))), total: n };
}

async function findTeacher(publicId, tx) {
  const t = await one(
    `SELECT u.*, p.subject, p.experience_years, p.qualification, p.bio, p.public_slug
     FROM dbo.users u LEFT JOIN dbo.teacher_profiles p ON p.user_id = u.user_id
     WHERE u.public_id = @p AND u.role = 'teacher' AND u.deleted_at IS NULL`,
    { p: T.uuid(publicId) },
    tx,
  );
  if (!t) throw notFound('Teacher not found');
  return t;
}

async function detail(publicId) {
  const t = await findTeacher(publicId);
  const counts = await studentCount.countActiveByTeacher([t.user_id]);
  const perCourse = await studentCount.countActiveByCourse(t.user_id);
  const courseRows = await query(
    'SELECT course_id, title, status FROM dbo.courses WHERE teacher_id = @t ORDER BY created_at, course_id',
    { t: T.int(t.user_id) },
  );
  return {
    ...serialize(t, counts.get(t.user_id)),
    email: t.email,
    city: t.city,
    photoUrl: publicUrl(t.photo_key),
    experienceYears: t.experience_years,
    qualification: t.qualification,
    bio: t.bio,
    publicSlug: t.public_slug,
    courses: courseRows.map((c) => ({ courseId: c.course_id, title: c.title, status: c.status, studentCount: perCourse.get(c.course_id) ?? 0 })),
    subscriptions: await subscriptions.forTeacher(t.user_id),
  };
}

async function setStatus(publicId, adminId, { to, from, action, reason, notifyKey }, ip) {
  const result = await withTransaction(async (tx) => {
    const t = await findTeacher(publicId, tx);
    if (t.status !== from) throw conflict(to === 'blocked' ? 'This teacher is already blocked' : 'This teacher is already active', 'STATUS_UNCHANGED');
    await query("UPDATE dbo.users SET status = @s, updated_at = SYSUTCDATETIME() WHERE user_id = @id", { s: T.varchar(to, 10), id: T.int(t.user_id) }, tx);
    if (to === 'blocked') await tokenService.revokeAllForUser(t.user_id, tx);
    await audit({ adminId, action, entityType: 'user', entityId: t.user_id, before: { status: from }, after: { status: to, ...(reason ? { reason } : {}) }, ip }, tx);
    await notify(t.user_id, { key: notifyKey }, tx);
    return { publicId, status: to, userId: t.user_id };
  });
  clearAuthCache(result.userId);
  return { publicId: result.publicId, status: result.status };
}

const block = (publicId, adminId, reason, ip) =>
  setStatus(publicId, adminId, { to: 'blocked', from: 'approved', action: 'teacher.block', reason, notifyKey: 'account.blocked' }, ip);

const activate = (publicId, adminId, ip) =>
  setStatus(publicId, adminId, { to: 'approved', from: 'blocked', action: 'teacher.activate', notifyKey: 'account.activated' }, ip);

async function dashboard() {
  const today = todayIST();
  const r = await one(
    `SELECT
       (SELECT COUNT(*) FROM dbo.teacher_requests WHERE status = 'pending') AS pendingRequests,
       (SELECT COUNT(*) FROM dbo.users WHERE role = 'teacher' AND status = 'approved' AND deleted_at IS NULL) AS activeTeachers,
       (SELECT COUNT(*) FROM dbo.users WHERE role = 'teacher' AND status = 'blocked' AND deleted_at IS NULL) AS blockedTeachers,
       (SELECT COUNT(*) FROM dbo.teacher_subscriptions WHERE is_blocked = 0 AND end_date BETWEEN @today AND DATEADD(DAY, 7, @today)) AS expiringSubscriptions7d`,
    { today: T.date(today) },
  );
  const teachers = await query("SELECT user_id FROM dbo.users WHERE role = 'teacher' AND deleted_at IS NULL");
  const counts = await studentCount.countActiveByTeacher(teachers.map((t) => t.user_id));
  const totalStudents = [...counts.values()].reduce((a, b) => a + b, 0);
  return { ...r, totalStudents };
}

async function auditLog({ action, from, to, offset, limit }) {
  const params = {
    a: T.varchar(action || null, 40),
    f: T.date(from || null),
    t: T.date(to || null),
    off: T.int(offset),
    lim: T.int(limit),
  };
  const where = `WHERE (@a IS NULL OR l.action = @a) AND (@f IS NULL OR l.created_at >= @f)
                 AND (@t IS NULL OR l.created_at < DATEADD(DAY, 1, CAST(@t AS DATETIME2)))`;
  const rows = await query(
    `SELECT l.audit_id, l.action, l.entity_type, l.entity_id, l.before_json, l.after_json, l.ip, l.created_at, u.name AS admin_name
     FROM dbo.admin_audit_log l JOIN dbo.users u ON u.user_id = l.admin_id ${where}
     ORDER BY l.created_at DESC, l.audit_id DESC OFFSET @off ROWS FETCH NEXT @lim ROWS ONLY`,
    params,
  );
  const { n } = await one(`SELECT COUNT(*) n FROM dbo.admin_audit_log l ${where}`, params);
  return {
    rows: rows.map((r) => ({
      id: Number(r.audit_id),
      action: r.action,
      entityType: r.entity_type,
      entityId: r.entity_id,
      before: r.before_json ? JSON.parse(r.before_json) : null,
      after: r.after_json ? JSON.parse(r.after_json) : null,
      ip: r.ip,
      adminName: r.admin_name,
      createdAt: r.created_at,
    })),
    total: n,
  };
}

module.exports = { list, detail, block, activate, dashboard, auditLog };
