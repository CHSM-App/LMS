const { app, request, reset, closeAll, clock } = require('../../setup/helpers');
const { world, asStudent, query, one, T } = require('../../setup/student');
const { liveLessonBody, uploadVideo } = require('../../setup/content');
const { student, activeEnrollment } = require('../../setup/operations');

beforeEach(async () => {
  await reset();
  clock.set(new Date('2026-06-15T10:00:00Z'));
  process.env.MEET_PROVIDER = 'console';
});
afterAll(async () => {
  clock.reset();
  await closeAll();
});

const START = '2026-06-15T12:30:00Z'; // lesson runs 12:30–13:30 UTC, join from 12:20
const MEET = 'https://meet.google.com/abc-defg-hij';

async function withLive(over = {}) {
  const w = await world();
  const r = await w.t.post(`/api/v1/teacher/modules/${w.moduleId}/contents`, liveLessonBody({ startsAt: START, ...over }));
  expect(r.status).toBe(201);
  return { ...w, live: r.body.data };
}

const lessonIn = (view, id) => view.body.data.subjects.flatMap((s) => s.modules).flatMap((m) => m.contents).find((x) => x.id === id);
const keysOf = (v) => (Array.isArray(v) ? v.flatMap(keysOf) : v && typeof v === 'object' ? Object.entries(v).flatMap(([k, x]) => [k, ...keysOf(x)]) : []);

test('course view shows the live lesson as upcoming without a Meet link', async () => {
  const w = await withLive();
  const view = await w.s.get(`/api/v1/student/courses/${w.courseId}`);
  const x = lessonIn(view, w.live.id);
  expect(x).toMatchObject({ type: 'live', downloadable: false, live: { stage: 'upcoming', durationMin: 60 } });
  expect(new Date(x.live.startsAt).toISOString()).toBe('2026-06-15T12:30:00.000Z');
  expect(JSON.stringify(view.body)).not.toContain(MEET);
});

test('content view has the Meet link only during the join window', async () => {
  const w = await withLive();
  const early = await w.s.get(`/api/v1/student/contents/${w.live.id}`);
  expect(early.body.data).toMatchObject({ type: 'live', live: { stage: 'upcoming' }, url: null });
  expect(JSON.stringify(early.body)).not.toContain(MEET);
  clock.set(new Date('2026-06-15T12:25:00Z'));
  const during = await w.s.get(`/api/v1/student/contents/${w.live.id}`);
  expect(during.body.data.live).toMatchObject({ stage: 'live', meetLink: MEET });
  clock.set(new Date('2026-06-15T13:31:00Z'));
  const after = await w.s.get(`/api/v1/student/contents/${w.live.id}`);
  expect(after.body.data.live.stage).toBe('ended');
  expect(after.body.data.url).toBeNull();
  expect(JSON.stringify(after.body)).not.toContain(MEET);
});

test("a student of another batch sees the lesson only as 'Schedule coming soon', with nothing of the other batch", async () => {
  const w = await world();
  const evening = (await w.t.post(`/api/v1/teacher/courses/${w.courseId}/batches`, { name: 'Evening', startDate: '2026-01-01' })).body.data;
  const r = await w.t.post(`/api/v1/teacher/modules/${w.moduleId}/contents`, liveLessonBody({ startsAt: START, batchId: evening.id }));
  const view = await w.s.get(`/api/v1/student/courses/${w.courseId}`);
  expect(lessonIn(view, r.body.data.id)).toMatchObject({ type: 'live', videoSource: null, downloadable: false, live: { stage: 'unscheduled', startsAt: null } });
  const cv = await w.s.get(`/api/v1/student/contents/${r.body.data.id}`);
  expect(cv.status).toBe(200);
  expect(cv.body.data).toMatchObject({ url: null, videoSource: null, downloadable: false, canComplete: false, live: { stage: 'unscheduled', startsAt: null, liveClassId: null } });
  expect(JSON.stringify(cv.body)).not.toContain(MEET);
  expect((await w.s.post(`/api/v1/student/contents/${r.body.data.id}/progress`, { completed: true })).status).toBe(404);
  const dash = await w.s.get('/api/v1/student/dashboard');
  expect(dash.body.data.myCourses[0].progressPct).toBe(0);
  // A student of the evening batch does see it.
  const e = await student({ name: 'Evening kid' });
  await activeEnrollment(w.courseId, w.t.user.user_id, e.user_id, evening.id);
  const es = await asStudent(e);
  expect(lessonIn(await es.get(`/api/v1/student/courses/${w.courseId}`), r.body.data.id)).toBeDefined();
});

