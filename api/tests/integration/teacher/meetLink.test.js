// The Meet link is optional when scheduling. Only a real Google provider creates one automatically;
// otherwise the class waits for the teacher to add it, and nobody gets a fake link.
const { reset, closeAll, clock } = require('../../setup/helpers');
const { teacher, readyCourse, liveLessonBody } = require('../../setup/content');
const { student, activeEnrollment, one, T } = require('../../setup/operations');
const { asStudent } = require('../../setup/student');
const meet = require('../../../src/providers/meet');
const { runLiveClassReminders } = require('../../../src/services/liveClass.service');

const MEET = 'https://meet.google.com/abc-defg-hij';
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

test('the Google provider creates a real link automatically', async () => {
  const { t, courseId } = await setup();
  process.env.MEET_PROVIDER = 'google';
  jest.spyOn(meet, 'createLink').mockResolvedValue('https://meet.google.com/xyz-abcd-efg');
  const r = await schedule(t, courseId);
  expect(r.body.data).toMatchObject({ meetLink: 'https://meet.google.com/xyz-abcd-efg', needsMeetLink: false });
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
