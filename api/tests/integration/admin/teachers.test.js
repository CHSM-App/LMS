const { app, request, one, query, T, reset, closeAll, asUser, createUser } = require('../../setup/helpers');
const studentCount = require('../../../src/services/studentCount.service');

beforeEach(reset);
afterAll(closeAll);
afterEach(() => jest.restoreAllMocks());

test('teacher list shows name, mobile, subject, status, joined date and student count', async () => {
  const admin = await asUser({ role: 'admin' });
  const a = await createUser({ role: 'teacher', name: 'सुरेश पाटील', mobile: '+919876500001' });
  await createUser({ role: 'teacher', name: 'Asha Kulkarni', mobile: '+919876500002', status: 'blocked' });
  jest.spyOn(studentCount, 'countActiveByTeacher').mockResolvedValue(new Map([[a.user_id, 2]]));
  const res = await admin.get('/api/v1/admin/teachers');
  expect(res.status).toBe(200);
  expect(res.body.pagination.total).toBe(2);
  const row = res.body.data.find((r) => r.mobile === '+919876500001');
  expect(row).toMatchObject({ name: 'सुरेश पाटील', subject: 'Maths', status: 'approved', studentCount: 2 });
  expect(row.joinedAt).toBeTruthy();
  expect(row.publicId).toBeTruthy();
  expect(row.user_id).toBeUndefined();
});

test('search by Marathi name and by mobile, filter by status', async () => {
  const admin = await asUser({ role: 'admin' });
  await createUser({ role: 'teacher', name: 'सुरेश पाटील', mobile: '+919876500003' });
  await createUser({ role: 'teacher', name: 'Asha', mobile: '+919876500004', status: 'blocked' });
  expect((await admin.get(`/api/v1/admin/teachers?q=${encodeURIComponent('सुरेश')}`)).body.data).toHaveLength(1);
  expect((await admin.get('/api/v1/admin/teachers?q=98765000')).body.data).toHaveLength(2);
  const blocked = await admin.get('/api/v1/admin/teachers?status=blocked');
  expect(blocked.body.data.map((r) => r.name)).toEqual(['Asha']);
});

test('dashboard counts', async () => {
  const admin = await asUser({ role: 'admin' });
  await createUser({ role: 'teacher' });
  await createUser({ role: 'teacher', status: 'blocked' });
  await query(`INSERT INTO dbo.teacher_requests (mobile, name, course_name, subject, experience_years) VALUES ('+919876500005', N'X', N'C', N'S', 1)`);
  const res = await admin.get('/api/v1/admin/dashboard');
  expect(res.body.data).toMatchObject({ pendingRequests: 1, activeTeachers: 1, blockedTeachers: 1, totalStudents: 0, expiringSubscriptions7d: 0 });
});

test('block: status, tokens revoked, audit, notification, next call 401', async () => {
  const admin = await asUser({ role: 'admin' });
  const teacher = await asUser({ role: 'teacher' });
  expect((await admin.post(`/api/v1/admin/teachers/${teacher.user.public_id}/block`, {})).status).toBe(400);
  const res = await admin.post(`/api/v1/admin/teachers/${teacher.user.public_id}/block`, { reason: 'Repeated complaints' });
  expect(res.status).toBe(200);
  const u = await one('SELECT status FROM dbo.users WHERE user_id = @id', { id: T.int(teacher.user.user_id) });
  expect(u.status).toBe('blocked');
  const a = await one("SELECT * FROM dbo.admin_audit_log WHERE action = 'teacher.block'");
  expect(JSON.parse(a.before_json)).toEqual({ status: 'approved' });
  expect(JSON.parse(a.after_json)).toMatchObject({ status: 'blocked', reason: 'Repeated complaints' });
  expect(await one("SELECT * FROM dbo.notifications WHERE user_id = @id AND title = 'Your account has been blocked'", { id: T.int(teacher.user.user_id) })).toBeTruthy();
  expect((await teacher.get('/api/v1/auth/me')).status).toBe(401);
  expect((await admin.post(`/api/v1/admin/teachers/${teacher.user.public_id}/block`, { reason: 'Again please' })).status).toBe(409);
});

test('activate restores the account and is audited', async () => {
  const admin = await asUser({ role: 'admin' });
  const t = await createUser({ role: 'teacher', status: 'blocked' });
  const res = await admin.post(`/api/v1/admin/teachers/${t.public_id}/activate`, {});
  expect(res.status).toBe(200);
  expect((await one('SELECT status FROM dbo.users WHERE user_id = @id', { id: T.int(t.user_id) })).status).toBe('approved');
  expect(await one("SELECT * FROM dbo.admin_audit_log WHERE action = 'teacher.activate'")).toBeTruthy();
});

test('teacher detail includes subscriptions; unknown id 404', async () => {
  const admin = await asUser({ role: 'admin' });
  const t = await createUser({ role: 'teacher' });
  const res = await admin.get(`/api/v1/admin/teachers/${t.public_id}`);
  expect(res.status).toBe(200);
  expect(res.body.data).toMatchObject({ name: 'Test User', subscriptions: [] });
  expect((await admin.get('/api/v1/admin/teachers/00000000-0000-0000-0000-000000000000')).status).toBe(404);
});

test('admin cannot reach teacher course routes; teacher cannot reach admin routes', async () => {
  const admin = await asUser({ role: 'admin' });
  const teacher = await asUser({ role: 'teacher' });
  expect((await admin.get('/api/v1/teacher/courses')).status).toBe(403);
  expect((await teacher.get('/api/v1/admin/teachers')).status).toBe(403);
  expect((await request(app).get('/api/v1/admin/dashboard')).status).toBe(401);
});
