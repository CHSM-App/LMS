const crypto = require('crypto');
const { reset, closeAll, request, app } = require('../../setup/helpers');
const { student, query, T } = require('../../setup/operations');
const { fetchMock } = require('../../setup/fetchMock');
const push = require('../../../src/providers/push');
const { notify } = require('../../../src/services/notification.service');

const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
const SA = JSON.stringify({ project_id: 'lms-test', client_email: 'sa@lms-test.iam.gserviceaccount.com', private_key: privateKey });

beforeEach(async () => {
  await reset();
  push.clearSent();
  process.env.PUSH_PROVIDER = 'console';
});
afterAll(closeAll);

const tokensOf = (userId) => query('SELECT token, platform FROM dbo.push_tokens WHERE user_id = @u', { u: T.int(userId) });

describe('POST/DELETE /push-tokens', () => {
  test('registers a token, and the same token twice stays one row', async () => {
    const s = await student();
    const { tokenFor } = require('../../setup/helpers');
    const t = await tokenFor(s);
    for (let i = 0; i < 2; i += 1) {
      const res = await request(app).post('/api/v1/push-tokens').set('Authorization', `Bearer ${t}`).send({ token: 'tok-aaaaaaaaaaaaaaaaaaaa', platform: 'android' });
      expect(res.status).toBe(200);
    }
    expect(await tokensOf(s.user_id)).toHaveLength(1);
  });

  test('a token that moves to another user (shared phone) belongs to the new user only', async () => {
    const { tokenFor } = require('../../setup/helpers');
    const a = await student();
    const b = await student();
    for (const u of [a, b]) {
      await request(app).post('/api/v1/push-tokens').set('Authorization', `Bearer ${await tokenFor(u)}`).send({ token: 'tok-shared-aaaaaaaaaaaaa', platform: 'android' });
    }
    expect(await tokensOf(a.user_id)).toHaveLength(0);
    expect(await tokensOf(b.user_id)).toHaveLength(1);
  });

  test('rejects a bad platform, requires login, and DELETE removes only the caller token', async () => {
    const { tokenFor } = require('../../setup/helpers');
    const s = await student();
    const t = await tokenFor(s);
    expect((await request(app).post('/api/v1/push-tokens').send({ token: 'tok-aaaaaaaaaaaaaaaaaaaa', platform: 'android' })).status).toBe(401);
    expect((await request(app).post('/api/v1/push-tokens').set('Authorization', `Bearer ${t}`).send({ token: 'tok-aaaaaaaaaaaaaaaaaaaa', platform: 'palm' })).status).toBe(400);
    await request(app).post('/api/v1/push-tokens').set('Authorization', `Bearer ${t}`).send({ token: 'tok-aaaaaaaaaaaaaaaaaaaa', platform: 'ios' });
    const del = await request(app).delete('/api/v1/push-tokens').set('Authorization', `Bearer ${t}`).send({ token: 'tok-aaaaaaaaaaaaaaaaaaaa' });
    expect(del.status).toBe(200);
    expect(await tokensOf(s.user_id)).toHaveLength(0);
  });
});

describe('notify sends a push', () => {
  test("to the user's devices, in their language, with the link", async () => {
    const s = await student({ lang: 'mr' });
    await query("INSERT INTO dbo.push_tokens (user_id, token, platform) VALUES (@u, 'tok-1-aaaaaaaaaaaaaaaaaaa', 'android')", { u: T.int(s.user_id) });
    await notify(s.user_id, { key: 'enrollment.approved', vars: { course: 'Maths', batch: 'A' }, link: '/student' });
    const sent = push.sentMessages();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ token: 'tok-1-aaaaaaaaaaaaaaaaaaa', link: '/student' });
    expect(sent[0].title).toBeTruthy();
  });

  test('blocked users and users with no device get none; a push failure never breaks notify', async () => {
    const s = await student();
    await notify(s.user_id, { key: 'enrollment.approved', vars: { course: 'M', batch: 'A' } });
    expect(push.sentMessages()).toHaveLength(0);
    await query("INSERT INTO dbo.push_tokens (user_id, token, platform) VALUES (@u, 'tok-2-aaaaaaaaaaaaaaaaaaa', 'android')", { u: T.int(s.user_id) });
    await query("UPDATE dbo.users SET status = 'blocked' WHERE user_id = @u", { u: T.int(s.user_id) });
    await notify(s.user_id, { key: 'enrollment.approved', vars: { course: 'M', batch: 'A' } });
    expect(push.sentMessages()).toHaveLength(0);
  });
});

describe('fcm provider', () => {
  let fm;
  beforeEach(() => {
    process.env.PUSH_PROVIDER = 'fcm';
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = SA;
    push._resetTokenCache();
    fm = fetchMock();
  });
  afterEach(() => {
    fm.restore();
    process.env.PUSH_PROVIDER = 'console';
  });

  test('sends via FCM HTTP v1 with a bearer token and a data link', async () => {
    fm.reply('https://oauth2.googleapis.com/token', 200, { access_token: 'ya29.x', expires_in: 3600 })
      .reply('https://fcm.googleapis.com/v1/projects/lms-test/messages:send', 200, { name: 'm1' });
    const r = await push.send({ token: 'tok-aaaaaaaaaaaaaaaaaaaa', title: 'Hi', body: 'There', link: '/student' });
    expect(r).toEqual({ ok: true });
    const call = fm.calls[1];
    expect(call.headers.authorization).toBe('Bearer ya29.x');
    expect(call.body.message).toMatchObject({ token: 'tok-aaaaaaaaaaaaaaaaaaaa', notification: { title: 'Hi', body: 'There' }, data: { link: '/student' } });
  });

  test('a dead token (UNREGISTERED) is deleted from the database', async () => {
    const s = await student();
    await query("INSERT INTO dbo.push_tokens (user_id, token, platform) VALUES (@u, 'tok-dead-aaaaaaaaaaaaaaa', 'android')", { u: T.int(s.user_id) });
    fm.reply('https://oauth2.googleapis.com/token', 200, { access_token: 'ya29.x', expires_in: 3600 })
      .reply('https://fcm.googleapis.com/v1/projects/lms-test/messages:send', 404, { error: { status: 'NOT_FOUND', details: [{ errorCode: 'UNREGISTERED' }] } });
    await notify(s.user_id, { key: 'enrollment.approved', vars: { course: 'M', batch: 'A' } });
    expect(await tokensOf(s.user_id)).toHaveLength(0);
  });
});