test('cancelled lesson shows stage cancelled and no Meet link, and still counts for progress', async () => {
  const w = await withLive();
  await query("UPDATE dbo.live_classes SET status = 'cancelled'");
  clock.set(new Date('2026-06-15T12:25:00Z'));
  const v = await w.s.get(`/api/v1/student/contents/${w.live.id}`);
  expect(v.body.data.live.stage).toBe('cancelled');
  expect(v.body.data.live.meetLink).toBeUndefined();
  const total = (await one('SELECT COUNT(*) n FROM dbo.contents WHERE course_id = @c', { c: T.int(w.courseId) })).n;
  const first = w.contents[0].content_id;
  await w.s.post(`/api/v1/student/contents/${first}/progress`, { completed: true });
  const view = await w.s.get(`/api/v1/student/courses/${w.courseId}`);
  expect(view.body.data.progressPct).toBe(Math.round(100 / total));
});

test('recorded lesson plays the recording; uploaded is downloadable, YouTube is online only', async () => {
  const w = await withLive();
  const key = await uploadVideo(w.t);
  await w.t.put(`/api/v1/teacher/contents/${w.live.id}/recording`, { videoSource: 'upload', fileKey: key });
  const v = await w.s.get(`/api/v1/student/contents/${w.live.id}`);
  expect(v.body.data).toMatchObject({ videoSource: 'upload', downloadable: true, live: { stage: 'recorded' } });
  expect(v.body.data.url).toMatch(/\?exp=\d+&sig=/);
  expect(v.body.data.live.meetLink).toBeUndefined();
  expect(lessonIn(await w.s.get(`/api/v1/student/courses/${w.courseId}`), w.live.id).downloadable).toBe(true);

  await w.s.post('/api/v1/student/devices', { deviceId: 'device-aaaa-1111', deviceName: 'Redmi', platform: 'android' });
  const dl = (id) => request(app).post(`/api/v1/student/contents/${id}/download`).set('Authorization', `Bearer ${w.s.token}`).set('X-Device-Id', 'device-aaaa-1111').send({});
  expect((await dl(w.live.id)).status).toBe(200);

  await w.t.put(`/api/v1/teacher/contents/${w.live.id}/recording`, { videoSource: 'youtube', url: 'https://youtu.be/abcdefgh123' });
  const yt = await dl(w.live.id);
  expect(yt.status).toBe(409);
  expect(yt.body.code).toBe('ONLINE_ONLY');
});

test('a live lesson without a recording cannot be downloaded', async () => {
  const w = await withLive();
  await w.s.post('/api/v1/student/devices', { deviceId: 'device-aaaa-1111', deviceName: 'Redmi', platform: 'android' });
  const r = await request(app).post(`/api/v1/student/contents/${w.live.id}/download`)
    .set('Authorization', `Bearer ${w.s.token}`).set('X-Device-Id', 'device-aaaa-1111').send({});
  expect(r.status).toBe(409);
});

test('a live lesson can be marked complete only after it has ended', async () => {
  const w = await withLive();
  const tryComplete = () => w.s.post(`/api/v1/student/contents/${w.live.id}/progress`, { completed: true });

  expect((await w.s.get(`/api/v1/student/contents/${w.live.id}`)).body.data.canComplete).toBe(false);
  const early = await tryComplete();
  expect(early.status).toBe(409);
  expect(early.body.code).toBe('LIVE_NOT_FINISHED');

  clock.set(new Date('2026-06-15T12:45:00Z')); // class is live
  expect((await w.s.get(`/api/v1/student/contents/${w.live.id}`)).body.data.canComplete).toBe(false);
  expect((await tryComplete()).status).toBe(409);

  clock.set(new Date('2026-06-15T13:31:00Z')); // ended
  expect((await w.s.get(`/api/v1/student/contents/${w.live.id}`)).body.data.canComplete).toBe(true);
  expect((await tryComplete()).status).toBe(200);
  expect((await w.s.get(`/api/v1/student/contents/${w.live.id}`)).body.data.completed).toBe(true);
});

test('a live lesson the teacher marked completed can be completed before its end time', async () => {
  const w = await withLive();
  clock.set(new Date('2026-06-15T12:45:00Z'));
  await query("UPDATE dbo.live_classes SET status = 'completed' WHERE live_class_id = (SELECT live_class_id FROM dbo.contents WHERE content_id = @c)", { c: T.int(w.live.id) });
  expect((await w.s.post(`/api/v1/student/contents/${w.live.id}/progress`, { completed: true })).status).toBe(200);
});

