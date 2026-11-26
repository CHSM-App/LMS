// The Meet link is optional when scheduling. Only a real Google provider creates one automatically;
// otherwise the class waits for the teacher to add it, and nobody gets a fake link.
const { reset, closeAll, clock } = require('../../setup/helpers');
const { teacher, readyCourse, liveLessonBody } = require('../../setup/content');
const { student, activeEnrollment, one, T } = require('../../setup/operations');
const { asStudent } = require('../../setup/student');
const meet = require('../../../src/providers/meet');
const { runLiveClassReminders } = require('../../../src/services/liveClass.service');

const { query } = require('../../../src/db/query');

const MEET = 'https://meet.google.com/abc-defg-hij';
const withEmail = (t, email = 'Teacher@Gmail.com') => query('UPDATE dbo.users SET email = @e WHERE user_id = @u', { e: T.varchar(email.toLowerCase(), 160), u: T.int(t.user.user_id) });
const START = '2026-06-15T12:30:00Z';

beforeEach(async () => {
  await reset();
  clock.set(new Date('2026-06-15T10:00:00Z'));
  process.env.MEET_PROVIDER = 'console';
});
afterEach(() => jest.restoreAllMocks());
afterAll(async () => {
  clock.reset();
  await closeAll();
});

async function setup() {
  const t = await teacher();
  const c = await readyCourse(t);
  const batch = (await t.post(`/api/v1/teacher/courses/${c.courseId}/batches`, { name: 'Morning', startDate: '2026-01-01' })).body.data;
  const s = await student();
  await activeEnrollment(c.courseId, t.user.user_id, s.user_id, batch.id);
  return { t, ...c, batch, s: await asStudent(s) };
}

const schedule = (t, courseId, over = {}) => t.post('/api/v1/teacher/live-classes', { courseId, topic: 'Algebra', startsAt: START, durationMin: 60, ...over });

test('scheduling without a link saves the class with no link and no fake link', async () => {
  const { t, courseId } = await setup();
  const r = await schedule(t, courseId);
  expect(r.status).toBe(201);
  expect(r.body.data).toMatchObject({ meetLink: null, needsMeetLink: true });
});

test('a pasted link is kept as is', async () => {
  const { t, courseId } = await setup();
  const r = await schedule(t, courseId, { meetLink: MEET });
  expect(r.body.data).toMatchObject({ meetLink: MEET, needsMeetLink: false });
});

test('saving never creates a link by itself, even with the Google provider', async () => {
  const { t, courseId } = await setup();
  process.env.MEET_PROVIDER = 'google';
  const spy = jest.spyOn(meet, 'createLink').mockResolvedValue('https://meet.google.com/xyz-abcd-efg');
  const r = await schedule(t, courseId);
  expect(r.body.data).toMatchObject({ meetLink: null, needsMeetLink: true });
  expect(spy).not.toHaveBeenCalled();
});

describe('Generate link before saving (schedule form)', () => {
  const pre = (t, body) => t.post('/api/v1/teacher/live-classes/meet-link/generate', body);

  test('returns a link and saves nothing', async () => {
    const { t } = await setup();
    await withEmail(t);
    process.env.MEET_PROVIDER = 'google';
    const spy = jest.spyOn(meet, 'createLink').mockResolvedValue('https://meet.google.com/xyz-abcd-efg');
    const r = await pre(t, { topic: 'Algebra', startsAt: START, durationMin: 45 });
    expect(r.status).toBe(200);
    expect(r.body.data).toEqual({ meetLink: 'https://meet.google.com/xyz-abcd-efg' });
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ title: 'Algebra', durationMin: 45, hostEmail: 'teacher@gmail.com' }));
    expect((await t.get('/api/v1/teacher/live-classes')).body.data).toHaveLength(0);
  });

  test('needs a topic and a valid start time', async () => {
    const { t } = await setup();
    process.env.MEET_PROVIDER = 'google';
    jest.spyOn(meet, 'createLink').mockResolvedValue('https://meet.google.com/xyz-abcd-efg');
    expect((await pre(t, { startsAt: START })).status).toBe(400);
    expect((await pre(t, { topic: 'Algebra' })).status).toBe(400);
    expect((await pre(t, { topic: 'Algebra', startsAt: 'nope' })).status).toBe(400);
  });

  test('refuses when automatic links are not set up, and when Google gives none', async () => {
    const { t } = await setup();
    await withEmail(t);
    process.env.MEET_PROVIDER = 'manual';
    const off = await pre(t, { topic: 'Algebra', startsAt: START });
    expect(off.status).toBe(409);
    expect(off.body.code).toBe('MEET_GENERATE_UNAVAILABLE');
    process.env.MEET_PROVIDER = 'google';
    jest.spyOn(meet, 'createLink').mockResolvedValue(null);
    const failed = await pre(t, { topic: 'Algebra', startsAt: START });
    expect(failed.status).toBe(409);
    expect(failed.body.code).toBe('MEET_GENERATE_FAILED');
  });
});

test('the teacher adds the link later; it must be a Meet link; only the owner can', async () => {
  const { t, courseId } = await setup();
  const lc = (await schedule(t, courseId)).body.data;
  const bad = await t.put(`/api/v1/teacher/live-classes/${lc.id}/meet-link`, { meetLink: 'https://zoom.us/j/1' });
  expect(bad.status).toBe(400);
  expect(bad.body.code).toBe('INVALID_MEET_LINK');
  const other = await teacher({ name: 'Other' });
  expect((await other.put(`/api/v1/teacher/live-classes/${lc.id}/meet-link`, { meetLink: MEET })).status).toBe(404);
  const ok = await t.put(`/api/v1/teacher/live-classes/${lc.id}/meet-link`, { meetLink: MEET });
  expect(ok.status).toBe(200);
  expect(ok.body.data).toMatchObject({ meetLink: MEET, needsMeetLink: false });
});

