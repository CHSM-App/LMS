const { app, request, reset, closeAll, createUser, sendOtp, asUser } = require('../../setup/helpers');
const logger = require('../../../src/utils/logger');

const entries = [];
beforeEach(async () => {
  await reset();
  entries.length = 0;
  logger.setSink((e) => entries.push(e));
});
afterEach(() => logger.setSink(null));
afterAll(closeAll);

const cookieOf = (res) => [].concat(res.headers['set-cookie'] || []).find((c) => c.startsWith('rt=')).split(';')[0];

test('a wrong OTP is logged as a security event with a masked mobile and never the code', async () => {
  const mobile = '+919811122233';
  await createUser({ mobile });
  const code = await sendOtp(mobile, 'login');
  const wrong = code === '000000' ? '111111' : '000000';
  const res = await request(app).post('/api/v1/auth/login').send({ mobile, otp: wrong });
  expect(res.status).toBe(400);
  const e = entries.find((x) => x.event === 'otp_failed');
  expect(e).toMatchObject({ level: 'warn', purpose: 'login', mobile: expect.stringMatching(/X/) });
  const all = JSON.stringify(entries);
  expect(all).not.toContain('9811122233');
  expect(all).not.toContain(wrong);
  expect(all).not.toContain(code);
});

test('reuse of a revoked refresh token is logged', async () => {
  const mobile = '+919811122234';
  const u = await createUser({ mobile });
  const code = await sendOtp(mobile, 'login');
  const first = await request(app).post('/api/v1/auth/login').send({ mobile, otp: code });
  const c1 = cookieOf(first);
  const r2 = await request(app).post('/api/v1/auth/refresh').set('Cookie', c1);
  await request(app).post('/api/v1/auth/refresh').set('Cookie', cookieOf(r2)); // the real client moved on
  const stolen = await request(app).post('/api/v1/auth/refresh').set('Cookie', c1);
  expect(stolen.status).toBe(401);
  expect(entries.find((x) => x.event === 'token_reuse')).toMatchObject({ level: 'warn', userId: u.user_id });
  expect(JSON.stringify(entries)).not.toContain(c1.slice(3));
});

test('a 403 is logged with the user, method and path', async () => {
  const s = await asUser({ role: 'student' });
  const res = await s.get('/api/v1/admin/teachers');
  expect(res.status).toBe(403);
  expect(entries.find((x) => x.event === 'forbidden')).toMatchObject({ level: 'warn', method: 'GET', path: '/api/v1/admin/teachers', userId: s.user.user_id });
});
