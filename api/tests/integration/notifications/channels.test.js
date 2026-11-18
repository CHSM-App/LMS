const fs = require('fs');
const path = require('path');
const { reset, closeAll, request, app, sendOtp, clock } = require('../../setup/helpers');
const { teacher, readyCourse } = require('../../setup/content');
const { student, activeEnrollment, query, one, T } = require('../../setup/operations');
const whatsapp = require('../../../src/providers/whatsapp');
const otpProvider = require('../../../src/providers/otp/console');
const { notify } = require('../../../src/services/notification.service');
const { MESSAGES: M } = require('../../../src/i18n/messages');

beforeEach(async () => {
  await reset();
  whatsapp.clearSent();
  process.env.MEET_PROVIDER = 'console';
});
afterAll(closeAll);

const inbox = (userId) => query('SELECT title, message, link FROM dbo.notifications WHERE user_id = @u ORDER BY notification_id', { u: T.int(userId) });

describe('event matrix: every notification key is translated', () => {
  // Scan the services for notify keys so a new event can't ship without en/mr/hi text.
  const dir = path.join(__dirname, '../../../src/services');
  const keys = new Set();
  for (const f of fs.readdirSync(dir)) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    for (const m of src.matchAll(/[kK]ey: '([a-zA-Z_]+\.[a-zA-Z_.]+)'/g)) keys.add(m[1]);
  }
  const expected = ['teacherRequest.new', 'teacherRequest.accepted', 'account.blocked', 'subscription.set', 'subscription.expiring', 'enrollment.new',
    'enrollment.approved', 'enrollment.rejected', 'batch.changed', 'liveClass.new', 'liveClass.reminder', 'doubt.answered', 'exam.published', 'mobile.changed', 'demo.new'];
  test.each(expected)('%s is sent somewhere in the services', (k) => expect(keys.has(k)).toBe(true));
  test.each([...keys].filter((k) => !k.startsWith('wa.')))('%s has a title and body in en, mr and hi', (k) => {
    for (const lang of ['en', 'mr', 'hi']) {
      expect(M[lang][`${k}.title`]).toBeTruthy();
      expect(M[lang][`${k}.body`]).toBeTruthy();
    }
  });
  test('every WhatsApp text exists in en, mr and hi', () => {
    const wa = Object.keys(M.en).filter((k) => k.startsWith('wa.'));
    expect(wa).toEqual(expect.arrayContaining(['wa.liveClass', 'wa.subscriptionReminder', 'wa.enrollmentApproved', 'wa.demo_scheduled']));
    for (const k of wa) for (const lang of ['mr', 'hi']) expect(M[lang][k]).toBeTruthy();
  });
});

describe('notify channels', () => {
  const payload = {
    key: 'enrollment.approved',
    vars: { course: 'Maths', batch: 'Morning' },
    link: '/student',
    whatsapp: { key: 'wa.enrollmentApproved', template: 'enrollment_approved' },
  };

  test("in-app message is written in the user's preferred language", async () => {
    const s = await student({ lang: 'mr' });
    await notify(s.user_id, payload);
    const [n] = await inbox(s.user_id);
    expect(n.title).toBe(M.mr['enrollment.approved.title']);
    expect(n.link).toBe('/student');
  });

  test('WhatsApp goes only to users who opted in, in their language', async () => {
    const yes = await student({ whatsappOptIn: true, lang: 'hi' });
    const no = await student({ whatsappOptIn: false });
    expect(await notify(yes.user_id, payload)).toEqual({ whatsapp: 'sent' });
    expect(await notify(no.user_id, payload)).toEqual({ whatsapp: 'skipped' });
    expect(whatsapp.sentMessages()).toHaveLength(1);
    expect(whatsapp.sentMessages()[0]).toMatchObject({ mobile: yes.mobile, template: 'enrollment_approved', lang: 'hi' });
    expect(whatsapp.sentMessages()[0].text).toContain('Maths');
    expect(await inbox(no.user_id)).toHaveLength(1);
  });

  test('a blocked user gets the in-app message but no WhatsApp', async () => {
    const s = await student({ whatsappOptIn: true, status: 'blocked' });
    expect(await notify(s.user_id, payload)).toEqual({ whatsapp: 'skipped' });
    expect(whatsapp.sentMessages()).toHaveLength(0);
    expect(await inbox(s.user_id)).toHaveLength(1);
  });

  test('a WhatsApp outage never loses the in-app message', async () => {
    const s = await student({ whatsappOptIn: true });
    const spy = jest.spyOn(whatsapp, 'send').mockRejectedValueOnce(new Error('down'));
    expect(await notify(s.user_id, payload)).toEqual({ whatsapp: 'failed' });
    spy.mockRestore();
    expect(await inbox(s.user_id)).toHaveLength(1);
  });

  test('inside a transaction, WhatsApp waits for the commit and is dropped on rollback', async () => {
    const { withTransaction } = require('../../../src/db/tx');
    const s = await student({ whatsappOptIn: true });
    await expect(withTransaction(async (tx) => {
      await notify(s.user_id, payload, tx);
      expect(whatsapp.sentMessages()).toHaveLength(0);
      throw new Error('rollback');
    })).rejects.toThrow('rollback');
    expect(whatsapp.sentMessages()).toHaveLength(0);
    await withTransaction((tx) => notify(s.user_id, payload, tx));
    expect(whatsapp.sentMessages()).toHaveLength(1);
  });
});