describe('Generate link button', () => {
  const generate = (t, id) => t.post(`/api/v1/teacher/live-classes/${id}/meet-link/generate`);

  test('creates a link with the Google provider and saves it on the class', async () => {
    const { t, courseId } = await setup();
    await withEmail(t);
    const lc = (await schedule(t, courseId)).body.data;
    process.env.MEET_PROVIDER = 'google';
    const spy = jest.spyOn(meet, 'createLink').mockResolvedValue('https://meet.google.com/xyz-abcd-efg');
    const r = await generate(t, lc.id);
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ meetLink: 'https://meet.google.com/xyz-abcd-efg', needsMeetLink: false });
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ title: 'Algebra', durationMin: 60, hostEmail: 'teacher@gmail.com' }));
    const saved = (await t.get('/api/v1/teacher/live-classes')).body.data.find((x) => x.id === lc.id);
    expect(saved.meetLink).toBe('https://meet.google.com/xyz-abcd-efg');
  });

  test('only the owner can generate', async () => {
    const { t, courseId } = await setup();
    await withEmail(t);
    const lc = (await schedule(t, courseId)).body.data;
    process.env.MEET_PROVIDER = 'google';
    jest.spyOn(meet, 'createLink').mockResolvedValue('https://meet.google.com/xyz-abcd-efg');
    expect((await generate(await teacher({ name: 'Other' }), lc.id)).status).toBe(404);
  });

  test('refuses when the class already has a link', async () => {
    const { t, courseId } = await setup();
    const lc = (await schedule(t, courseId, { meetLink: MEET })).body.data;
    process.env.MEET_PROVIDER = 'google';
    const spy = jest.spyOn(meet, 'createLink');
    const r = await generate(t, lc.id);
    expect(r.status).toBe(409);
    expect(r.body.code).toBe('MEET_LINK_EXISTS');
    expect(spy).not.toHaveBeenCalled();
  });

  test('refuses when automatic links are not set up (manual or console provider)', async () => {
    const { t, courseId } = await setup();
    const lc = (await schedule(t, courseId)).body.data;
    process.env.MEET_PROVIDER = 'manual';
    const r = await generate(t, lc.id);
    expect(r.status).toBe(409);
    expect(r.body.code).toBe('MEET_GENERATE_UNAVAILABLE');
  });

  test('needs the Google email of the teacher so the teacher can be co-host', async () => {
    const { t, courseId } = await setup();
    const lc = (await schedule(t, courseId)).body.data;
    process.env.MEET_PROVIDER = 'google';
    const spy = jest.spyOn(meet, 'createLink').mockResolvedValue('https://meet.google.com/xyz-abcd-efg');
    const r = await generate(t, lc.id);
    expect(r.status).toBe(409);
    expect(r.body.code).toBe('MEET_TEACHER_EMAIL_MISSING');
    expect(spy).not.toHaveBeenCalled();
  });

  test('reports a failure when Google gives no link, and leaves the class without one', async () => {
    const { t, courseId } = await setup();
    await withEmail(t);
    const lc = (await schedule(t, courseId)).body.data;
    process.env.MEET_PROVIDER = 'google';
    jest.spyOn(meet, 'createLink').mockResolvedValue(null);
    const r = await generate(t, lc.id);
    expect(r.status).toBe(409);
    expect(r.body.code).toBe('MEET_GENERATE_FAILED');
    const saved = (await t.get('/api/v1/teacher/live-classes')).body.data.find((x) => x.id === lc.id);
    expect(saved.meetLink).toBeNull();
  });
});

test('a live lesson can be created without a link and get one from the live classes page', async () => {
  const { t, moduleId } = await setup();
  const lesson = (await t.post(`/api/v1/teacher/modules/${moduleId}/contents`, liveLessonBody({ startsAt: START, meetLink: null }))).body.data;
  expect(lesson.live.meetLink).toBeNull();
  const lc = (await t.get('/api/v1/teacher/live-classes')).body.data.find((x) => x.id === lesson.live.liveClassId);
  expect(lc.needsMeetLink).toBe(true);
  expect((await t.put(`/api/v1/teacher/live-classes/${lc.id}/meet-link`, { meetLink: MEET })).status).toBe(200);
});

test('at class time without a link students wait; once added they can join', async () => {
  const { t, courseId, s } = await setup();
  const lc = (await schedule(t, courseId)).body.data;
  clock.set(new Date('2026-06-15T12:25:00Z'));
  const before = (await s.get('/api/v1/student/live-classes')).body.data[0];
  expect(before).toMatchObject({ stage: 'live', canJoin: false, waitingForLink: true });
  expect(before.meetLink).toBeUndefined();
  await t.put(`/api/v1/teacher/live-classes/${lc.id}/meet-link`, { meetLink: MEET });
  expect((await s.get('/api/v1/student/live-classes')).body.data[0]).toMatchObject({ canJoin: true, waitingForLink: false, meetLink: MEET });
});

test('the reminder asks the teacher to add a missing link, and only then', async () => {
  const { t, courseId } = await setup();
  await schedule(t, courseId, { topic: 'No link' });
  await schedule(t, courseId, { topic: 'Has link', meetLink: MEET });
  clock.set(new Date('2026-06-15T12:05:00Z')); // 25 min before
  await runLiveClassReminders();
  const asked = await one("SELECT COUNT(*) n, MAX(title) title, MAX(message) message FROM dbo.notifications WHERE user_id = @u", { u: T.int(t.user.user_id) });
  expect(asked.n).toBe(1);
  expect(asked.message).toContain('No link');
});
