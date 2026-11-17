const { app, request, one, T, reset, closeAll, createUser, sendOtp, asUser, query } = require('../../setup/helpers');
const { clearAuthCache } = require('../../../src/middlewares/authenticate');

beforeEach(reset);
afterAll(closeAll);

async function login(mobile) {
  const otp = await sendOtp(mobile, 'login');
  return request(app).post('/api/v1/auth/login').send({ mobile, otp });
}
const cookieOf = (res) => (res.headers['set-cookie'] || []).find((c) => c.startsWith('rt='));

test('approved teacher logs in and gets access token + refresh cookie', async () => {
  await createUser({ role: 'teacher', mobile: '+919811111111' });
  const res = await login('+919811111111');
  expect(res.status).toBe(200);
  expect(res.body.data.accessToken).toBeTruthy();
  expect(res.body.data.user).toMatchObject({ role: 'teacher', status: 'approved' });
  expect(res.body.data.refreshToken).toBeUndefined();
  const c = cookieOf(res);
  expect(c).toMatch(/HttpOnly/);
  expect(c).toMatch(/Secure/);
  expect(c).toMatch(/SameSite=Strict/);
  expect(c).toMatch(/Path=\/api\/v1\/auth/);
});

test('mobile client gets refresh token in the body', async () => {
  await createUser({ mobile: '+919811111112' });
  const otp = await sendOtp('+919811111112', 'login');
  const res = await request(app).post('/api/v1/auth/login').set('X-Client', 'mobile').send({ mobile: '+919811111112', otp });
  expect(res.body.data.refreshToken).toBeTruthy();
});

test('blocked user cannot log in', async () => {
  await createUser({ mobile: '+919811111113', status: 'blocked' });
  const res = await login('+919811111113');
  expect(res.status).toBe(403);
  expect(res.body.error).toBe('Your account is blocked. Contact support.');
  expect(res.body.code).toBe('ACCOUNT_BLOCKED');
});

test('pending and rejected teacher requests get their messages', async () => {
  await query(`INSERT INTO dbo.teacher_requests (mobile, name, course_name, subject, experience_years, status)
               VALUES ('+919811111114', N'A', N'C', N'S', 2, 'pending')`);
  let res = await login('+919811111114');
  expect(res.status).toBe(403);
  expect(res.body.error).toBe('Your request is under review');
  await query(`UPDATE dbo.teacher_requests SET status = 'rejected', reject_reason = N'Incomplete documents' WHERE mobile = '+919811111114'`);
  res = await login('+919811111114');
  expect(res.body.error).toBe('Your request was rejected: Incomplete documents. You can apply again.');
});

test('unknown mobile -> 404', async () => {
  const res = await login('+919811111115');
  expect(res.status).toBe(404);
  expect(res.body.error).toBe('No account found for this mobile number');
});

test('refresh rotates the cookie and revokes the old token', async () => {
  await createUser({ mobile: '+919811111116' });
  const first = await login('+919811111116');
  const c1 = cookieOf(first).split(';')[0];
  const r2 = await request(app).post('/api/v1/auth/refresh').set('Cookie', c1);
  expect(r2.status).toBe(200);
  expect(r2.body.data.accessToken).toBeTruthy();
  const c2 = cookieOf(r2).split(';')[0];
  expect(c2).not.toBe(c1);
  // reusing the old token logs out every session
  const reuse = await request(app).post('/api/v1/auth/refresh').set('Cookie', c1);
  expect(reuse.status).toBe(401);
  const after = await request(app).post('/api/v1/auth/refresh').set('Cookie', c2);
  expect(after.status).toBe(401);
});

test('logout clears the cookie and refresh then fails', async () => {
  await createUser({ mobile: '+919811111117' });
  const first = await login('+919811111117');
  const c1 = cookieOf(first).split(';')[0];
  const out = await request(app).post('/api/v1/auth/logout').set('Cookie', c1).set('Authorization', `Bearer ${first.body.data.accessToken}`);
  expect(out.status).toBe(200);
  expect(cookieOf(out)).toMatch(/rt=;/);
  const r = await request(app).post('/api/v1/auth/refresh').set('Cookie', c1);
  expect(r.status).toBe(401);
});

test('guards: no token 401, expired token code, wrong role 403', async () => {
  expect((await request(app).get('/api/v1/auth/me')).status).toBe(401);
  const jwt = require('jsonwebtoken');
  const expired = jwt.sign({ sub: 1, role: 'admin' }, process.env.JWT_ACCESS_SECRET, { expiresIn: -10 });
  const e = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${expired}`);
  expect(e.status).toBe(401);
  expect(e.body.code).toBe('TOKEN_EXPIRED');
  const student = await asUser({ role: 'student' });
  expect((await student.get('/api/v1/admin/teacher-requests')).status).toBe(403);
});

test('a user blocked after login is rejected on the next call', async () => {
  const t = await asUser({ role: 'teacher' });
  expect((await t.get('/api/v1/auth/me')).status).toBe(200);
  await query("UPDATE dbo.users SET status = 'blocked' WHERE user_id = @id", { id: T.int(t.user.user_id) });
  clearAuthCache();
  const res = await t.get('/api/v1/auth/me');
  expect(res.status).toBe(401);
  expect(res.body.code).toBe('ACCOUNT_BLOCKED');
});

test('me returns the profile without internal ids', async () => {
  const t = await asUser({ role: 'teacher', name: 'सुरेश' });
  const res = await t.get('/api/v1/auth/me');
  expect(res.body.data).toMatchObject({ name: 'सुरेश', role: 'teacher' });
  expect(res.body.data.user_id).toBeUndefined();
  expect(res.body.data.publicId).toBeTruthy();
  const row = await one('SELECT COUNT(*) n FROM dbo.users');
  expect(row.n).toBe(1);
});
