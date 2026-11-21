const { app, request, reset, closeAll, sendOtp, query, one, T } = require('../../setup/helpers');
const { teacher, readyCourse, uploadVideo } = require('../../setup/content');

beforeEach(reset);
afterAll(closeAll);

async function published(t, over = {}) {
  const c = await readyCourse(t);
  if (Object.keys(over).length) {
    const cur = (await t.get(`/api/v1/teacher/courses/${c.courseId}`)).body.data;
    await t.put(`/api/v1/teacher/courses/${c.courseId}`, {
      title: over.title || cur.title, description: cur.description, subject: over.subject || cur.subject, language: over.language || cur.language,
      thumbnailKey: cur.thumbnailKey, demoVideo1: { source: 'youtube', url: 'https://youtu.be/abcdefgh123' }, demoVideo2: { source: 'vimeo', url: 'https://vimeo.com/123456' },
    });
  }
  await t.post(`/api/v1/teacher/courses/${c.courseId}/status`, { status: 'published' });
  const { slug } = (await t.get(`/api/v1/teacher/courses/${c.courseId}`)).body.data;
  return { ...c, slug };
}

// Recursively lists every key in a JSON value.
const keysOf = (v) => (Array.isArray(v) ? v.flatMap(keysOf) : v && typeof v === 'object' ? Object.entries(v).flatMap(([k, x]) => [k, ...keysOf(x)]) : []);

