const { one, T, reset, closeAll, asUser } = require('../../setup/helpers');
const { notify } = require('../../../src/services/notification.service');

beforeEach(reset);
afterAll(closeAll);

test('users see only their own notifications; unread filter; mark read and read-all', async () => {
  const a = await asUser({ role: 'student' });
  const b = await asUser({ role: 'teacher' });
  await notify(a.user.user_id, { title: 'One', message: 'm1' });
  await notify(a.user.user_id, { title: 'Two', message: 'm2' });
  await notify(b.user.user_id, { title: 'Other', message: 'x' });

  const list = await a.get('/api/v1/notifications');
  expect(list.body.data.map((n) => n.title).sort()).toEqual(['One', 'Two']);
  expect(list.body.pagination.total).toBe(2);

  const theirs = await one('SELECT notification_id FROM dbo.notifications WHERE user_id = @id', { id: T.int(b.user.user_id) });
  expect((await a.post(`/api/v1/notifications/${theirs.notification_id}/read`)).status).toBe(404);

  await a.post(`/api/v1/notifications/${list.body.data[0].id}/read`);
  expect((await a.get('/api/v1/notifications?unread=true')).body.pagination.total).toBe(1);
  await a.post('/api/v1/notifications/read-all');
  expect((await a.get('/api/v1/notifications?unread=true')).body.pagination.total).toBe(0);
});

test('notifications use the user language', async () => {
  const s = await asUser({ role: 'teacher', lang: 'mr' });
  await notify(s.user.user_id, { key: 'account.activated' });
  const res = await s.get('/api/v1/notifications');
  expect(res.body.data[0].title).toBe('तुमचे खाते पुन्हा सक्रिय आहे');
});

test('audit log is admin-only and filterable', async () => {
  const admin = await asUser({ role: 'admin' });
  const t = await asUser({ role: 'teacher' });
  await admin.post(`/api/v1/admin/teachers/${t.user.public_id}/block`, { reason: 'Testing audit' });
  await admin.post(`/api/v1/admin/teachers/${t.user.public_id}/activate`);
  const all = await admin.get('/api/v1/admin/audit-log');
  expect(all.body.data.map((r) => r.action)).toEqual(['teacher.activate', 'teacher.block']);
  expect(all.body.data[0].adminName).toBe('Test User');
  const filtered = await admin.get('/api/v1/admin/audit-log?action=teacher.block');
  expect(filtered.body.data).toHaveLength(1);
  expect((await t.get('/api/v1/admin/audit-log')).status).toBe(403);
});

test('the app database role cannot update or delete audit rows', async () => {
  const perms = await one(`
    SELECT COUNT(*) n FROM sys.database_permissions p
    JOIN sys.database_principals r ON r.principal_id = p.grantee_principal_id
    WHERE r.name = 'lms_app' AND p.state_desc = 'DENY' AND p.major_id = OBJECT_ID('dbo.admin_audit_log')
      AND p.permission_name IN ('UPDATE', 'DELETE')`);
  expect(perms.n).toBe(2);
});
