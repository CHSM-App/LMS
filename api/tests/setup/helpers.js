const request = require('supertest');
const { createApp } = require('../../src/app');
const { query, one, T } = require('../../src/db/query');
const tokenService = require('../../src/services/token.service');
const consoleOtp = require('../../src/providers/otp/console');
const { clearAuthCache } = require('../../src/middlewares/authenticate');
const { clock } = require('../../src/utils/clock');
const { truncateAll, closeAll } = require('./testDb');

const app = createApp();
let seq = 0;

function nextMobile() {
  seq += 1;
  return `+919700${String(seq).padStart(6, "0")}`;
}

async function createUser({ role = 'student', status = 'approved', name = 'Test User', mobile = nextMobile(), lang = 'en', whatsappOptIn = false } = {}) {
  const u = await one(
    `INSERT INTO dbo.users (mobile, name, role, status, preferred_lang, whatsapp_opt_in)
     OUTPUT INSERTED.* VALUES (@mobile, @name, @role, @status, @lang, @wa)`,
    { mobile: T.varchar(mobile, 20), name: T.nvarchar(name, 120), role: T.varchar(role, 10), status: T.varchar(status, 10), lang: T.char(lang, 2), wa: T.bit(whatsappOptIn) },
  );
  if (role === 'teacher') await query('INSERT INTO dbo.teacher_profiles (user_id, subject) VALUES (@id, N\'Maths\')', { id: T.int(u.user_id) });
  if (role === 'student') await query('INSERT INTO dbo.student_profiles (user_id, education) VALUES (@id, N\'12th\')', { id: T.int(u.user_id) });
  return u;
}

async function tokenFor(user) {
  const { accessToken } = await tokenService.issue(user);
  return accessToken;
}

async function asUser(opts) {
  const user = await createUser(opts);
  const token = await tokenFor(user);
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  return {
    user,
    token,
    get: (url) => auth(request(app).get(url)),
    post: (url, body) => auth(request(app).post(url)).send(body),
    put: (url, body) => auth(request(app).put(url)).send(body),
    del: (url) => auth(request(app).delete(url)),
    raw: (method, url) => auth(request(app)[method](url)),
  };
}

async function sendOtp(mobile, purpose) {
  const res = await request(app).post('/api/v1/auth/otp/send').send({ mobile, purpose });
  if (res.status !== 200) throw new Error(`otp send failed: ${res.status} ${JSON.stringify(res.body)}`);
  return consoleOtp.lastCode(mobile, purpose);
}

async function reset() {
  clock.reset();
  clearAuthCache();
  consoleOtp.clear();
  await truncateAll();
}

module.exports = { app, request, query, one, T, createUser, tokenFor, asUser, sendOtp, nextMobile, reset, closeAll, clock };
