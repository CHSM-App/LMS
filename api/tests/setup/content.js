// Helpers for Phase 5+ tests: teacher with an active subscription, uploads, and ready-to-publish courses.
const { query, one, T, createUser, tokenFor, app, request } = require('./helpers');

// Smallest valid MP4 header ("ftyp" box) — enough for magic-byte detection.
const MP4 = Buffer.concat([Buffer.from('000000186674797069736f6d0000020069736f6d69736f32', 'hex'), Buffer.alloc(64)]);
const PNG = Buffer.from('89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000A49444154789C6300010000050001', 'hex');
const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n');

async function activeSubscription(teacherId) {
  await query(
    "INSERT INTO dbo.teacher_subscriptions (teacher_id, plan_type, start_date, end_date) VALUES (@t, 'custom', '2020-01-01', '2099-12-31')",
    { t: T.int(teacherId) },
  );
}

async function teacher({ subscribed = true, name = 'Teacher' } = {}) {
  const user = await createUser({ role: 'teacher', name });
  if (subscribed) await activeSubscription(user.user_id);
  const token = await tokenFor(user);
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  return {
    user,
    token,
    get: (url) => auth(request(app).get(url)),
    post: (url, body) => auth(request(app).post(url)).send(body),
    put: (url, body) => auth(request(app).put(url)).send(body),
    del: (url) => auth(request(app).delete(url)),
    upload: (kind, buffer, name) => auth(request(app).post('/api/v1/uploads')).field('kind', kind).attach('file', buffer, name),
  };
}

async function uploadVideo(t, kind = 'video') {
  const s = await t.post('/api/v1/uploads/sessions', { kind, fileName: 'lesson.mp4', totalBytes: MP4.length });
  await request(app)
    .put(`/api/v1/uploads/sessions/${s.body.data.uploadId}`)
    .set('Authorization', `Bearer ${t.token}`)
    .set('Content-Type', 'application/octet-stream')
    .set('Content-Range', `bytes 0-${MP4.length - 1}/${MP4.length}`)
    .send(MP4);
  const done = await t.post(`/api/v1/uploads/sessions/${s.body.data.uploadId}/complete`);
  return done.body.data.key;
}

const baseCourse = { title: 'Class 10 Maths', description: 'Full SSC syllabus with practice.', subject: 'Maths', language: 'mr' };

async function readyCourse(t) {
  const thumb = (await t.upload('thumbnail', PNG, 't.png')).body.data.key;
  const c = await t.post('/api/v1/teacher/courses', {
    ...baseCourse,
    thumbnailKey: thumb,
    demoVideo1: { source: 'youtube', url: 'https://youtu.be/abcdefgh123' },
    demoVideo2: { source: 'vimeo', url: 'https://vimeo.com/123456' },
  });
  const courseId = c.body.data.id;
  const sub = await t.post(`/api/v1/teacher/courses/${courseId}/subjects`, { name: 'Algebra' });
  const mod = await t.post(`/api/v1/teacher/subjects/${sub.body.data.id}/modules`, { name: 'Linear equations' });
  await t.post(`/api/v1/teacher/modules/${mod.body.data.id}/contents`, { title: 'Intro', type: 'link', url: 'https://example.com/notes' });
  return { courseId, subjectId: sub.body.data.id, moduleId: mod.body.data.id };
}

module.exports = { MP4, PNG, PDF, teacher, activeSubscription, uploadVideo, baseCourse, readyCourse, one, query, T };
