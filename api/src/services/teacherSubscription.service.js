const { query, one, T } = require('../db/query');
const { withTransaction } = require('../db/tx');
const { audit } = require('./audit.service');
const { notify, notifyAdmins } = require('./notification.service');
const studentCount = require('./studentCount.service');
const { clock, todayIST } = require('../utils/clock');
const { badRequest, conflict, notFound } = require('../utils/APIError');

const PLAN_MONTHS = { monthly: 1, quarterly: 3, half_yearly: 6, yearly: 12 };
const PLANS = [...Object.keys(PLAN_MONTHS), 'custom'];

const iso = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));

// End date = start + N months - 1 day (clamped to month end). Custom plans return null.
function planEndDate(planType, startDate) {
  const months = PLAN_MONTHS[planType];
  if (!months) return null;
  const [y, m, d] = startDate.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  const end = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(d, lastDay)));
  if (Math.min(d, lastDay) === d) end.setUTCDate(end.getUTCDate() - 1);
  return iso(end);
}

function statusOf(row, today = todayIST()) {
  if (row.is_blocked) return 'blocked';
  const start = iso(row.start_date);
  const end = iso(row.end_date);
  if (today < start) return 'upcoming';
  if (today > end) return 'expired';
  return 'active';
}

const serialize = (r, count) => ({
  id: r.subscription_id,
  teacher: { publicId: r.teacher_public_id, name: r.teacher_name },
  planType: r.plan_type,
  startDate: iso(r.start_date),
  endDate: iso(r.end_date),
  status: statusOf(r),
  studentCount: count ?? 0,
});

function resolveDates({ planType, startDate, endDate }) {
  if (!PLANS.includes(planType)) throw badRequest('planType: choose a plan');
  const end = planType === 'custom' ? endDate : planEndDate(planType, startDate);
  if (!end) throw badRequest('endDate: is required for a custom plan', 'VALIDATION_ERROR');
  if (end < startDate) throw badRequest('End date must be on or after start date', 'DATE_ORDER');
  return end;
}

async function assertNoOverlap(teacherId, start, end, exceptId, tx) {
  const clash = await one(
    `SELECT TOP 1 subscription_id FROM dbo.teacher_subscriptions WITH (UPDLOCK, HOLDLOCK)
     WHERE teacher_id = @t AND is_blocked = 0 AND (@except IS NULL OR subscription_id <> @except)
       AND start_date <= @end AND end_date >= @start`,
    { t: T.int(teacherId), start: T.date(start), end: T.date(end), except: T.int(exceptId ?? null) },
    tx,
  );
  if (clash) throw conflict('This teacher already has a subscription for these dates', 'SUBSCRIPTION_OVERLAP');
}

const SELECT = `SELECT s.*, u.public_id AS teacher_public_id, u.name AS teacher_name
                FROM dbo.teacher_subscriptions s JOIN dbo.users u ON u.user_id = s.teacher_id`;

async function getRow(id, tx) {
  return one(`${SELECT} WHERE s.subscription_id = @id`, { id: T.int(id) }, tx);
}

async function create({ teacherPublicId, planType, startDate, endDate }, adminId, ip) {
  const end = resolveDates({ planType, startDate, endDate });
  const row = await withTransaction(async (tx) => {
    const teacher = await one("SELECT user_id FROM dbo.users WHERE public_id = @p AND role = 'teacher' AND deleted_at IS NULL", { p: T.uuid(teacherPublicId) }, tx);
    if (!teacher) throw notFound('Teacher not found');
    await assertNoOverlap(teacher.user_id, startDate, end, null, tx);
    const ins = await one(
      `INSERT INTO dbo.teacher_subscriptions (teacher_id, plan_type, start_date, end_date, created_by)
       OUTPUT INSERTED.subscription_id VALUES (@t, @p, @s, @e, @a)`,
      { t: T.int(teacher.user_id), p: T.varchar(planType, 12), s: T.date(startDate), e: T.date(end), a: T.int(adminId) },
      tx,
    );
    await audit({ adminId, action: 'subscription.create', entityType: 'teacher_subscription', entityId: ins.subscription_id, after: { planType, startDate, endDate: end }, ip }, tx);
    await notify(teacher.user_id, { key: 'subscription.set', vars: { start: startDate, end }, link: '/teacher' }, tx);
    return getRow(ins.subscription_id, tx);
  });
  return serialize(row);
}

