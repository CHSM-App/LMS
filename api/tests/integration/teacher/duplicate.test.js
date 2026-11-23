const { reset, closeAll } = require('../../setup/helpers');
const { teacher, readyCourse, uploadVideo, liveLessonBody, query, one, T } = require('../../setup/content');

beforeEach(async () => {
  await reset();
  process.env.MEET_PROVIDER = 'console';
});
afterAll(closeAll);

const contentsOf = (tree) => tree.subjects.flatMap((s) => s.modules).flatMap((m) => m.contents);

async function richCourse() {
  const t = await teacher({ name: 'Suresh' });
  const c = await readyCourse(t);
  const key = await uploadVideo(t);
  await t.post(`/api/v1/teacher/modules/${c.moduleId}/contents`, { title: 'Video', type: 'video', videoSource: 'upload', fileKey: key, isFreePreview: true });
  const mk = async (name) => (await t.post(`/api/v1/teacher/courses/${c.courseId}/batches`, { name, startDate: '2026-01-01' })).body.data;
  const morning = await mk('2026 - Morning');
  const evening = await mk('2026 - Evening');
  const live = (await t.post(`/api/v1/teacher/modules/${c.moduleId}/contents`, liveLessonBody({ title: 'Live: algebra', batchId: morning.id }))).body.data;
  await t.post(`/api/v1/teacher/contents/${live.id}/sessions`, { batchId: evening.id, startsAt: '2099-06-16T12:30:00Z' });
  await t.put(`/api/v1/teacher/contents/${live.id}/recording`, { videoSource: 'youtube', url: 'https://youtu.be/abcdefgh123' });
  await t.post(`/api/v1/teacher/modules/${c.moduleId}/contents`, { type: 'link', title: 'After', url: 'https://example.com' });
  await t.post(`/api/v1/teacher/courses/${c.courseId}/status`, { status: 'published' });
  return { t, ...c, key };
}

test('copies the course as a draft with the same subjects, modules and lessons', async () => {
  const { t, courseId, key } = await richCourse();
  const r = await t.post(`/api/v1/teacher/courses/${courseId}/duplicate`, {});
  expect(r.status).toBe(201);
  const orig = (await t.get(`/api/v1/teacher/courses/${courseId}`)).body.data;
  expect(r.body.data).toMatchObject({ status: 'draft', title: `${orig.title} (copy)`, description: orig.description, subject: orig.subject, language: orig.language });
  expect(r.body.data.slug).not.toBe(orig.slug);
  const a = (await t.get(`/api/v1/teacher/courses/${courseId}/curriculum`)).body.data;
  const b = (await t.get(`/api/v1/teacher/courses/${r.body.data.id}/curriculum`)).body.data;
  expect(b.subjects.map((s) => [s.name, s.modules.map((m) => m.name)])).toEqual(a.subjects.map((s) => [s.name, s.modules.map((m) => m.name)]));
  expect(contentsOf(b).map((x) => [x.title, x.type])).toEqual(contentsOf(a).map((x) => [x.title, x.type]));
  const video = contentsOf(b).find((x) => x.title === 'Video');
  expect(video).toMatchObject({ fileKey: key, isFreePreview: true });
});

test('live lessons are copied once each, without dates, Meet links or recordings', async () => {
  const { t, courseId } = await richCourse();
  const id = (await t.post(`/api/v1/teacher/courses/${courseId}/duplicate`, {})).body.data.id;
  const live = contentsOf((await t.get(`/api/v1/teacher/courses/${id}/curriculum`)).body.data).filter((x) => x.type === 'live');
  expect(live).toHaveLength(1);
  expect(live[0]).toMatchObject({ recording: null, live: { stage: 'unscheduled', sessions: [] } });
  expect((await one('SELECT COUNT(*) n FROM dbo.live_classes WHERE course_id = @c', { c: T.int(id) })).n).toBe(0);
});

test('batches, students and the original course stay as they were', async () => {
  const { t, courseId } = await richCourse();
  const before = await query('SELECT content_id, sort_order, live_slot_id FROM dbo.contents WHERE course_id = @c ORDER BY content_id', { c: T.int(courseId) });
  const id = (await t.post(`/api/v1/teacher/courses/${courseId}/duplicate`, {})).body.data.id;
  expect((await one('SELECT COUNT(*) n FROM dbo.batches WHERE course_id = @c', { c: T.int(id) })).n).toBe(0);
  expect(await query('SELECT content_id, sort_order, live_slot_id FROM dbo.contents WHERE course_id = @c ORDER BY content_id', { c: T.int(courseId) })).toEqual(before);
  const slots = await query("SELECT live_slot_id s FROM dbo.contents WHERE type = 'live' AND course_id = @c", { c: T.int(id) });
  for (const s of slots) expect(before.map((x) => String(x.live_slot_id))).not.toContain(String(s.s));
});

test("another teacher cannot copy my course", async () => {
  const { courseId } = await richCourse();
  const other = await teacher({ name: 'Other' });
  expect((await other.post(`/api/v1/teacher/courses/${courseId}/duplicate`, {})).status).toBe(404);
});
