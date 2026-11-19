const { app, request, one, query, T, reset, closeAll, asUser, sendOtp, createUser } = require('../../setup/helpers');

beforeEach(reset);
afterAll(closeAll);

test('change mobile: start sends OTP to the new number, confirm updates and revokes other sessions', async () => {
  const s = await asUser({ role: 'student', mobile: '+919833333331' });
  const tokenService = require('../../../src/services/token.service');
  const other = await tokenService.issue(s.user);
  let res = await s.post('/api/v1/account/change-mobile/start', { newMobile: '9833333332' });
  expect(res.status).toBe(200);
  const otp = require('../../../src/providers/otp/console').lastCode('+919833333332', 'change_mobile');
  res = await s.post('/api/v1/account/change-mobile/confirm', { newMobile: '9833333332', otp });
  expect(res.status).toBe(200);
  const u = await one('SELECT mobile FROM dbo.users WHERE user_id = @id', { id: T.int(s.user.user_id) });
  expect(u.mobile).toBe('+919833333332');
  const r = await request(app).post('/api/v1/auth/refresh').set('Cookie', `rt=${other.refreshToken}`);
  expect(r.status).toBe(401);
  expect((await one('SELECT COUNT(*) n FROM dbo.notifications WHERE user_id = @id', { id: T.int(s.user.user_id) })).n).toBe(1);
});

test('change mobile to a number already in use -> 409', async () => {
  await createUser({ mobile: '+919833333333' });
  const s = await asUser({ mobile: '+919833333334' });
  const res = await s.post('/api/v1/account/change-mobile/start', { newMobile: '9833333333' });
  expect(res.status).toBe(409);
  expect(res.body.error).toBe('This number is already registered');
});

test('wrong OTP leaves the mobile unchanged', async () => {
  const s = await asUser({ mobile: '+919833333335' });
  await s.post('/api/v1/account/change-mobile/start', { newMobile: '9833333336' });
  const res = await s.post('/api/v1/account/change-mobile/confirm', { newMobile: '9833333336', otp: '000000' });
  expect(res.status).toBe(400);
  expect((await one('SELECT mobile FROM dbo.users WHERE user_id = @id', { id: T.int(s.user.user_id) })).mobile).toBe('+919833333335');
});

test('admin changes a mobile with a reason and it is audited', async () => {
  const admin = await asUser({ role: 'admin' });
  const t = await createUser({ role: 'teacher', mobile: '+919833333337' });
  expect((await admin.post(`/api/v1/admin/users/${t.public_id}/change-mobile`, { newMobile: '9833333338' })).status).toBe(400);
  const res = await admin.post(`/api/v1/admin/users/${t.public_id}/change-mobile`, { newMobile: '9833333338', reason: 'Lost SIM card' });
  expect(res.status).toBe(200);
  expect(await one("SELECT * FROM dbo.admin_audit_log WHERE action = 'user.change_mobile'")).toBeTruthy();
});

test('delete account anonymises data, revokes tokens and frees the number', async () => {
  const s = await asUser({ role: 'student', mobile: '+919833333339', name: 'Asha' });
  await sendOtp('+919833333339', 'delete_account');
  const otp = require('../../../src/providers/otp/console').lastCode('+919833333339', 'delete_account');
  const res = await s.post('/api/v1/account/delete', { otp });
  expect(res.status).toBe(200);
  const u = await one('SELECT * FROM dbo.users WHERE user_id = @id', { id: T.int(s.user.user_id) });
  expect(u.name).toBe('Deleted user');
  expect(u.mobile).toBe(`del-${s.user.user_id}`);
  expect(u.deleted_at).toBeTruthy();
  const otp2 = await sendOtp('+919833333339', 'login');
  const login = await request(app).post('/api/v1/auth/login').send({ mobile: '+919833333339', otp: otp2 });
  expect(login.status).toBe(404);
  await createUser({ mobile: '+919833333339' });
});

test('legal pages are public and versioned', async () => {
  const res = await request(app).get('/api/v1/public/legal/privacy');
  expect(res.status).toBe(200);
  expect(res.body.data.version).toBe(process.env.POLICY_VERSION || '1.0');
  expect(res.body.data.markdown.length).toBeGreaterThan(50);
  expect((await request(app).get('/api/v1/public/legal/other')).status).toBe(400);
});

test('consents table stays the record of agreement', async () => {
  await query("INSERT INTO dbo.legal_consents (mobile, consent_type, policy_version) VALUES ('+919833333340', 'terms_privacy', '1.0')");
  expect((await one('SELECT COUNT(*) n FROM dbo.legal_consents')).n).toBe(1);
});

test('language: any signed-in user saves their language; /auth/me returns it; bad values refused', async () => {
  for (const role of ['student', 'teacher', 'admin']) {
    const u = await asUser({ role });
    const res = await u.put('/api/v1/account/language', { preferredLang: 'en' });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ preferredLang: 'en' });
    expect((await u.get('/api/v1/auth/me')).body.data.preferredLang).toBe('en');
    expect((await u.put('/api/v1/account/language', { preferredLang: 'fr' })).status).toBe(400);
  }
  expect((await request(app).put('/api/v1/account/language').send({ preferredLang: 'mr' })).status).toBe(401);
});
