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
test("the live classes page cannot move a lesson to another course, and a topic edit renames the lesson", async () => {
    const { t, moduleId, courseId } = await setup();
    const other = await readyCourse(t);
    const r = await addLive(t, moduleId);
    const lcId = r.body.data.live.liveClassId;
    const body = { courseId: other.courseId, topic: "Moved", startsAt: "2099-06-15T12:30:00Z", durationMin: 60, meetLink: "https://meet.google.com/abc-defg-hij" };
    const moved = await t.put(`/api/v1/teacher/live-classes/${lcId}`, body);
    expect(moved.status).toBe(400);
    expect(moved.body.code).toBe("LIVE_LESSON_COURSE_FIXED");
    expect((await one("SELECT course_id FROM dbo.live_classes WHERE live_class_id = @id", { id: T.int(lcId) })).course_id).toBe(courseId);
    expect((await t.put(`/api/v1/teacher/live-classes/${lcId}`, { ...body, courseId })).status).toBe(200);
    expect((await one("SELECT title FROM dbo.contents WHERE content_id = @id", { id: T.int(r.body.data.id) })).title).toBe("Moved");
  });
});

describe('one live lesson, a session per batch', () => {
  const mkBatch = async (t, courseId, name) => (await t.post(`/api/v1/teacher/courses/${courseId}/batches`, { name, startDate: '2026-01-01' })).body.data;
  const session = (t, contentId, body) => t.post(`/api/v1/teacher/contents/${contentId}/sessions`, body);
  const slot = (id) => one('SELECT live_slot_id s FROM dbo.contents WHERE content_id = @id', { id: T.int(id) });

  async function lessonForA() {
    const { t, courseId, moduleId, batch } = await setup();
    const b = await mkBatch(t, courseId, 'Evening');
    const r = await addLive(t, moduleId, { batchId: batch.id });
    return { t, courseId, moduleId, a: batch, b, lesson: r.body.data };
  }

  test('a new live lesson gets its own slot', async () => {
    const { lesson } = await lessonForA();
    expect((await slot(lesson.id)).s).not.toBeNull();
  });

  test('scheduling another batch adds a session of the same lesson without a recording', async () => {
    const { t, b, lesson } = await lessonForA();
    const r = await session(t, lesson.id, { batchId: b.id, startsAt: '2099-06-16T12:30:00Z' });
    expect(r.status).toBe(201);
    expect(r.body.data).toMatchObject({ batch: { id: b.id, name: 'Evening' }, stage: 'upcoming' });
    const rows = await query('SELECT content_id, module_id, title, sort_order, video_source, live_slot_id FROM dbo.contents WHERE type = \'live\' ORDER BY content_id');
    expect(rows).toHaveLength(2);
    expect(String(rows[1].live_slot_id)).toBe(String(rows[0].live_slot_id));
    expect(rows[1]).toMatchObject({ module_id: rows[0].module_id, title: rows[0].title, sort_order: rows[0].sort_order + 1, video_source: null });
    expect(r.body.data.contentId).toBe(rows[1].content_id);
  });

  test('the new session sits right after its lesson and later lessons move down by one', async () => {
    const { t, b, moduleId, lesson } = await lessonForA();
    await t.post(`/api/v1/teacher/modules/${moduleId}/contents`, { type: 'link', title: 'After', url: 'https://example.com' });
    await session(t, lesson.id, { batchId: b.id, startsAt: '2099-06-16T12:30:00Z' });
    const order = (await query('SELECT title, sort_order FROM dbo.contents ORDER BY sort_order')).map((r) => r.title);
    expect(order).toEqual(['Intro', 'Live: factorisation', 'Live: factorisation', 'After']);
  });

  test('the same batch twice is refused and creates nothing', async () => {
    const { t, a, lesson } = await lessonForA();
    const r = await session(t, lesson.id, { batchId: a.id, startsAt: '2099-06-16T12:30:00Z' });
    expect(r.status).toBe(409);
    expect(r.body.code).toBe('SESSION_EXISTS');
    expect(await counts()).toEqual({ c: 1, l: 1 });
  });

  test('a lesson for all batches cannot get a single-batch session', async () => {
    const { t, moduleId, b } = await lessonForA();
    const all = (await addLive(t, moduleId)).body.data;
    const r = await session(t, all.id, { batchId: b.id, startsAt: '2099-06-16T12:30:00Z' });
    expect(r.status).toBe(409);
    expect(r.body.code).toBe('SLOT_ALL_BATCHES');
  });

  test('a closed batch cannot be scheduled', async () => {
    const { t, b, lesson } = await lessonForA();
    await query("UPDATE dbo.batches SET status = 'closed' WHERE batch_id = @b", { b: T.int(b.id) });
    const r = await session(t, lesson.id, { batchId: b.id, startsAt: '2099-06-16T12:30:00Z' });
    expect(r.status).toBe(409);
    expect(r.body.code).toBe('BATCH_CLOSED');
  });

  test('a time in the past is refused', async () => {
    const { t, b, lesson } = await lessonForA();
    expect((await session(t, lesson.id, { batchId: b.id, startsAt: '2020-01-01T10:00:00Z' })).status).toBe(400);
  });

  test('another teacher cannot schedule on my lesson', async () => {
    const { b, lesson } = await lessonForA();
    const other = await teacher({ name: 'Other' });
    expect((await session(other, lesson.id, { batchId: b.id, startsAt: '2099-06-16T12:30:00Z' })).status).toBe(404);
  });

  test('only live lessons can get sessions', async () => {
    const { t, b, moduleId } = await lessonForA();
    const link = (await t.post(`/api/v1/teacher/modules/${moduleId}/contents`, { type: 'link', title: 'L', url: 'https://example.com' })).body.data;
    const r = await session(t, link.id, { batchId: b.id, startsAt: '2099-06-16T12:30:00Z' });
    expect(r.status).toBe(409);
    expect(r.body.code).toBe('NOT_LIVE_LESSON');
  });
});

