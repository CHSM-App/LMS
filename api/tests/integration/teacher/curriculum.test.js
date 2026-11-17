const { reset, closeAll } = require('../../setup/helpers');
const { teacher, baseCourse, readyCourse, uploadVideo, PDF, query, T } = require('../../setup/content');

beforeEach(reset);
afterAll(closeAll);

test('subjects: CRUD, validation, delete blocked while modules exist', async () => {
  const t = await teacher();
  const { courseId, subjectId } = await readyCourse(t);
  expect((await t.post(`/api/v1/teacher/courses/${courseId}/subjects`, { name: '' })).status).toBe(400);
  const s2 = await t.post(`/api/v1/teacher/courses/${courseId}/subjects`, { name: 'Geometry', description: 'Shapes' });
  expect(s2.status).toBe(201);
  expect((await t.put(`/api/v1/teacher/subjects/${s2.body.data.id}`, { name: 'भूमिती' })).body.data.name).toBe('भूमिती');
  const del = await t.del(`/api/v1/teacher/subjects/${subjectId}`);
  expect(del.status).toBe(409);
  expect((await t.del(`/api/v1/teacher/subjects/${s2.body.data.id}`)).status).toBe(200);
  const other = await teacher({ name: 'Other' });
  expect((await other.put(`/api/v1/teacher/subjects/${subjectId}`, { name: 'X' })).status).toBe(404);
});

test('modules: order numbers, reorder, bad lists rejected, delete blocked with content', async () => {
  const t = await teacher();
  const { courseId, subjectId, moduleId } = await readyCourse(t);
  const m2 = (await t.post(`/api/v1/teacher/subjects/${subjectId}/modules`, { name: 'Quadratics' })).body.data;
  const m3 = (await t.post(`/api/v1/teacher/subjects/${subjectId}/modules`, { name: 'Polynomials' })).body.data;
  expect([m2.sortOrder, m3.sortOrder]).toEqual([2, 3]);
  const r = await t.put(`/api/v1/teacher/subjects/${subjectId}/modules/order`, { moduleIds: [m3.id, moduleId, m2.id] });
  expect(r.status).toBe(200);
  const tree = await t.get(`/api/v1/teacher/courses/${courseId}/curriculum`);
  expect(tree.body.data.subjects[0].modules.map((m) => m.id)).toEqual([m3.id, moduleId, m2.id]);
  expect((await t.put(`/api/v1/teacher/subjects/${subjectId}/modules/order`, { moduleIds: [m3.id, moduleId] })).status).toBe(400);
  await Promise.all([
    t.put(`/api/v1/teacher/subjects/${subjectId}/modules/order`, { moduleIds: [moduleId, m2.id, m3.id] }),
    t.put(`/api/v1/teacher/subjects/${subjectId}/modules/order`, { moduleIds: [m2.id, m3.id, moduleId] }),
  ]);
  const orders = await query('SELECT sort_order FROM dbo.modules WHERE subject_id = @s ORDER BY sort_order', { s: T.int(subjectId) });
  expect(orders.map((o) => o.sort_order)).toEqual([1, 2, 3]);
  const del = await t.del(`/api/v1/teacher/modules/${moduleId}`);
  expect(del.status).toBe(409);
  expect(del.body.error).toBe('Remove or move its content first');
  expect((await t.del(`/api/v1/teacher/modules/${m2.id}`)).status).toBe(200);
});

test('contents: link, PDF and video (upload or link), free preview, reorder', async () => {
  const t = await teacher();
  const { courseId, moduleId } = await readyCourse(t);
  expect((await t.post(`/api/v1/teacher/modules/${moduleId}/contents`, { title: 'No url', type: 'link' })).status).toBe(400);
  expect((await t.post(`/api/v1/teacher/modules/${moduleId}/contents`, { title: 'No file', type: 'video', videoSource: 'upload' })).status).toBe(400);
  const pdfKey = (await t.upload('pdf', PDF, 'notes.pdf')).body.data.key;
  const pdf = await t.post(`/api/v1/teacher/modules/${moduleId}/contents`, { title: 'Notes', type: 'pdf', fileKey: pdfKey });
  expect(pdf.status).toBe(201);
  const videoKey = await uploadVideo(t);
  const vid = await t.post(`/api/v1/teacher/modules/${moduleId}/contents`, { title: 'Lesson 1', type: 'video', videoSource: 'upload', fileKey: videoKey, isFreePreview: true });
  expect(vid.body.data).toMatchObject({ type: 'video', videoSource: 'upload', isFreePreview: true });
  const yt = await t.post(`/api/v1/teacher/modules/${moduleId}/contents`, { title: 'Lesson 2', type: 'video', videoSource: 'youtube', url: 'https://www.youtube.com/watch?v=abcdefgh123' });
  expect(yt.status).toBe(201);
  const tree = await t.get(`/api/v1/teacher/courses/${courseId}/curriculum`);
  const ids = tree.body.data.subjects[0].modules[0].contents.map((c) => c.id);
  expect(ids).toHaveLength(4);
  const reversed = [...ids].reverse();
  expect((await t.put(`/api/v1/teacher/modules/${moduleId}/contents/order`, { contentIds: reversed })).status).toBe(200);
  const after = await t.get(`/api/v1/teacher/courses/${courseId}/curriculum`);
  expect(after.body.data.subjects[0].modules[0].contents.map((c) => c.id)).toEqual(reversed);
  expect((await t.put(`/api/v1/teacher/contents/${yt.body.data.id}`, { title: 'Lesson 2 (new)', type: 'video', videoSource: 'youtube', url: 'https://youtu.be/zzzzzzzz123' })).status).toBe(200);
  expect((await t.del(`/api/v1/teacher/contents/${yt.body.data.id}`)).status).toBe(200);
});

test('batches: create, unique name per course, date order, close', async () => {
  const t = await teacher();
  const id = (await t.post('/api/v1/teacher/courses', baseCourse)).body.data.id;
  const b = await t.post(`/api/v1/teacher/courses/${id}/batches`, { name: 'Morning batch', startDate: '2026-06-01', timingText: 'Mon–Fri 7–8 am', maxStudents: 30 });
  expect(b.status).toBe(201);
  expect(b.body.data).toMatchObject({ name: 'Morning batch', status: 'active', maxStudents: 30 });
  expect((await t.post(`/api/v1/teacher/courses/${id}/batches`, { name: 'Morning batch', startDate: '2026-06-01' })).status).toBe(409);
  const bad = await t.post(`/api/v1/teacher/courses/${id}/batches`, { name: 'B2', startDate: '2026-06-10', endDate: '2026-06-01' });
  expect(bad.status).toBe(400);
  const closed = await t.put(`/api/v1/teacher/batches/${b.body.data.id}`, { name: 'Morning batch', startDate: '2026-06-01', status: 'closed' });
  expect(closed.body.data.status).toBe('closed');
  expect((await t.get(`/api/v1/teacher/courses/${id}/batches`)).body.data).toHaveLength(1);
  const other = await teacher({ name: 'O' });
  expect((await other.get(`/api/v1/teacher/courses/${id}/batches`)).status).toBe(404);
});
