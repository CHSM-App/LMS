// Phase 9 fixtures: a teacher with a published course (video, pdf, link lessons) and an enrolled student.
const { app, request, query, one, T, tokenFor } = require('./helpers');
const { teacher, readyCourse, uploadVideo, PDF } = require('./content');
const { student, activeEnrollment } = require('./operations');

async function asStudent(user) {
  const token = await tokenFor(user);
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  return {
    user,
    token,
    get: (url) => auth(request(app).get(url)),
    post: (url, body) => auth(request(app).post(url)).send(body),
    put: (url, body) => auth(request(app).put(url)).send(body),
    del: (url) => auth(request(app).delete(url)),
    attach: (url, fields, file) => {
      let r = auth(request(app).post(url));
      for (const [k, v] of Object.entries(fields)) r = r.field(k, v);
      if (file) r = r.attach('attachment', file.buffer, file.name);
      return r;
    },
  };
}

// Course with lessons: [link(from readyCourse), video upload, pdf]
async function world({ enrollOpts = {} } = {}) {
  const t = await teacher({ name: 'Suresh' });
  const c = await readyCourse(t);
  const videoKey = await uploadVideo(t);
  const video = (await t.post(`/api/v1/teacher/modules/${c.moduleId}/contents`, { title: 'Lesson video', type: 'video', videoSource: 'upload', fileKey: videoKey })).body.data;
  const pdfKey = (await t.upload('pdf', PDF, 'notes.pdf')).body.data.key;
  const pdf = (await t.post(`/api/v1/teacher/modules/${c.moduleId}/contents`, { title: 'Notes', type: 'pdf', fileKey: pdfKey })).body.data;
  await t.post(`/api/v1/teacher/courses/${c.courseId}/status`, { status: 'published' });
  const batch = (await t.post(`/api/v1/teacher/courses/${c.courseId}/batches`, { name: 'Morning', startDate: '2026-01-01' })).body.data;
  const contents = (await query('SELECT content_id, title FROM dbo.contents WHERE course_id = @c ORDER BY sort_order', { c: T.int(c.courseId) }));
  const s = await student({ name: 'Meera' });
  await activeEnrollment(c.courseId, t.user.user_id, s.user_id, batch.id, enrollOpts);
  const { slug } = (await t.get(`/api/v1/teacher/courses/${c.courseId}`)).body.data;
  return { t, ...c, slug, batch, video, pdf, contents, s: await asStudent(s) };
}

module.exports = { world, asStudent, query, one, T };
