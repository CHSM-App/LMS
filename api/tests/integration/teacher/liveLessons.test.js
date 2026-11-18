const { reset, closeAll, clock } = require('../../setup/helpers');
const { teacher, readyCourse, uploadVideo, liveLessonBody } = require('../../setup/content');
const { student, activeEnrollment, query, one, T } = require('../../setup/operations');
const whatsapp = require('../../../src/providers/whatsapp');
const { runLiveClassReminders } = require('../../../src/services/liveClass.service');

beforeEach(async () => {
  await reset();
  clock.reset();
  whatsapp.clearSent();
  process.env.MEET_PROVIDER = 'console';
});
afterAll(async () => {
  clock.reset();
  await closeAll();
});

async function setup() {
  const t = await teacher({ name: 'Suresh' });
  const c = await readyCourse(t);
  const batch = (await t.post(`/api/v1/teacher/courses/${c.courseId}/batches`, { name: 'Morning', startDate: '2026-01-01' })).body.data;
  return { t, ...c, batch };
}

const addLive = (t, moduleId, over) => t.post(`/api/v1/teacher/modules/${moduleId}/contents`, liveLessonBody(over));
const countNotes = async (userId) => (await one('SELECT COUNT(*) n FROM dbo.notifications WHERE user_id = @u', { u: T.int(userId) })).n;
const counts = () => one("SELECT (SELECT COUNT(*) FROM dbo.contents WHERE type = 'live') c, (SELECT COUNT(*) FROM dbo.live_classes) l");

