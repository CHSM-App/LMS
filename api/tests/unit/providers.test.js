const crypto = require('crypto');
const { fetchMock } = require('../setup/fetchMock');

const ENV = { ...process.env };
let http;
beforeEach(() => {
  http = fetchMock();
});
afterEach(() => {
  http.restore();
  process.env = { ...ENV };
  jest.resetModules();
});

describe('MSG91 OTP', () => {
  test('posts the OTP with the auth key and DLT template id', async () => {
    process.env.MSG91_AUTH_KEY = 'auth-123';
    process.env.MSG91_TEMPLATE_ID = 'tpl-9';
    http.reply('https://control.msg91.com/api/v5/otp', 200, { type: 'success' });
    await require('../../src/providers/otp/msg91').send('+919812345678', '123456', 'login');
    expect(http.calls[0]).toMatchObject({ method: 'POST', headers: { authkey: 'auth-123' }, body: { template_id: 'tpl-9', mobile: '919812345678', otp: '123456' } });
  });

  test('an error reply throws so the API answers 503', async () => {
    const msg91 = require('../../src/providers/otp/msg91');
    http.reply('https://control.msg91.com', 200, { type: 'error', message: 'invalid template' });
    await expect(msg91.send('+919812345678', '123456')).rejects.toThrow('invalid template');
    http.reply('https://control.msg91.com', 500);
    await expect(msg91.send('+919812345678', '123456')).rejects.toThrow('500');
  });
});

describe('WhatsApp Cloud API', () => {
  beforeEach(() => {
    process.env.WHATSAPP_PROVIDER = 'meta';
    process.env.WHATSAPP_TOKEN = 'wa-token';
    process.env.WHATSAPP_PHONE_NUMBER_ID = '555';
  });

  test('sends an approved template with the params in order and the user language', async () => {
    process.env.WHATSAPP_TEMPLATE_LIVE_CLASS = 'lms_live_class_v2';
    http.reply('https://graph.facebook.com/v20.0/555/messages', 200, { messages: [{ id: 'wamid.1' }] });
    await require('../../src/providers/whatsapp').send('+919812345678', 'ignored text', {
      template: 'live_class', lang: 'mr', vars: { topic: 'Algebra', course: 'Maths', date: '2026-06-15', time: '09:00', link: 'https://meet.google.com/abc-defg-hij' },
    });
    expect(http.calls[0].headers.authorization).toBe('Bearer wa-token');
    expect(http.calls[0].body).toEqual({
      messaging_product: 'whatsapp',
      to: '919812345678',
      type: 'template',
      template: {
        name: 'lms_live_class_v2',
        language: { code: 'mr' },
        components: [{ type: 'body', parameters: ['Algebra', 'Maths', '2026-06-15', '09:00', 'https://meet.google.com/abc-defg-hij'].map((text) => ({ type: 'text', text })) }],
      },
    });
  });

  test('the template name defaults to the template key', async () => {
    http.reply('https://graph.facebook.com', 200, {});
    await require('../../src/providers/whatsapp').send('+919812345678', 'x', { template: 'subscription_reminder', lang: 'en', vars: { name: 'Suresh', end: '2026-07-01' } });
    expect(http.calls[0].body.template.name).toBe('subscription_reminder');
    expect(http.calls[0].body.template.components[0].parameters.map((p) => p.text)).toEqual(['Suresh', '2026-07-01']);
  });

  test('an API error throws (callers fall back to the wa.me link)', async () => {
    http.reply('https://graph.facebook.com', 401, { error: { message: 'bad token' } });
    await expect(require('../../src/providers/whatsapp').send('+919812345678', 'x', { template: 'demo_scheduled', vars: {} })).rejects.toThrow('401');
  });
});

