const { one, query, T, reset, closeAll, asUser, createUser, clock } = require('../../setup/helpers');
const { planEndDate, runSubscriptionReminders } = require('../../../src/services/teacherSubscription.service');

beforeEach(reset);
afterAll(closeAll);

test('planEndDate fills the end date from the plan', () => {
  expect(planEndDate('monthly', '2026-01-15')).toBe('2026-02-14');
  expect(planEndDate('quarterly', '2026-01-15')).toBe('2026-04-14');
  expect(planEndDate('half_yearly', '2026-01-15')).toBe('2026-07-14');
  expect(planEndDate('yearly', '2026-01-15')).toBe('2027-01-14');
  expect(planEndDate('monthly', '2026-01-31')).toBe('2026-02-28');
  expect(planEndDate('custom', '2026-01-15')).toBeNull();
});

test('create with plan computes end date, audits and notifies the teacher', async () => {
  const admin = await asUser({ role: 'admin' });
  const t = await createUser({ role: 'teacher' });
  const res = await admin.post('/api/v1/admin/subscriptions', { teacherPublicId: t.public_id, planType: 'quarterly', startDate: '2026-01-01' });
  expect(res.status).toBe(201);
  expect(res.body.data).toMatchObject({ planType: 'quarterly', startDate: '2026-01-01', endDate: '2026-03-31' });
  expect(await one("SELECT * FROM dbo.admin_audit_log WHERE action = 'subscription.create'")).toBeTruthy();
  const n = await one('SELECT message FROM dbo.notifications WHERE user_id = @id', { id: T.int(t.user_id) });
  expect(n.message).toBe('Your subscription is set: 2026-01-01 to 2026-03-31.');
});

test('custom plan needs an end date on or after the start', async () => {
  const admin = await asUser({ role: 'admin' });
  const t = await createUser({ role: 'teacher' });
  const base = { teacherPublicId: t.public_id, planType: 'custom', startDate: '2026-02-10' };
  expect((await admin.post('/api/v1/admin/subscriptions', base)).status).toBe(400);
  const bad = await admin.post('/api/v1/admin/subscriptions', { ...base, endDate: '2026-02-01' });
  expect(bad.status).toBe(400);
  expect(bad.body.error).toBe('End date must be on or after start date');
  expect((await admin.post('/api/v1/admin/subscriptions', { ...base, endDate: '2026-02-10' })).status).toBe(201);
});

test('overlapping subscriptions are refused', async () => {
  const admin = await asUser({ role: 'admin' });
  const t = await createUser({ role: 'teacher' });
  await admin.post('/api/v1/admin/subscriptions', { teacherPublicId: t.public_id, planType: 'monthly', startDate: '2026-03-01' });
  const res = await admin.post('/api/v1/admin/subscriptions', { teacherPublicId: t.public_id, planType: 'monthly', startDate: '2026-03-20' });
  expect(res.status).toBe(409);
  expect(res.body.error).toBe('This teacher already has a subscription for these dates');
  expect((await admin.post('/api/v1/admin/subscriptions', { teacherPublicId: t.public_id, planType: 'monthly', startDate: '2026-04-01' })).status).toBe(201);
});

test('list shows computed status and student count; update is audited', async () => {
  clock.set(new Date('2026-05-10T06:00:00Z'));
  const admin = await asUser({ role: 'admin' });
  const t = await createUser({ role: 'teacher' });
  await admin.post('/api/v1/admin/subscriptions', { teacherPublicId: t.public_id, planType: 'monthly', startDate: '2026-03-01' });
  const current = await admin.post('/api/v1/admin/subscriptions', { teacherPublicId: t.public_id, planType: 'monthly', startDate: '2026-05-01' });
  await admin.post('/api/v1/admin/subscriptions', { teacherPublicId: t.public_id, planType: 'monthly', startDate: '2026-06-01' });
  const res = await admin.get('/api/v1/admin/subscriptions');
  expect(res.body.data.map((s) => s.status).sort()).toEqual(['active', 'expired', 'upcoming']);
  expect(res.body.data[0]).toHaveProperty('studentCount');
  const upd = await admin.put(`/api/v1/admin/subscriptions/${current.body.data.id}`, { planType: 'custom', startDate: '2026-05-01', endDate: '2026-05-20' });
  expect(upd.status).toBe(200);
  const a = await one("SELECT * FROM dbo.admin_audit_log WHERE action = 'subscription.update'");
  expect(JSON.parse(a.before_json).endDate).toBe('2026-05-31');
  expect(JSON.parse(a.after_json).endDate).toBe('2026-05-20');
  const blocked = await admin.put(`/api/v1/admin/subscriptions/${current.body.data.id}`, { planType: 'custom', startDate: '2026-05-01', endDate: '2026-05-20', blocked: true });
  expect(blocked.body.data.status).toBe('blocked');
});

test('limited mode: expired teacher can log in but /auth/me reports expired; middleware blocks', async () => {
  clock.set(new Date('2026-05-10T06:00:00Z'));
  const { requireActiveTeacherSubscription } = require('../../../src/middlewares/teacherSubscription');
  const teacher = await asUser({ role: 'teacher' });
  await query(
    "INSERT INTO dbo.teacher_subscriptions (teacher_id, plan_type, start_date, end_date) VALUES (@t, 'monthly', '2026-03-01', '2026-03-31')",
    { t: T.int(teacher.user.user_id) },
  );
  const me = await teacher.get('/api/v1/auth/me');
  expect(me.status).toBe(200);
  expect(me.body.data.subscription).toEqual({ status: 'expired', endDate: '2026-03-31' });
  const next = jest.fn();
  await requireActiveTeacherSubscription({ user: { id: teacher.user.user_id, role: 'teacher' } }, {}, next);
  expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 403, code: 'TEACHER_SUBSCRIPTION_EXPIRED', message: 'Your subscription ended on 2026-03-31. Contact the admin to renew.' });
  await query(
    "INSERT INTO dbo.teacher_subscriptions (teacher_id, plan_type, start_date, end_date) VALUES (@t, 'monthly', '2026-05-01', '2026-05-31')",
    { t: T.int(teacher.user.user_id) },
  );
  const ok = jest.fn();
  await requireActiveTeacherSubscription({ user: { id: teacher.user.user_id, role: 'teacher' } }, {}, ok);
  expect(ok).toHaveBeenCalledWith();
});

test('reminder job notifies teacher and admins once, 7 days before the end', async () => {
  clock.set(new Date('2026-05-24T03:00:00Z'));
  const admin = await createUser({ role: 'admin' });
  const t = await createUser({ role: 'teacher', name: 'Asha' });
  await query("INSERT INTO dbo.teacher_subscriptions (teacher_id, plan_type, start_date, end_date) VALUES (@t, 'monthly', '2026-05-01', '2026-05-31')", { t: T.int(t.user_id) });
  expect(await runSubscriptionReminders()).toBe(1);
  expect(await runSubscriptionReminders()).toBe(0);
  const teacherNote = await one('SELECT message FROM dbo.notifications WHERE user_id = @id', { id: T.int(t.user_id) });
  expect(teacherNote.message).toBe('The subscription for Asha ends on 2026-05-31.');
  expect(await one('SELECT * FROM dbo.notifications WHERE user_id = @id', { id: T.int(admin.user_id) })).toBeTruthy();
});
