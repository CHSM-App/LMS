const path = require('path');
const fs = require('fs');
const { app, request, one, query, T, reset, closeAll, asUser, sendOtp } = require('../../setup/helpers');

beforeEach(reset);
afterAll(closeAll);

const PNG = Buffer.from('89504E470D0A1A0A0000000D4948445200000001000000010806000000', 'hex');

async function submit(fields = {}, opts = {}) {
  const mobile = fields.mobile || '+919822222221';
  const otp = opts.otp || (await sendOtp(mobile, 'teacher_register'));
  const body = { name: 'Suresh Patil', mobile, otp, courseName: 'Class 10 Maths', subject: 'Maths', experienceYears: '5', email: 'Suresh@Gmail.com', acceptTerms: 'true', whatsappOptIn: 'true', ...fields };
  let r = request(app).post('/api/v1/teacher-requests');
  for (const [k, v] of Object.entries(body)) if (v !== undefined) r = r.field(k, v);
  if (opts.photo) r = r.attach('photo', opts.photo.buffer, opts.photo.name);
  return r;
}

// Registrations are auto-approved now, so admin accept/reject only applies to older pending rows.
async function pendingRow(mobile = '+919822222231') {
  const r = await one(
    `INSERT INTO dbo.teacher_requests (mobile, name, course_name, subject, experience_years)
     OUTPUT INSERTED.request_id VALUES (@m, N'Old Request', N'Class 9 Science', N'Science', 3)`,
    { m: T.varchar(mobile, 20) },
  );
  return r.request_id;
}

test('valid registration is auto-approved: teacher account created, admins notified, teacher can log in', async () => {
  const admin = await asUser({ role: 'admin' });
  const res = await submit();
  expect(res.status).toBe(201);
  expect(res.body.data.status).toBe('approved');
  const reqRow = await one("SELECT status, user_id, reviewed_by FROM dbo.teacher_requests WHERE mobile = '+919822222221'");
  expect(reqRow).toMatchObject({ status: 'approved', reviewed_by: null });
  const u = await one("SELECT * FROM dbo.users WHERE mobile = '+919822222221'");
  expect(u).toMatchObject({ user_id: reqRow.user_id, role: 'teacher', status: 'approved', whatsapp_opt_in: true });
  expect(await one('SELECT * FROM dbo.teacher_profiles WHERE user_id = @id', { id: T.int(u.user_id) })).toMatchObject({ subject: 'Maths', experience_years: 5 });
  const n = await one('SELECT title, message FROM dbo.notifications WHERE user_id = @id', { id: T.int(admin.user.user_id) });
  expect(n.message).toBe('New teacher registered: Suresh Patil');
  const consents = await query("SELECT consent_type, user_id FROM dbo.legal_consents WHERE mobile = '+919822222221'");
  expect(consents.map((c) => c.consent_type).sort()).toEqual(['terms_privacy', 'whatsapp']);
  expect(consents.every((c) => c.user_id === u.user_id)).toBe(true);
  const otp = await sendOtp('+919822222221', 'login');
  const login = await request(app).post('/api/v1/auth/login').send({ mobile: '+919822222221', otp });
  expect(login.status).toBe(200);
});

test('the Google email is required (it makes the teacher co-host of their Meet classes) and is saved on the account', async () => {
  const missing = await submit({ email: undefined });
  expect(missing.status).toBe(400);
  expect(missing.body.details).toMatchObject({ field: 'email' });
  expect((await submit({ email: 'not-an-email' })).status).toBe(400);
  expect((await submit()).status).toBe(201);
  expect((await one("SELECT email FROM dbo.users WHERE mobile = '+919822222221'")).email).toBe('suresh@gmail.com');
});

test('missing subject -> 400', async () => {
  const res = await submit({ subject: undefined });
  expect(res.status).toBe(400);
});

test('terms not accepted -> 400', async () => {
  const res = await submit({ acceptTerms: 'false' });
  expect(res.status).toBe(400);
  expect(res.body.error).toBe('Accept the Terms and Privacy Policy to continue');
});