describe('Google Meet via Calendar API', () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  beforeEach(() => {
    process.env.MEET_PROVIDER = 'google';
    process.env.GOOGLE_CALENDAR_ID = 'classes@school.example';
    process.env.GOOGLE_IMPERSONATE_USER = 'teacher-bot@school.example';
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({
      client_email: 'lms@project.iam.gserviceaccount.com',
      private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
    });
  });

  test('signs a service-account JWT, creates an event with a Meet conference and returns its link', async () => {
    http.reply('https://oauth2.googleapis.com/token', 200, { access_token: 'g-token', expires_in: 3600 });
    http.reply('https://www.googleapis.com/calendar/v3/calendars/classes%40school.example/events?conferenceDataVersion=1', 200, { hangoutLink: 'https://meet.google.com/xyz-abcd-efg' });

    const meet = require('../../src/providers/meet');
    const link = await meet.createLink({ title: 'Algebra', start: new Date('2026-06-15T03:30:00Z'), durationMin: 60 });
    expect(link).toBe('https://meet.google.com/xyz-abcd-efg');

    const [token, event] = http.calls;
    expect(token.body.grant_type).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer');
    const [h, p, s] = token.body.assertion.split('.');
    expect(crypto.verify('RSA-SHA256', Buffer.from(`${h}.${p}`), publicKey, Buffer.from(s, 'base64url'))).toBe(true);
    expect(JSON.parse(Buffer.from(p, 'base64url').toString())).toMatchObject({
      iss: 'lms@project.iam.gserviceaccount.com', sub: 'teacher-bot@school.example', aud: 'https://oauth2.googleapis.com/token', scope: 'https://www.googleapis.com/auth/calendar.events',
    });
    expect(event.headers.authorization).toBe('Bearer g-token');
    expect(event.body.summary).toBe('Algebra');
    expect(event.body.start.dateTime).toBe('2026-06-15T03:30:00.000Z');
    expect(event.body.end.dateTime).toBe('2026-06-15T04:30:00.000Z');
    expect(event.body.conferenceData.createRequest.conferenceSolutionKey.type).toBe('hangoutsMeet');
  });

  test('the access token is reused until it expires', async () => {
    http.reply('https://oauth2.googleapis.com/token', 200, { access_token: 'g-token', expires_in: 3600 });
    http.reply('https://www.googleapis.com/calendar', 200, { hangoutLink: 'https://meet.google.com/aaa-bbbb-ccc' });
    http.reply('https://www.googleapis.com/calendar', 200, { hangoutLink: 'https://meet.google.com/ddd-eeee-fff' });
    const meet = require('../../src/providers/meet');
    await meet.createLink({ title: 'A', start: new Date(), durationMin: 30 });
    await meet.createLink({ title: 'B', start: new Date(), durationMin: 30 });
    expect(http.calls.filter((c) => c.url.includes('oauth2'))).toHaveLength(1);
  });

  test('a Google outage returns null so the teacher can paste a link instead', async () => {
    http.reply('https://oauth2.googleapis.com/token', 503);
    const meet = require('../../src/providers/meet');
    await expect(meet.createLink({ title: 'Algebra', start: new Date(), durationMin: 30 })).resolves.toBeNull();
  });
});

describe('Google Meet via Calendar API with an OAuth refresh token (no service account)', () => {
  beforeEach(() => {
    process.env.MEET_PROVIDER = 'google';
    process.env.GOOGLE_CALENDAR_ID = 'primary';
    process.env.GOOGLE_CLIENT_ID = 'client-1.apps.googleusercontent.com';
    process.env.GOOGLE_CLIENT_SECRET = 'secret-1';
    process.env.GOOGLE_REFRESH_TOKEN = '1//refresh-1';
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    delete process.env.GOOGLE_IMPERSONATE_USER;
  });

  test('swaps the refresh token for an access token and creates the Meet link on that calendar', async () => {
    http.reply('https://oauth2.googleapis.com/token', 200, { access_token: 'u-token', expires_in: 3600 });
    http.reply('https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1', 200, { hangoutLink: 'https://meet.google.com/xyz-abcd-efg' });

    const meet = require('../../src/providers/meet');
    const link = await meet.createLink({ title: 'Algebra', start: new Date('2026-06-15T03:30:00Z'), durationMin: 60 });
    expect(link).toBe('https://meet.google.com/xyz-abcd-efg');

    const [token, event] = http.calls;
    expect(token.body).toMatchObject({
      grant_type: 'refresh_token', refresh_token: '1//refresh-1', client_id: 'client-1.apps.googleusercontent.com', client_secret: 'secret-1',
    });
    expect(event.headers.authorization).toBe('Bearer u-token');
  });

  test('a revoked refresh token returns null so the teacher can paste a link instead', async () => {
    http.reply('https://oauth2.googleapis.com/token', 400, { error: 'invalid_grant' });
    const meet = require('../../src/providers/meet');
    await expect(meet.createLink({ title: 'Algebra', start: new Date(), durationMin: 30 })).resolves.toBeNull();
  });

  test('without a refresh token or a service account no link is made', async () => {
    delete process.env.GOOGLE_REFRESH_TOKEN;
    const meet = require('../../src/providers/meet');
    await expect(meet.createLink({ title: 'Algebra', start: new Date(), durationMin: 30 })).resolves.toBeNull();
    expect(http.calls).toHaveLength(0);
  });
});
