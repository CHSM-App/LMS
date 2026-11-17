const { reset, closeAll, asUser } = require('../../setup/helpers');
const { teacher, baseCourse, readyCourse, PNG, one, query, T } = require('../../setup/content');

beforeEach(reset);
afterAll(closeAll);

test('create needs title, description, subject and language; saves as draft with a slug', async () => {
  const t = await teacher();
  expect((await t.post('/api/v1/teacher/courses', { ...baseCourse, title: '' })).status).toBe(400);
  expect((await t.post('/api/v1/teacher/courses', { ...baseCourse, language: 'xx' })).status).toBe(400);
  const res = await t.post('/api/v1/teacher/courses', { ...baseCourse, title: 'इयत्ता 10 गणित', feeDisplay: '₹ 3000 / year', durationText: '10 months' });
  expect(res.status).toBe(201);
  expect(res.body.data).toMatchObject({ status: 'draft', title: 'इयत्ता 10 गणित', feeDisplay: '₹ 3000 / year' });
  expect(res.body.data.slug).toMatch(/^[a-z0-9-]+$/);
});

test('a teacher only sees and changes their own courses', async () => {
  const a = await teacher({ name: 'A' });
  const b = await teacher({ name: 'B' });
  const id = (await a.post('/api/v1/teacher/courses', baseCourse)).body.data.id;
  expect((await b.get(`/api/v1/teacher/courses/${id}`)).status).toBe(404);
  expect((await b.put(`/api/v1/teacher/courses/${id}`, baseCourse)).status).toBe(404);
  expect((await b.del(`/api/v1/teacher/courses/${id}`)).status).toBe(404);
  expect((await b.post(`/api/v1/teacher/courses/${id}/status`, { status: 'published' })).status).toBe(404);
  expect((await b.post(`/api/v1/teacher/courses/${id}/subjects`, { name: 'X' })).status).toBe(404);
  expect((await b.get('/api/v1/teacher/courses')).body.data).toHaveLength(0);
  expect((await a.get('/api/v1/teacher/courses')).body.data).toHaveLength(1);
});

test('publish lists what is missing, then publishes when ready', async () => {
  const t = await teacher();
  const id = (await t.post('/api/v1/teacher/courses', baseCourse)).body.data.id;
  const res = await t.post(`/api/v1/teacher/courses/${id}/status`, { status: 'published' });
  expect(res.status).toBe(422);
  expect(res.body.details.missing).toEqual(['thumbnail', 'demo_video_1', 'demo_video_2', 'content']);
  const ready = await readyCourse(t);
  const ok = await t.post(`/api/v1/teacher/courses/${ready.courseId}/status`, { status: 'published' });
  expect(ok.status).toBe(200);
  expect(ok.body.data.status).toBe('published');
  expect(ok.body.data.publishedAt).toBeTruthy();
  const back = await t.post(`/api/v1/teacher/courses/${ready.courseId}/status`, { status: 'draft' });
  expect(back.body.data.status).toBe('draft');
});

test('pending status is greyed out in v1', async () => {
  const t = await teacher();
  const id = (await t.post('/api/v1/teacher/courses', baseCourse)).body.data.id;
  expect((await t.post(`/api/v1/teacher/courses/${id}/status`, { status: 'pending' })).status).toBe(400);
});

test('limited mode: an expired teacher can save drafts but not publish', async () => {
  const t = await teacher({ subscribed: false });
  const ready = await readyCourse(t);
  const res = await t.post(`/api/v1/teacher/courses/${ready.courseId}/status`, { status: 'published' });
  expect(res.status).toBe(403);
  expect(res.body.code).toBe('TEACHER_SUBSCRIPTION_EXPIRED');
  expect((await t.put(`/api/v1/teacher/courses/${ready.courseId}`, { ...baseCourse, title: 'Edited' })).status).toBe(200);
});

test("demo videos must be valid links or the teacher's own uploads", async () => {
  const t = await teacher();
  const other = await teacher({ name: 'Other' });
  const bad = await t.post('/api/v1/teacher/courses', { ...baseCourse, demoVideo1: { source: 'youtube', url: 'https://example.com/v.mp4' } });
  expect(bad.status).toBe(400);
  expect(bad.body.error).toBe('Enter a valid YouTube link');
  const theirThumb = (await other.upload('thumbnail', PNG, 't.png')).body.data.key;
  const stolen = await t.post('/api/v1/teacher/courses', { ...baseCourse, thumbnailKey: theirThumb });
  expect(stolen.status).toBe(400);
  expect(stolen.body.error).toBe('Upload the file again');
});

test('delete: only drafts; published courses must be unpublished first', async () => {
  const t = await teacher();
  const ready = await readyCourse(t);
  await t.post(`/api/v1/teacher/courses/${ready.courseId}/status`, { status: 'published' });
  const res = await t.del(`/api/v1/teacher/courses/${ready.courseId}`);
  expect(res.status).toBe(409);
  expect(res.body.error).toBe('Unpublish the course first');
  await t.post(`/api/v1/teacher/courses/${ready.courseId}/status`, { status: 'draft' });
  expect((await t.del(`/api/v1/teacher/courses/${ready.courseId}`)).status).toBe(200);
  expect(await one('SELECT * FROM dbo.courses WHERE course_id = @id', { id: T.int(ready.courseId) })).toBeNull();
});

test('admin and students cannot use teacher course routes', async () => {
  const admin = await asUser({ role: 'admin' });
  const student = await asUser({ role: 'student' });
  expect((await admin.get('/api/v1/teacher/courses')).status).toBe(403);
  expect((await student.get('/api/v1/teacher/courses')).status).toBe(403);
  expect((await query('SELECT 1 AS x')).length).toBe(1);
});