test('offline sync does not complete a live lesson that has not ended', async () => {
  const w = await withLive();
  await w.s.post('/api/v1/student/progress/sync', { items: [{ contentId: w.live.id, completedAt: '2026-06-15T09:00:00Z' }] });
  expect((await w.s.get(`/api/v1/student/contents/${w.live.id}`)).body.data.completed).toBe(false);
});

test('other lessons can always be completed', async () => {
  const w = await withLive();
  const view = await w.s.get(`/api/v1/student/courses/${w.courseId}`);
  const other = view.body.data.subjects.flatMap((s) => s.modules).flatMap((m) => m.contents).find((x) => x.type !== 'live');
  expect((await w.s.get(`/api/v1/student/contents/${other.id}`)).body.data.canComplete).toBe(true);
  expect((await w.s.post(`/api/v1/student/contents/${other.id}/progress`, { completed: true })).status).toBe(200);
});

test('live classes list and dashboard give Join and the Meet link only from 10 minutes before until the end', async () => {
  const w = await withLive();
  const listed = async () => (await w.s.get('/api/v1/student/live-classes')).body.data.find((x) => x.contentId === w.live.id);
  const onDash = async () => (await w.s.get('/api/v1/student/dashboard')).body.data.upcomingLiveClasses.find((x) => x.contentId === w.live.id);

  for (const item of [await listed(), await onDash()]) {
    expect(item).toMatchObject({ stage: 'upcoming', canJoin: false });
    expect(item.meetLink).toBeUndefined();
  }
  clock.set(new Date('2026-06-15T12:20:00Z'));
  for (const item of [await listed(), await onDash()]) expect(item).toMatchObject({ stage: 'live', canJoin: true, meetLink: MEET });
});

test('student live classes list links live lessons to their content', async () => {
  const w = await withLive();
  const list = await w.s.get('/api/v1/student/live-classes');
  expect(list.body.data[0]).toMatchObject({ contentId: w.live.id, courseId: w.courseId });
});

test('public course details list the live lesson title and type with no link', async () => {
  const w = await withLive();
  await w.t.put(`/api/v1/teacher/contents/${w.live.id}/recording`, { videoSource: 'youtube', url: 'https://youtu.be/zzzzzzzz999' });
  // Even if the flag were set by hand, a live lesson never gets a public link.
  await query('UPDATE dbo.contents SET is_free_preview = 1 WHERE content_id = @id', { id: T.int(w.live.id) });
  const d = await request(app).get(`/api/v1/public/courses/${w.slug}`);
  expect(d.status).toBe(200);
  const lessons = d.body.data.curriculum.flatMap((s) => s.modules).flatMap((m) => m.contents);
  expect(lessons.find((x) => x.type === 'live')).toEqual({ title: 'Live: factorisation', type: 'live', isFreePreview: false });
  expect(JSON.stringify(d.body)).not.toContain('zzzzzzzz999');
  expect(JSON.stringify(d.body)).not.toContain(MEET);
  expect(keysOf(d.body)).not.toContain('live');
});

test("an offline licence stops renewing once the uploaded recording is removed", async () => {
  const w = await withLive();
  const key = await uploadVideo(w.t);
  await w.t.put(`/api/v1/teacher/contents/${w.live.id}/recording`, { videoSource: "upload", fileKey: key });
  await w.s.post("/api/v1/student/devices", { deviceId: "device-aaaa-1111", deviceName: "Redmi", platform: "android" });
  const dl = await request(app).post(`/api/v1/student/contents/${w.live.id}/download`)
    .set("Authorization", `Bearer ${w.s.token}`).set("X-Device-Id", "device-aaaa-1111").send({});
  expect(dl.status).toBe(200);
  await w.t.put(`/api/v1/teacher/contents/${w.live.id}/recording`, { videoSource: "youtube", url: "https://youtu.be/abcdefgh123" });
  const renew = await w.s.post("/api/v1/student/downloads/renew", { deviceId: "device-aaaa-1111", contentIds: [w.live.id] });
  expect(renew.body.data[0]).toEqual({ contentId: w.live.id, revoked: true, reason: "content_removed" });
});

