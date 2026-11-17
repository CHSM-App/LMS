const { app, request, reset, closeAll } = require('../../setup/helpers');
const { teacher, readyCourse, uploadVideo, MP4, PNG, PDF, one, T } = require('../../setup/content');
const storage = require('../../../src/providers/storage');

beforeEach(reset);
afterAll(closeAll);

const putChunk = (t, id, buf, start, total) =>
  request(app)
    .put(`/api/v1/uploads/sessions/${id}`)
    .set('Authorization', `Bearer ${t.token}`)
    .set('Content-Type', 'application/octet-stream')
    .set('Content-Range', `bytes ${start}-${start + buf.length - 1}/${total}`)
    .send(buf);

test('small uploads are checked by content, not name', async () => {
  const t = await teacher();
  const fake = await t.upload('thumbnail', Buffer.from('MZ this is an exe'), 'photo.png');
  expect(fake.status).toBe(400);
  expect(fake.body.error).toBe('File type not allowed');
  const ok = await t.upload('thumbnail', PNG, 'thumb.png');
  expect(ok.status).toBe(201);
  expect(ok.body.data.key).toMatch(/^thumbnail\/[0-9a-f-]{36}\.png$/);
  expect((await t.upload('pdf', PNG, 'x.pdf')).status).toBe(400);
  expect((await t.upload('pdf', PDF, 'x.pdf')).status).toBe(201);
});

test('resumable video upload: chunks, resume after a drop, wrong offset 409', async () => {
  const t = await teacher();
  const s = await t.post('/api/v1/uploads/sessions', { kind: 'video', fileName: 'lesson.mp4', totalBytes: MP4.length });
  expect(s.status).toBe(201);
  const id = s.body.data.uploadId;
  const first = MP4.subarray(0, 40);
  expect((await putChunk(t, id, first, 0, MP4.length)).body.data.receivedBytes).toBe(40);
  // network drop: client asks where to resume
  expect((await t.get(`/api/v1/uploads/sessions/${id}`)).body.data.receivedBytes).toBe(40);
  const wrong = await putChunk(t, id, MP4.subarray(50), 50, MP4.length);
  expect(wrong.status).toBe(409);
  expect(wrong.body.details.receivedBytes).toBe(40);
  await putChunk(t, id, MP4.subarray(40), 40, MP4.length);
  const done = await t.post(`/api/v1/uploads/sessions/${id}/complete`);
  expect(done.status).toBe(200);
  expect(done.body.data.key).toMatch(/^video\/[0-9a-f-]{36}\.mp4$/);
  expect(storage.exists(done.body.data.key)).toBe(true);
});

test('a renamed .exe uploaded as video is refused at completion', async () => {
  const t = await teacher();
  const exe = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(100)]);
  const s = await t.post('/api/v1/uploads/sessions', { kind: 'video', fileName: 'x.mp4', totalBytes: exe.length });
  await putChunk(t, s.body.data.uploadId, exe, 0, exe.length);
  const res = await t.post(`/api/v1/uploads/sessions/${s.body.data.uploadId}/complete`);
  expect(res.status).toBe(400);
  expect(res.body.error).toBe('File type not allowed');
});

test('videos over 500 MB are refused; another teacher cannot use my session', async () => {
  const t = await teacher();
  expect((await t.post('/api/v1/uploads/sessions', { kind: 'video', fileName: 'big.mp4', totalBytes: 501 * 1024 * 1024 })).status).toBe(413);
  const s = await t.post('/api/v1/uploads/sessions', { kind: 'video', fileName: 'a.mp4', totalBytes: MP4.length });
  const other = await teacher({ name: 'O' });
  expect((await other.get(`/api/v1/uploads/sessions/${s.body.data.uploadId}`)).status).toBe(404);
});

test('files: protected content needs a valid signature; thumbnails and demo videos are public', async () => {
  const t = await teacher();
  const key = await uploadVideo(t);
  expect((await request(app).get(`/api/v1/files/${key}`)).status).toBe(403);
  const signed = storage.signedUrl(key);
  const ok = await request(app).get(signed);
  expect(ok.status).toBe(200);
  const ranged = await request(app).get(signed).set('Range', 'bytes=0-9');
  expect(ranged.status).toBe(206);
  const demo = await uploadVideo(t, 'demo_video');
  expect((await request(app).get(`/api/v1/files/${demo}`)).status).toBe(200);
  const thumb = (await t.upload('thumbnail', PNG, 't.png')).body.data.key;
  expect((await request(app).get(`/api/v1/files/${thumb}`)).status).toBe(200);
  expect((await request(app).get('/api/v1/files/video/../../.env')).status).toBe(404);
});

test('teacher curriculum returns signed URLs for their own files', async () => {
  const t = await teacher();
  const { courseId, moduleId } = await readyCourse(t);
  const key = await uploadVideo(t);
  await t.post(`/api/v1/teacher/modules/${moduleId}/contents`, { title: 'V', type: 'video', videoSource: 'upload', fileKey: key });
  const tree = await t.get(`/api/v1/teacher/courses/${courseId}/curriculum`);
  const v = tree.body.data.subjects[0].modules[0].contents.find((c) => c.title === 'V');
  expect(v.url).toMatch(/^\/api\/v1\/files\/video\/.+\?exp=\d+&sig=/);
  expect(await one('SELECT COUNT(*) n FROM dbo.upload_sessions WHERE teacher_id = @t', { t: T.int(t.user.user_id) })).toEqual({ n: 2 });
});