describe('teacher live lessons', () => {
  test('creates a live lesson with a pasted Meet link', async () => {
    const { t, moduleId } = await setup();
    const r = await addLive(t, moduleId, { isFreePreview: true });
    expect(r.status).toBe(201);
    expect(r.body.data).toMatchObject({ type: 'live', title: 'Live: factorisation', isFreePreview: false, recording: null });
    expect(r.body.data.live).toMatchObject({ stage: 'upcoming', batch: null, durationMin: 60, meetLink: 'https://meet.google.com/abc-defg-hij' });
    const lc = await one(
      'SELECT l.starts_at FROM dbo.live_classes l JOIN dbo.contents x ON x.live_class_id = l.live_class_id WHERE x.content_id = @id',
      { id: T.int(r.body.data.id) },
    );
    expect(new Date(lc.starts_at).toISOString()).toBe('2099-06-15T12:30:00.000Z');
  });

  test('rejects a time in the past', async () => {
    const { t, moduleId } = await setup();
    expect((await addLive(t, moduleId, { startsAt: '2020-01-01T10:00:00Z' })).status).toBe(400);
    expect(await counts()).toEqual({ c: 0, l: 0 });
  });

  test('rejects a batch of another course', async () => {
    const { t, moduleId } = await setup();
    const other = await readyCourse(t);
    const otherBatch = (await t.post(`/api/v1/teacher/courses/${other.courseId}/batches`, { name: 'X', startDate: '2026-01-01' })).body.data;
    const r = await addLive(t, moduleId, { batchId: otherBatch.id });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('Choose a batch of this course');
  });

  test('editing the time resets both reminders', async () => {
    const { t, moduleId } = await setup();
    const r = await addLive(t, moduleId);
    await query('UPDATE dbo.live_classes SET reminder_sent_at = SYSUTCDATETIME(), reminder2_sent_at = SYSUTCDATETIME()');
    const u = await t.put(`/api/v1/teacher/contents/${r.body.data.id}`, liveLessonBody({ title: 'Renamed', startsAt: '2099-06-16T12:30:00Z' }));
    expect(u.status).toBe(200);
    expect(u.body.data.title).toBe('Renamed');
    expect(new Date(u.body.data.live.startsAt).toISOString()).toBe('2099-06-16T12:30:00.000Z');
    expect(await one('SELECT topic, reminder_sent_at a, reminder2_sent_at b FROM dbo.live_classes')).toEqual({ topic: 'Renamed', a: null, b: null });
  });

  test('adds and removes an uploaded recording', async () => {
    const { t, moduleId } = await setup();
    const r = await addLive(t, moduleId);
    const key = await uploadVideo(t);
    const rec = await t.put(`/api/v1/teacher/contents/${r.body.data.id}/recording`, { videoSource: 'upload', fileKey: key });
    expect(rec.status).toBe(200);
    expect(rec.body.data.recording.videoSource).toBe('upload');
    expect(rec.body.data.live.stage).toBe('recorded');
    const cleared = await t.del(`/api/v1/teacher/contents/${r.body.data.id}/recording`);
    expect(cleared.status).toBe(200);
    expect(cleared.body.data).toMatchObject({ recording: null, live: { stage: 'upcoming' } });
  });

  test('adds a YouTube recording', async () => {
    const { t, moduleId } = await setup();
    const r = await addLive(t, moduleId);
    const rec = await t.put(`/api/v1/teacher/contents/${r.body.data.id}/recording`, { videoSource: 'youtube', url: 'https://youtu.be/abcdefgh123' });
    expect(rec.status).toBe(200);
    expect(rec.body.data.recording).toMatchObject({ videoSource: 'youtube' });
  });

  test('rejects an upload key the teacher does not own', async () => {
    const { t, moduleId } = await setup();
    const r = await addLive(t, moduleId);
    const rec = await t.put(`/api/v1/teacher/contents/${r.body.data.id}/recording`, { videoSource: 'upload', fileKey: 'videos/someone-else.mp4' });
    expect(rec.status).toBe(400);
  });

  test('recording on a non-live content', async () => {
    const { t, courseId } = await setup();
    const link = await one("SELECT content_id FROM dbo.contents WHERE course_id = @c AND type = 'link'", { c: T.int(courseId) });
    const rec = await t.put(`/api/v1/teacher/contents/${link.content_id}/recording`, { videoSource: 'youtube', url: 'https://youtu.be/abcdefgh123' });
    expect(rec.status).toBe(409);
    expect(rec.body.code).toBe('NOT_LIVE_LESSON');
  });

  test('deleting a live lesson with attendance is refused', async () => {
    const { t, moduleId } = await setup();
    const r = await addLive(t, moduleId);
    const s = await student();
    await query('INSERT INTO dbo.attendance (live_class_id, student_id, present) SELECT live_class_id, @s, 1 FROM dbo.live_classes', { s: T.int(s.user_id) });
    const d = await t.del(`/api/v1/teacher/contents/${r.body.data.id}`);
    expect(d.status).toBe(409);
    expect(d.body.code).toBe('LIVE_HAS_ATTENDANCE');
    expect(await counts()).toEqual({ c: 1, l: 1 });
  });

  test('deleting a live lesson without attendance removes the live class too', async () => {
    const { t, moduleId } = await setup();
    const r = await addLive(t, moduleId);
    expect((await t.del(`/api/v1/teacher/contents/${r.body.data.id}`)).status).toBe(200);
    expect(await counts()).toEqual({ c: 0, l: 0 });
  });

  test('a lesson cannot switch between live and recorded types', async () => {
    const { t, moduleId, courseId } = await setup();
    const r = await addLive(t, moduleId);
    expect((await t.put(`/api/v1/teacher/contents/${r.body.data.id}`, { title: 'x', type: 'link', url: 'https://example.com' })).status).toBe(400);
    const link = await one("SELECT content_id FROM dbo.contents WHERE course_id = @c AND type = 'link'", { c: T.int(courseId) });
    expect((await t.put(`/api/v1/teacher/contents/${link.content_id}`, liveLessonBody())).status).toBe(400);
  });

  test('another teacher cannot touch it', async () => {
    const { t, moduleId } = await setup();
    const r = await addLive(t, moduleId);
    const other = await teacher({ name: 'Other' });
    expect((await other.put(`/api/v1/teacher/contents/${r.body.data.id}/recording`, { videoSource: 'youtube', url: 'https://youtu.be/abcdefgh123' })).status).toBe(404);
    expect((await other.del(`/api/v1/teacher/contents/${r.body.data.id}`)).status).toBe(404);
  });

  test('a course whose only content is a live lesson can be published', async () => {
    const { t, courseId, moduleId } = await setup();
    await query("DELETE FROM dbo.contents WHERE course_id = @c AND type = 'link'", { c: T.int(courseId) });
    await addLive(t, moduleId);
    const p = await t.post(`/api/v1/teacher/courses/${courseId}/status`, { status: 'published' });
    expect(p.status).toBe(200);
  });

  test('the curriculum lists the live lesson with its stage', async () => {
    const { t, courseId, moduleId } = await setup();
    await addLive(t, moduleId);
    const tree = await t.get(`/api/v1/teacher/courses/${courseId}/curriculum`);
    const live = tree.body.data.subjects[0].modules[0].contents.find((x) => x.type === 'live');
    expect(live.live.stage).toBe('upcoming');
  });

  test('the live lesson appears in the live classes list and its attendance sheet works', async () => {
    const { t, courseId, moduleId, batch } = await setup();
    const s = await student({ name: 'A' });
    await activeEnrollment(courseId, t.user.user_id, s.user_id, batch.id);
    await addLive(t, moduleId, { batchId: batch.id });
    const list = await t.get(`/api/v1/teacher/live-classes?course=${courseId}`);
    expect(list.status).toBe(200); expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].topic).toBe('Live: factorisation');
    const sheet = await t.get(`/api/v1/teacher/live-classes/${list.body.data[0].id}/attendance`);
    expect(sheet.body.data.map((x) => x.name)).toEqual(['A']);
  });

  test('creating notifies the batch with a link to the lesson', async () => {
    const { t, courseId, moduleId, batch } = await setup();
    const s = await student({ name: 'A' });
    await activeEnrollment(courseId, t.user.user_id, s.user_id, batch.id);
    const r = await addLive(t, moduleId, { batchId: batch.id });
    const n = await one('SELECT link FROM dbo.notifications WHERE user_id = @u', { u: T.int(s.user_id) });
    expect(n.link).toBe(`/student/courses/${courseId}?lesson=${r.body.data.id}`);
  });

  test('reminders: 60 then 15 minutes before; standalone class once at 30', async () => {
    clock.set(new Date('2026-06-15T10:00:00Z'));
    const { t, courseId, moduleId, batch } = await setup();
    const s = await student({ name: 'A' });
    await activeEnrollment(courseId, t.user.user_id, s.user_id, batch.id);
    expect((await addLive(t, moduleId, { startsAt: '2026-06-15T12:30:00Z' })).status).toBe(201);
    expect((await t.post('/api/v1/teacher/live-classes', { courseId, topic: 'Doubt session', startsAt: '2026-06-15T15:00:00Z' })).status).toBe(201);
    const base = await countNotes(s.user_id); // the two "new class" notifications

    clock.set(new Date('2026-06-15T11:31:00Z')); // lesson start - 59 min
    await runLiveClassReminders();
    expect(await countNotes(s.user_id)).toBe(base + 1);
    await runLiveClassReminders();
    expect(await countNotes(s.user_id)).toBe(base + 1);
    clock.set(new Date('2026-06-15T12:16:00Z')); // lesson start - 14 min
    await runLiveClassReminders();
    await runLiveClassReminders();
    expect(await countNotes(s.user_id)).toBe(base + 2);
    clock.set(new Date('2026-06-15T14:00:00Z')); // standalone start - 60 min: not yet
    await runLiveClassReminders();
    expect(await countNotes(s.user_id)).toBe(base + 2);
    clock.set(new Date('2026-06-15T14:31:00Z')); // standalone start - 29 min
    await runLiveClassReminders();
    await runLiveClassReminders();
    expect(await countNotes(s.user_id)).toBe(base + 3);
  });
});