describe('one lesson with sessions in the teacher curriculum', () => {
  const mkBatch = async (t, courseId, name) => (await t.post(`/api/v1/teacher/courses/${courseId}/batches`, { name, startDate: '2026-01-01' })).body.data;
  const tree = async (t, courseId) => (await t.get(`/api/v1/teacher/courses/${courseId}/curriculum`)).body.data;
  const contentsOf = (data) => data.subjects.flatMap((s) => s.modules).flatMap((m) => m.contents);

  async function slotWithTwoBatches() {
    const { t, courseId, moduleId, batch } = await setup();
    const evening = await mkBatch(t, courseId, 'Evening');
    const a = (await addLive(t, moduleId, { batchId: batch.id })).body.data;
    const b = (await t.post(`/api/v1/teacher/contents/${a.id}/sessions`, { batchId: evening.id, startsAt: '2099-06-16T12:30:00Z' })).body.data;
    await t.post(`/api/v1/teacher/modules/${moduleId}/contents`, { type: 'link', title: 'After', url: 'https://example.com' });
    return { t, courseId, moduleId, a, bId: b.contentId, morning: batch, evening };
  }

  test('the curriculum shows one lesson with a session per batch', async () => {
    const { t, courseId, a, bId, morning, evening } = await slotWithTwoBatches();
    const live = contentsOf(await tree(t, courseId)).filter((x) => x.type === 'live');
    expect(live).toHaveLength(1);
    expect(live[0].id).toBe(a.id);
    expect(live[0].live.slotId).toBeTruthy();
    expect(live[0].live.sessions.map((s) => [s.contentId, s.batch.id])).toEqual([[a.id, morning.id], [bId, evening.id]]);
    expect(live[0].live.sessions[1]).toMatchObject({ stage: 'upcoming', recording: null });
  });

  test('renaming the lesson renames every session', async () => {
    const { t, a } = await slotWithTwoBatches();
    const u = await t.put(`/api/v1/teacher/contents/${a.id}`, liveLessonBody({ title: 'Renamed', batchId: a.live.batch.id }));
    expect(u.status).toBe(200);
    expect((await query("SELECT DISTINCT title FROM dbo.contents WHERE type = 'live'")).map((r) => r.title)).toEqual(['Renamed']);
    expect((await query('SELECT DISTINCT topic FROM dbo.live_classes')).map((r) => r.topic)).toEqual(['Renamed']);
  });

  test('reordering moves all sessions of a lesson together', async () => {
    const { t, moduleId, a } = await slotWithTwoBatches();
    const all = await query('SELECT content_id, title FROM dbo.contents ORDER BY sort_order');
    const intro = all.find((r) => r.title === 'Intro').content_id;
    const after = all.find((r) => r.title === 'After').content_id;
    const r = await t.put(`/api/v1/teacher/modules/${moduleId}/contents/order`, { contentIds: [after, a.id, intro] });
    expect(r.status).toBe(200);
    expect((await query('SELECT title FROM dbo.contents ORDER BY sort_order')).map((x) => x.title)).toEqual(['After', 'Live: factorisation', 'Live: factorisation', 'Intro']);
  });

  test('reordering still rejects a list that misses a lesson', async () => {
    const { t, moduleId, a } = await slotWithTwoBatches();
    expect((await t.put(`/api/v1/teacher/modules/${moduleId}/contents/order`, { contentIds: [a.id] })).status).toBe(400);
  });

  test('deleting the lesson removes every session', async () => {
    const { t, a } = await slotWithTwoBatches();
    expect((await t.del(`/api/v1/teacher/contents/${a.id}`)).status).toBe(200);
    expect(await counts()).toEqual({ c: 0, l: 0 });
  });

  test('deleting is refused, and nothing is deleted, when any session has attendance', async () => {
    const { t, a, bId } = await slotWithTwoBatches();
    const s = await student({ name: 'Kid' });
    const lc = await one('SELECT live_class_id id FROM dbo.contents WHERE content_id = @id', { id: T.int(bId) });
    await query('INSERT INTO dbo.attendance (live_class_id, student_id, present, marked_at) VALUES (@l, @s, 1, SYSUTCDATETIME())', { l: T.int(lc.id), s: T.int(s.user_id) });
    const d = await t.del(`/api/v1/teacher/contents/${a.id}`);
    expect(d.status).toBe(409);
    expect(d.body.code).toBe('LIVE_HAS_ATTENDANCE');
    expect(await counts()).toEqual({ c: 2, l: 2 });
  });
});