async function update(id, { planType, startDate, endDate, blocked }, adminId, ip) {
  const end = resolveDates({ planType, startDate, endDate });
  const row = await withTransaction(async (tx) => {
    const before = await getRow(id, tx);
    if (!before) throw notFound('Subscription not found');
    if (!blocked) await assertNoOverlap(before.teacher_id, startDate, end, id, tx);
    await query(
      'UPDATE dbo.teacher_subscriptions SET plan_type = @p, start_date = @s, end_date = @e, is_blocked = @b, reminder_sent_at = NULL WHERE subscription_id = @id',
      { p: T.varchar(planType, 12), s: T.date(startDate), e: T.date(end), b: T.bit(!!blocked), id: T.int(id) },
      tx,
    );
    await audit({
      adminId,
      action: 'subscription.update',
      entityType: 'teacher_subscription',
      entityId: id,
      before: { planType: before.plan_type, startDate: iso(before.start_date), endDate: iso(before.end_date), blocked: before.is_blocked },
      after: { planType, startDate, endDate: end, blocked: !!blocked },
      ip,
    }, tx);
    await notify(before.teacher_id, { key: 'subscription.set', vars: { start: startDate, end }, link: '/teacher' }, tx);
    return getRow(id, tx);
  });
  return serialize(row);
}

async function list({ teacherPublicId, status, offset, limit }) {
  const rows = await query(
    `${SELECT} WHERE (@tp IS NULL OR u.public_id = @tp) ORDER BY s.start_date DESC, s.subscription_id DESC`,
    { tp: T.uuid(teacherPublicId || null) },
  );
  const counts = await studentCount.countActiveByTeacher([...new Set(rows.map((r) => r.teacher_id))]);
  const all = rows.map((r) => serialize(r, counts.get(r.teacher_id))).filter((s) => !status || s.status === status);
  return { rows: all.slice(offset, offset + limit), total: all.length };
}

async function forTeacher(teacherId) {
  const rows = await query(`${SELECT} WHERE s.teacher_id = @t ORDER BY s.start_date DESC`, { t: T.int(teacherId) });
  return rows.map((r) => serialize(r));
}

// Today's state for limited mode: { status: 'active'|'expired'|'none', endDate }.
async function currentForTeacher(teacherId) {
  const today = todayIST();
  const active = await one(
    `SELECT TOP 1 end_date FROM dbo.teacher_subscriptions
     WHERE teacher_id = @t AND is_blocked = 0 AND @today BETWEEN start_date AND end_date ORDER BY end_date DESC`,
    { t: T.int(teacherId), today: T.date(today) },
  );
  if (active) return { status: 'active', endDate: iso(active.end_date) };
  const last = await one(
    'SELECT TOP 1 end_date FROM dbo.teacher_subscriptions WHERE teacher_id = @t AND end_date < @today ORDER BY end_date DESC',
    { t: T.int(teacherId), today: T.date(today) },
  );
  if (last) return { status: 'expired', endDate: iso(last.end_date) };
  return { status: 'none', endDate: null };
}

// Daily job: subscriptions ending within 7 days get one reminder (teacher + admins).
async function runSubscriptionReminders() {
  const today = todayIST();
  const inSeven = iso(new Date(Date.parse(`${today}T00:00:00Z`) + 7 * 86400000));
  const due = await query(
    `SELECT s.subscription_id, s.end_date, u.user_id, u.name, u.mobile, u.preferred_lang, u.whatsapp_opt_in
     FROM dbo.teacher_subscriptions s JOIN dbo.users u ON u.user_id = s.teacher_id
     WHERE s.is_blocked = 0 AND s.reminder_sent_at IS NULL AND s.end_date BETWEEN @today AND @seven AND u.deleted_at IS NULL`,
    { today: T.date(today), seven: T.date(inSeven) },
  );
  for (const r of due) {
    const vars = { name: r.name, end: iso(r.end_date) };
    await withTransaction(async (tx) => {
      const claimed = await query(
        'UPDATE dbo.teacher_subscriptions SET reminder_sent_at = @now OUTPUT INSERTED.subscription_id WHERE subscription_id = @id AND reminder_sent_at IS NULL',
        { id: T.int(r.subscription_id), now: T.datetime(clock.now()) },
        tx,
      );
      if (!claimed.length) return;
      await notify(r.user_id, { key: 'subscription.expiring', vars, link: '/teacher', whatsapp: { key: 'wa.subscriptionReminder', template: 'subscription_reminder' } }, tx);
      await notifyAdmins({ key: 'subscription.expiring', vars, link: '/admin/subscriptions' }, tx);
    });
  }
  return due.length;
}

module.exports = { planEndDate, statusOf, create, update, list, forTeacher, currentForTeacher, runSubscriptionReminders, PLANS };