test("an offline licence stops renewing when the student moves to a batch the lesson is not for", async () => {
  const w = await world();
  const r = await w.t.post(`/api/v1/teacher/modules/${w.moduleId}/contents`, liveLessonBody({ startsAt: START, batchId: w.batch.id }));
  const key = await uploadVideo(w.t);
  await w.t.put(`/api/v1/teacher/contents/${r.body.data.id}/recording`, { videoSource: "upload", fileKey: key });
  await w.s.post("/api/v1/student/devices", { deviceId: "device-aaaa-1111", deviceName: "Redmi", platform: "android" });
  const dl = await request(app).post(`/api/v1/student/contents/${r.body.data.id}/download`)
    .set("Authorization", `Bearer ${w.s.token}`).set("X-Device-Id", "device-aaaa-1111").send({});
  expect(dl.status).toBe(200);
  const evening = (await w.t.post(`/api/v1/teacher/courses/${w.courseId}/batches`, { name: "Evening", startDate: "2026-01-01" })).body.data;
  await query("UPDATE dbo.enrollments SET batch_id = @b WHERE course_id = @c", { b: T.int(evening.id), c: T.int(w.courseId) });
  const renew = await w.s.post("/api/v1/student/downloads/renew", { deviceId: "device-aaaa-1111", contentIds: [r.body.data.id] });
  expect(renew.body.data[0]).toEqual({ contentId: r.body.data.id, revoked: true, reason: "content_removed" });
});

describe('one lesson, a session per batch: batches never see each other', () => {
  const B_START = '2026-06-16T12:30:00Z';
  const liveIds = (view) => view.body.data.subjects.flatMap((s) => s.modules).flatMap((m) => m.contents).filter((x) => x.type === 'live').map((x) => x.id);

  async function twoBatches() {
    const w = await world();
    const evening = (await w.t.post(`/api/v1/teacher/courses/${w.courseId}/batches`, { name: 'Evening', startDate: '2026-01-01' })).body.data;
    const a = (await w.t.post(`/api/v1/teacher/modules/${w.moduleId}/contents`, liveLessonBody({ startsAt: START, batchId: w.batch.id }))).body.data;
    const bSession = (await w.t.post(`/api/v1/teacher/contents/${a.id}/sessions`, { batchId: evening.id, startsAt: B_START, meetLink: MEET })).body.data;
    const e = await student({ name: 'Evening kid' });
    await activeEnrollment(w.courseId, w.t.user.user_id, e.user_id, evening.id);
    return { ...w, evening, a, bId: bSession.contentId, es: await asStudent(e) };
  }

  test('each batch sees only its own session of the lesson, in the same module', async () => {
    const w = await twoBatches();
    expect(liveIds(await w.s.get(`/api/v1/student/courses/${w.courseId}`))).toEqual([w.a.id]);
    expect(liveIds(await w.es.get(`/api/v1/student/courses/${w.courseId}`))).toEqual([w.bId]);
    expect((await w.es.get(`/api/v1/student/contents/${w.a.id}`)).status).toBe(404);
    expect((await w.s.get(`/api/v1/student/contents/${w.bId}`)).status).toBe(404);
  });

  test("the evening batch does not get the morning batch's recording, before or after its own class", async () => {
    const w = await twoBatches();
    const key = await uploadVideo(w.t);
    await w.t.put(`/api/v1/teacher/contents/${w.a.id}/recording`, { videoSource: 'upload', fileKey: key });
    clock.set(new Date('2026-06-15T14:00:00Z')); // morning class is over, evening is tomorrow
    const morning = await w.s.get(`/api/v1/student/contents/${w.a.id}`);
    expect(morning.body.data).toMatchObject({ live: { stage: 'recorded' } });
    expect(morning.body.data.url).toBeTruthy();
    const evening = await w.es.get(`/api/v1/student/contents/${w.bId}`);
    expect(evening.body.data).toMatchObject({ live: { stage: 'upcoming' }, url: null });
    expect(JSON.stringify(evening.body)).not.toContain(MEET);
    clock.set(new Date('2026-06-16T14:00:00Z')); // evening class is over, still no recording of its own
    const after = await w.es.get(`/api/v1/student/contents/${w.bId}`);
    expect(after.body.data).toMatchObject({ live: { stage: 'ended' }, url: null });
    const eKey = await uploadVideo(w.t);
    await w.t.put(`/api/v1/teacher/contents/${w.bId}/recording`, { videoSource: 'upload', fileKey: eKey });
    const own = await w.es.get(`/api/v1/student/contents/${w.bId}`);
    expect(own.body.data).toMatchObject({ live: { stage: 'recorded' } });
    expect(own.body.data.url).toBeTruthy();
    expect(own.body.data.url).not.toBe(morning.body.data.url);
  });

  test('the morning recording cannot be downloaded or renewed by the evening student', async () => {
    const w = await twoBatches();
    const key = await uploadVideo(w.t);
    await w.t.put(`/api/v1/teacher/contents/${w.a.id}/recording`, { videoSource: 'upload', fileKey: key });
    await w.es.post('/api/v1/student/devices', { deviceId: 'device-bbbb-2222', deviceName: 'Redmi', platform: 'android' });
    const dl = await request(app).post(`/api/v1/student/contents/${w.a.id}/download`)
      .set('Authorization', `Bearer ${w.es.token}`).set('X-Device-Id', 'device-bbbb-2222').send({});
    expect(dl.status).toBe(404);
  });

  test("a batch's session does not change the other batch's progress numbers", async () => {
    const w = await twoBatches();
    const m = (await w.s.get('/api/v1/student/dashboard')).body.data.myCourses[0];
    const e = (await w.es.get('/api/v1/student/dashboard')).body.data.myCourses[0];
    expect(m.progressPct).toBe(0);
    expect(e.progressPct).toBe(0);
  });
});