describe('events that carry a Meet link over WhatsApp', () => {
  async function setup() {
    const t = await teacher({ name: 'Suresh' });
    const c = await readyCourse(t);
    const morning = (await t.post(`/api/v1/teacher/courses/${c.courseId}/batches`, { name: 'Morning', startDate: '2026-01-01' })).body.data;
    const evening = (await t.post(`/api/v1/teacher/courses/${c.courseId}/batches`, { name: 'Evening', startDate: '2026-01-01' })).body.data;
    const inBatch = await student({ whatsappOptIn: true });
    const otherBatch = await student({ whatsappOptIn: true });
    const blocked = await student({ whatsappOptIn: true, status: 'blocked' });
    await activeEnrollment(c.courseId, t.user.user_id, inBatch.user_id, morning.id);
    await activeEnrollment(c.courseId, t.user.user_id, otherBatch.user_id, evening.id);
    await activeEnrollment(c.courseId, t.user.user_id, blocked.user_id, morning.id);
    return { t, ...c, morning, inBatch, otherBatch, blocked };
  }

  test('a new batch-targeted live class sends the app link (not the Meet link) to that batch only, never to blocked students', async () => {
    const { t, courseId, morning, inBatch, otherBatch, blocked } = await setup();
    const lc = await t.post('/api/v1/teacher/live-classes', { courseId, batchId: morning.id, topic: 'Algebra', startsAt: '2099-06-15T03:20:00Z', durationMin: 60 });
    expect(lc.status).toBe(201);
    const sent = whatsapp.sentMessages();
    expect(sent.map((m) => m.mobile)).toEqual([inBatch.mobile]);
    expect(sent[0].text).not.toContain(lc.body.data.meetLink);
    expect(sent[0].text).toContain(`${require('../../../src/config/env').config.webOrigin}/student/live-classes`);
    expect(sent[0].template).toBe('live_class');
    expect(await inbox(blocked.user_id)).toHaveLength(1);
    expect(await inbox(otherBatch.user_id)).toHaveLength(0);
  });

  test('the 30-minute reminder also skips blocked students and has no Meet link', async () => {
    const { t, courseId, morning, inBatch } = await setup();
    const lc = await t.post('/api/v1/teacher/live-classes', { courseId, batchId: morning.id, topic: 'Algebra', startsAt: '2099-06-15T03:20:00Z', durationMin: 60 });
    whatsapp.clearSent();
    clock.set(new Date('2099-06-15T03:00:00Z'));
    try {
      const { runLiveClassReminders } = require('../../../src/services/liveClass.service');
      expect(await runLiveClassReminders()).toBe(1);
    } finally {
      clock.reset();
    }
    expect(whatsapp.sentMessages().map((m) => m.mobile)).toEqual([inBatch.mobile]);
    expect(whatsapp.sentMessages()[0].text).not.toContain(lc.body.data.meetLink);
  });
});

describe('OTP provider outage', () => {
  test('returns 503, creates nothing, and failed sends do not count toward the resend limit', async () => {
    const mobile = '+919812300001';
    const spy = jest.spyOn(otpProvider, 'send').mockRejectedValue(new Error('provider down'));
    for (let i = 0; i < 4; i += 1) {
      const r = await request(app).post('/api/v1/auth/otp/send').send({ mobile, purpose: 'student_register' });
      expect(r.status).toBe(503);
      expect(r.body.error).toBe("Couldn't send OTP. Try again shortly");
    }
    spy.mockRestore();
    const ok = await sendOtp(mobile, 'student_register');
    expect(ok).toMatch(/^[0-9]{6}$/);
    const row = await one('SELECT COUNT(*) AS n FROM dbo.users WHERE mobile = @m', { m: T.varchar(mobile, 20) });
    expect(row.n).toBe(0);
  });
});