test('only published courses of active teachers are listed', async () => {
  const a = await teacher({ name: 'Asha' });
  const b = await teacher({ name: 'Blocked' });
  await published(a);
  await readyCourse(a); // draft
  await published(b);
  await query("UPDATE dbo.users SET status = 'blocked' WHERE user_id = @id", { id: T.int(b.user.user_id) });
  const res = await request(app).get('/api/v1/public/courses');
  expect(res.status).toBe(200);
  expect(res.body.pagination.total).toBe(1);
  expect(res.body.data[0]).toMatchObject({ title: 'Class 10 Maths', teacher: { name: 'Asha' }, language: 'mr', subject: 'Maths' });
  expect(res.body.data[0].thumbnailUrl).toMatch(/^\/api\/v1\/files\/thumbnail\//);
});

test('search matches title, subject or teacher in any case or script; filters work', async () => {
  const t = await teacher({ name: 'Suresh' });
  await published(t, { title: 'गणित इयत्ता 10', subject: 'Maths', language: 'mr' });
  await published(t, { title: 'English Grammar', subject: 'English', language: 'en' });
  const q = (s) => request(app).get(`/api/v1/public/courses?${s}`).then((r) => r.body.data.map((c) => c.title));
  expect(await q(`q=${encodeURIComponent('गणित')}`)).toEqual(['गणित इयत्ता 10']);
  expect(await q('q=maths')).toEqual(['गणित इयत्ता 10']);
  expect(await q('q=GRAMMAR')).toEqual(['English Grammar']);
  expect((await q('q=suresh')).length).toBe(2);
  expect(await q('language=en')).toEqual(['English Grammar']);
  const filters = await request(app).get('/api/v1/public/filters');
  expect(filters.body.data.languages.sort()).toEqual(['en', 'mr']);
  expect([...filters.body.data.subjects].sort()).toEqual(['English', 'Maths']);
  // Most courses first (ties by name), with the count for each subject.
  expect(filters.body.data.subjectCounts).toEqual([{ subject: 'English', count: 1 }, { subject: 'Maths', count: 1 }]);
  expect(filters.body.data.subjects).toEqual(['English', 'Maths']);
});

test('course details: 2 public demo videos, titles only for paid lessons, preview links for free ones, no private keys', async () => {
  const t = await teacher({ name: 'Suresh' });
  const c = await published(t);
  const videoKey = await uploadVideo(t);
  await t.post(`/api/v1/teacher/modules/${c.moduleId}/contents`, { title: 'Free lesson', type: 'video', videoSource: 'upload', fileKey: videoKey, isFreePreview: true });
  await t.post(`/api/v1/teacher/modules/${c.moduleId}/contents`, { title: 'Paid lesson', type: 'video', videoSource: 'youtube', url: 'https://youtu.be/paidpaid123' });
  await t.put('/api/v1/teacher/profile', { name: 'Suresh', bio: 'Ten years of teaching', publicSlug: 'suresh', experienceYears: 10 });
  const res = await request(app).get(`/api/v1/public/courses/${c.slug}`);
  expect(res.status).toBe(200);
  const d = res.body.data;
  expect(d.demoVideos).toHaveLength(2);
  expect(d.demoVideos[0]).toEqual({ source: 'youtube', url: 'https://youtu.be/abcdefgh123' });
  const lessons = d.curriculum[0].modules[0].contents;
  expect(lessons.find((x) => x.title === 'Paid lesson').previewUrl).toBeUndefined();
  expect(lessons.find((x) => x.title === 'Free lesson').previewUrl).toMatch(/\?exp=\d+&sig=/);
  expect(d.teacher).toMatchObject({ name: 'Suresh', slug: 'suresh', experienceYears: 10, bio: 'Ten years of teaching' });
  const keys = keysOf(d);
  for (const k of ['mobile', 'email', 'fileKey', 'file_key', 'teacher_id', 'teacherId', 'user_id']) expect(keys).not.toContain(k);
  expect(JSON.stringify(d)).not.toContain('paidpaid123');
  expect((await request(app).get('/api/v1/public/courses/no-such-course')).status).toBe(404);
});

test('teacher public page lists their published courses', async () => {
  const t = await teacher({ name: 'Suresh' });
  await published(t);
  await t.put('/api/v1/teacher/profile', { name: 'Suresh', publicSlug: 'suresh-sir' });
  const res = await request(app).get('/api/v1/public/teachers/suresh-sir');
  expect(res.body.data).toMatchObject({ name: 'Suresh', slug: 'suresh-sir' });
  expect(res.body.data.courses).toHaveLength(1);
  expect(res.body.data.mobile).toBeUndefined();
  expect((await request(app).get('/api/v1/public/teachers/nobody')).status).toBe(404);
});

describe('live demo request', () => {
  const form = (slug, mobile, otp, over = {}) => ({ courseSlug: slug, name: 'Ravi', mobile, otp, education: '10th', classStandard: '10', preferredTime: 'Evening', message: 'Please call', acceptTerms: true, whatsappOptIn: true, ...over });

  test('creates a pending request for the teacher, records consent, notifies the teacher', async () => {
    const t = await teacher({ name: 'Suresh' });
    const { slug } = await published(t);
    const otp = await sendOtp('+919822200001', 'demo_request');
    const res = await request(app).post('/api/v1/public/demo-requests').send(form(slug, '9822200001', otp));
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({ status: 'pending', teacherName: 'Suresh' });
    const row = await one('SELECT * FROM dbo.demo_requests');
    expect(row).toMatchObject({ teacher_id: t.user.user_id, status: 'pending', whatsapp_opt_in: true, mobile: '+919822200001' });
    const consents = await query("SELECT consent_type FROM dbo.legal_consents WHERE mobile = '+919822200001'");
    expect(consents.map((c) => c.consent_type).sort()).toEqual(['terms_privacy', 'whatsapp']);
    const n = await one('SELECT message FROM dbo.notifications WHERE user_id = @t', { t: T.int(t.user.user_id) });
    expect(n.message).toBe('New live demo request for Class 10 Maths from Ravi.');
  });

  test('wrong OTP, missing education or terms, unpublished course, duplicate pending', async () => {
    const t = await teacher();
    const { slug } = await published(t);
    await sendOtp('+919822200002', 'demo_request');
    expect((await request(app).post('/api/v1/public/demo-requests').send(form(slug, '9822200002', '000000'))).status).toBe(400);
    expect((await one('SELECT COUNT(*) n FROM dbo.demo_requests')).n).toBe(0);
    const otp = await sendOtp('+919822200003', 'demo_request');
    expect((await request(app).post('/api/v1/public/demo-requests').send(form(slug, '9822200003', otp, { education: '' }))).status).toBe(400);
    expect((await request(app).post('/api/v1/public/demo-requests').send(form(slug, '9822200003', otp, { acceptTerms: false }))).body.error).toBe('Accept the Terms and Privacy Policy to continue');
    expect((await request(app).post('/api/v1/public/demo-requests').send(form('missing-course', '9822200003', otp))).status).toBe(404);
    expect((await request(app).post('/api/v1/public/demo-requests').send(form(slug, '9822200003', otp))).status).toBe(201);
    const otp2 = await sendOtp('+919822200003', 'demo_request');
    const dup = await request(app).post('/api/v1/public/demo-requests').send(form(slug, '9822200003', otp2));
    expect(dup.status).toBe(409);
    expect(dup.body.error).toBe('You already have a pending demo request for this course');
  });
});
