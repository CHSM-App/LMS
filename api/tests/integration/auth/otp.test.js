const { app, request, one, T, reset, closeAll, clock, createUser } = require('../../setup/helpers');
const consoleOtp = require('../../../src/providers/otp/console');

beforeEach(reset);
afterAll(closeAll);

const send = (mobile, purpose = 'login') => request(app).post('/api/v1/auth/otp/send').send({ mobile, purpose });
const latest = (mobile) => one("SELECT TOP 1 * FROM dbo.otp_codes WHERE mobile = @m ORDER BY otp_id DESC", { m: T.varchar(mobile, 20) });

test('send stores a hashed code with a 5 minute expiry', async () => {
  const res = await send('98765 43210');
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ success: true, data: { sent: true, resendAfterSec: 30 } });
  const row = await latest('+919876543210');
  const code = consoleOtp.lastCode('+919876543210', 'login');
  expect(code).toMatch(/^\d{6}$/);
  expect(Buffer.from(row.code_hash).toString('utf8')).not.toContain(code);
  const mins = (new Date(row.expires_at) - Date.now()) / 60000;
  expect(mins).toBeGreaterThan(4.9);
  expect(mins).toBeLessThanOrEqual(5.01);
});

test('invalid mobile -> 400', async () => {
  const res = await send('12345');
  expect(res.status).toBe(400);
  expect(res.body.success).toBe(false);
});

test('4th send within 15 minutes -> 429', async () => {
  for (let i = 0; i < 3; i++) expect((await send('9876543211')).status).toBe(200);
  const res = await send('9876543211');
  expect(res.status).toBe(429);
  expect(res.body.error).toMatch(/^Too many OTP requests\. Try again in \d+ minutes?\.$/);
});

test('resend window resets after 15 minutes', async () => {
  for (let i = 0; i < 3; i++) await send('9876543212');
  clock.advance(16 * 60 * 1000);
  expect((await send('9876543212')).status).toBe(200);
});

test('verify: right code works once', async () => {
  const otpService = require('../../../src/services/otp.service');
  await send('9876543213');
  const code = consoleOtp.lastCode('+919876543213', 'login');
  await expect(otpService.verify('+919876543213', 'login', code)).resolves.toBe(true);
  await expect(otpService.verify('+919876543213', 'login', code)).rejects.toThrow('OTP expired or already used');
});

test('verify: 5 wrong tries then even the right code fails', async () => {
  const otpService = require('../../../src/services/otp.service');
  await send('9876543214');
  const code = consoleOtp.lastCode('+919876543214', 'login');
  const wrong = code === '000000' ? '111111' : '000000';
  for (let i = 0; i < 5; i++) await expect(otpService.verify('+919876543214', 'login', wrong)).rejects.toThrow();
  await expect(otpService.verify('+919876543214', 'login', code)).rejects.toThrow('Too many wrong attempts. Request a new OTP.');
});

test('verify after expiry fails', async () => {
  const otpService = require('../../../src/services/otp.service');
  await send('9876543215');
  const code = consoleOtp.lastCode('+919876543215', 'login');
  clock.advance(5 * 60 * 1000 + 1000);
  await expect(otpService.verify('+919876543215', 'login', code)).rejects.toThrow('OTP expired or already used');
});

test('two parallel sends are both counted', async () => {
  await Promise.all([send('9876543216'), send('9876543216')]);
  const row = await latest('+919876543216');
  expect(row.resend_count).toBe(2);
});

test('known and unknown numbers get identical responses', async () => {
  await createUser({ mobile: '+919876543217' });
  const a = await send('9876543217');
  const b = await send('9876543218');
  expect(a.status).toBe(b.status);
  expect(a.body).toEqual(b.body);
});