describe('a live lesson without a date', () => {
  test('students see Schedule coming soon and cannot complete it', async () => {
    const w = await world();
    const r = await w.t.post(`/api/v1/teacher/modules/${w.moduleId}/contents`, { type: 'live', title: 'Algebra' });
    const x = lessonIn(await w.s.get(`/api/v1/student/courses/${w.courseId}`), r.body.data.id);
    expect(x).toMatchObject({ type: 'live', live: { stage: 'unscheduled' } });
    const cv = await w.s.get(`/api/v1/student/contents/${r.body.data.id}`);
    expect(cv.body.data).toMatchObject({ canComplete: false, url: null, live: { stage: 'unscheduled' } });
  });

  test("after the morning batch is scheduled and recorded, the evening batch still sees only 'coming soon'", async () => {
    const w = await world();
    const evening = (await w.t.post(`/api/v1/teacher/courses/${w.courseId}/batches`, { name: 'Evening', startDate: '2026-01-01' })).body.data;
    const e = await student({ name: 'Evening kid' });
    await activeEnrollment(w.courseId, w.t.user.user_id, e.user_id, evening.id);
    const es = await asStudent(e);
    const r = await w.t.post(`/api/v1/teacher/modules/${w.moduleId}/contents`, { type: 'live', title: 'Algebra' });
    await w.t.post(`/api/v1/teacher/contents/${r.body.data.id}/sessions`, { batchId: w.batch.id, startsAt: START, meetLink: MEET });
    const key = await uploadVideo(w.t);
    await w.t.put(`/api/v1/teacher/contents/${r.body.data.id}/recording`, { videoSource: 'upload', fileKey: key });
    expect(lessonIn(await w.s.get(`/api/v1/student/courses/${w.courseId}`), r.body.data.id).live.stage).toBe('recorded');
    const ev = await es.get(`/api/v1/student/contents/${r.body.data.id}`);
    expect(ev.status).toBe(200);
    expect(ev.body.data).toMatchObject({ url: null, videoSource: null, downloadable: false, live: { stage: 'unscheduled', startsAt: null } });
    expect(JSON.stringify(ev.body)).not.toContain(MEET);
    await es.post('/api/v1/student/devices', { deviceId: 'device-cccc-3333', deviceName: 'Redmi', platform: 'android' });
    const dl = await request(app).post(`/api/v1/student/contents/${r.body.data.id}/download`)
      .set('Authorization', `Bearer ${es.token}`).set('X-Device-Id', 'device-cccc-3333').send({});
    expect(dl.status).toBe(404);
    expect((await es.post(`/api/v1/student/contents/${r.body.data.id}/progress`, { completed: true })).status).toBe(404);
  });
});

test("a 'Schedule coming soon' lesson does not count against progress", async () => {
  const w = await world();
  const evening = (await w.t.post(`/api/v1/teacher/courses/${w.courseId}/batches`, { name: 'Evening', startDate: '2026-01-01' })).body.data;
  await w.t.post(`/api/v1/teacher/modules/${w.moduleId}/contents`, liveLessonBody({ startsAt: START, batchId: evening.id }));
  const view = (await w.s.get(`/api/v1/student/courses/${w.courseId}`)).body.data;
  const own = view.subjects.flatMap((s) => s.modules).flatMap((m) => m.contents).filter((x) => !(x.live && x.live.stage === 'unscheduled'));
  for (const x of own) await w.s.post(`/api/v1/student/contents/${x.id}/progress`, { completed: true });
  expect((await w.s.get(`/api/v1/student/courses/${w.courseId}`)).body.data.progressPct).toBe(100);
  expect((await w.s.get('/api/v1/student/dashboard')).body.data.myCourses[0].progressPct).toBe(100);
});