test('wrong OTP -> 400 and nothing saved', async () => {
  await sendOtp('+919822222222', 'teacher_register');
  const res = await submit({ mobile: '+919822222222' }, { otp: '000001' });
  expect(res.status).toBe(400);
  expect((await one('SELECT COUNT(*) n FROM dbo.teacher_requests')).n).toBe(0);
  expect((await one("SELECT COUNT(*) n FROM dbo.users WHERE mobile = '+919822222222'")).n).toBe(0);
});

test('registering the same mobile again -> 409 already registered', async () => {
  await submit();
  const res = await submit();
  expect(res.status).toBe(409);
  expect(res.body.error).toBe('This number is already registered. Log in instead.');
});

test('photo with wrong type is rejected; a real PNG is stored and used on the account', async () => {
  const bad = await submit({}, { photo: { buffer: Buffer.from('MZ fake exe'), name: 'me.png' } });
  expect(bad.status).toBe(400);
  expect(bad.body.error).toBe('File type not allowed');
  const ok = await submit({ mobile: '+919822222223' }, { photo: { buffer: PNG, name: 'me.png' } });
  expect(ok.status).toBe(201);
  const row = await one("SELECT photo_key FROM dbo.teacher_requests WHERE mobile = '+919822222223'");
  expect(row.photo_key).toMatch(/^photo\/[0-9a-f-]{36}\.png$/);
  expect(fs.existsSync(path.join(process.env.STORAGE_DIR, row.photo_key))).toBe(true);
  expect((await one("SELECT photo_key FROM dbo.users WHERE mobile = '+919822222223'")).photo_key).toBe(row.photo_key);
});

test('admin accepts an older pending request: user + profile created, audit logged, teacher can log in', async () => {
  const admin = await asUser({ role: 'admin' });
  const id = await pendingRow();
  const res = await admin.post(`/api/v1/admin/teacher-requests/${id}/accept`, {});
  expect(res.status).toBe(200);
  const u = await one("SELECT * FROM dbo.users WHERE mobile = '+919822222231'");
  expect(u).toMatchObject({ role: 'teacher', status: 'approved' });
  expect(await one('SELECT * FROM dbo.teacher_profiles WHERE user_id = @id', { id: T.int(u.user_id) })).toBeTruthy();
  const a = await one("SELECT * FROM dbo.admin_audit_log WHERE action = 'teacher_request.accept'");
  expect(a.entity_id).toBe(id);
  const otp = await sendOtp('+919822222231', 'login');
  const login = await request(app).post('/api/v1/auth/login').send({ mobile: '+919822222231', otp });
  expect(login.status).toBe(200);
});

test('reject needs a reason, then the mobile can register again (auto-approved)', async () => {
  const admin = await asUser({ role: 'admin' });
  const id = await pendingRow('+919822222221');
  expect((await admin.post(`/api/v1/admin/teacher-requests/${id}/reject`, {})).status).toBe(400);
  const res = await admin.post(`/api/v1/admin/teacher-requests/${id}/reject`, { reason: 'Please add your certificate' });
  expect(res.status).toBe(200);
  expect(await one("SELECT * FROM dbo.admin_audit_log WHERE action = 'teacher_request.reject'")).toBeTruthy();
  const again = await submit();
  expect(again.status).toBe(201);
  expect(again.body.data.status).toBe('approved');
});

test('admin list filters by status and paginates', async () => {
  const admin = await asUser({ role: 'admin' });
  await submit();
  await submit({ mobile: '+919822222224' });
  await pendingRow();
  const res = await admin.get('/api/v1/admin/teacher-requests?status=approved&page=1&limit=1');
  expect(res.status).toBe(200);
  expect(res.body.data).toHaveLength(1);
  expect(res.body.pagination).toEqual({ page: 1, limit: 1, total: 2 });
  expect(res.body.data[0]).toMatchObject({ status: 'approved', subject: 'Maths' });
});

test('accepting an already approved request -> 409', async () => {
  const admin = await asUser({ role: 'admin' });
  const id = (await submit()).body.data.requestId;
  const again = await admin.post(`/api/v1/admin/teacher-requests/${id}/accept`, {});
  expect(again.status).toBe(409);
});
