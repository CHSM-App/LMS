const { app, request, reset, closeAll, sendOtp, clock, createUser } = require('../../setup/helpers');
const { teacher, readyCourse } = require('../../setup/content');
const { world, asStudent, query, one, T } = require('../../setup/student');

beforeEach(reset);
afterAll(closeAll);

describe('registration and enrollment', () => {
  test('student registers with OTP and is logged in; a teacher number is refused', async () => {
    const otp = await sendOtp('+919833300001', 'student_register');
    const body = { name: 'Asha', mobile: '9833300001', otp, education: '12th Science', city: 'Pune', acceptTerms: true, whatsappOptIn: true };
    const res = await request(app).post('/api/v1/auth/register-student').send(body);
    expect(res.status).toBe(201);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.user).toMatchObject({ role: 'student', status: 'approved', name: 'Asha' });
    const u = await one("SELECT user_id, whatsapp_opt_in FROM dbo.users WHERE mobile = '+919833300001'");
    expect(u.whatsapp_opt_in).toBe(true);
    expect((await one('SELECT education FROM dbo.student_profiles WHERE user_id = @u', { u: T.int(u.user_id) })).education).toBe('12th Science');
    await createUser({ role: 'teacher', mobile: '+919833300002' });
    const otp2 = await sendOtp('+919833300002', 'student_register');
    const t = await request(app).post('/api/v1/auth/register-student').send({ ...body, mobile: '9833300002', otp: otp2 });
    expect(t.status).toBe(409);
    expect(t.body.error).toBe('This number is registered as a teacher');
    expect((await request(app).post('/api/v1/auth/register-student').send({ ...body, acceptTerms: false })).status).toBe(400);
  });

  test('enroll request goes to the teacher; duplicates refused; can re-request after rejection', async () => {
    const t = await teacher({ name: 'Suresh' });
    const c = await readyCourse(t);
    await t.post(`/api/v1/teacher/courses/${c.courseId}/status`, { status: 'published' });
    const { slug } = (await t.get(`/api/v1/teacher/courses/${c.courseId}`)).body.data;
    const s = await asStudent(await createUser({ role: 'student', name: 'Ravi' }));
    const r = await s.post('/api/v1/student/enrollments', { courseSlug: slug, message: 'Morning batch please' });
    expect(r.status).toBe(201);
    expect(r.body.data).toMatchObject({ status: 'pending', course: { title: 'Class 10 Maths' } });
    expect((await one('SELECT message FROM dbo.notifications WHERE user_id = @t', { t: T.int(t.user.user_id) })).message).toBe('Ravi wants to enroll in Class 10 Maths.');
    expect((await s.post('/api/v1/student/enrollments', { courseSlug: slug })).status).toBe(409);
    await query("UPDATE dbo.enrollments SET status = 'rejected' WHERE student_id = @s", { s: T.int(s.user.user_id) });
    expect((await s.post('/api/v1/student/enrollments', { courseSlug: slug })).status).toBe(201);
    expect((await s.get('/api/v1/student/enrollments')).body.data[0].status).toBe('pending');
  });
});

describe('dashboard, player and progress', () => {
  test('dashboard lists approved courses with progress, end date and batch', async () => {
    const w = await world();
    const pending = await asStudent(await createUser({ role: 'student' }));
    const d = await w.s.get('/api/v1/student/dashboard');
    expect(d.status).toBe(200);
    expect(d.body.data.myCourses).toHaveLength(1);
    expect(d.body.data.myCourses[0]).toMatchObject({ title: 'Class 10 Maths', teacher: 'Suresh', batch: 'Morning', progressPct: 0, endDate: '2099-12-31', readOnly: false });
    expect((await pending.get('/api/v1/student/dashboard')).body.data.myCourses).toHaveLength(0);
  });

  test('completing lessons updates progress once; position is remembered', async () => {
    const w = await world();
    const [first] = w.contents;
    await w.s.post(`/api/v1/student/contents/${first.content_id}/progress`, { completed: true });
    await w.s.post(`/api/v1/student/contents/${first.content_id}/progress`, { completed: true });
    await w.s.post(`/api/v1/student/contents/${w.video.id}/progress`, { positionSec: 95 });
    const course = await w.s.get(`/api/v1/student/courses/${w.courseId}`);
    expect(course.body.data.progressPct).toBe(33);
    const v = await w.s.get(`/api/v1/student/contents/${w.video.id}`);
    expect(v.body.data).toMatchObject({ type: 'video', videoSource: 'upload', lastPositionSec: 95, downloadable: true });
    expect(v.body.data.url).toMatch(/\?exp=\d+&sig=/);
    const pdf = await w.s.get(`/api/v1/student/contents/${w.pdf.id}`);
    expect(pdf.body.data.url).toMatch(/^\/api\/v1\/files\/pdf\//);
  });

  test('a course the student is not enrolled in is refused', async () => {
    const w = await world();
    const other = await asStudent(await createUser({ role: 'student' }));
    expect((await other.get(`/api/v1/student/courses/${w.courseId}`)).status).toBe(403);
    expect((await other.get(`/api/v1/student/contents/${w.video.id}`)).status).toBe(403);
  });

  test('ended access is refused', async () => {
    const w = await world({ enrollOpts: { start: '2020-01-01', end: '2020-12-31' } });
    const r = await w.s.get(`/api/v1/student/courses/${w.courseId}`);
    expect(r.status).toBe(403);
    expect(r.body.error).toBe('Your access to this course has ended');
  });

  test('blocked teacher: completed lessons stay readable, everything else is read-only', async () => {
    const w = await world();
    const [done] = w.contents;
    await w.s.post(`/api/v1/student/contents/${done.content_id}/progress`, { completed: true });
    await query("UPDATE dbo.users SET status = 'blocked' WHERE user_id = @t", { t: T.int(w.t.user.user_id) });
    const d = await w.s.get('/api/v1/student/dashboard');
    expect(d.body.data.myCourses[0].readOnly).toBe(true);
    expect((await w.s.get(`/api/v1/student/contents/${done.content_id}`)).status).toBe(200);
    const locked = await w.s.get(`/api/v1/student/contents/${w.video.id}`);
    expect(locked.status).toBe(403);
    expect(locked.body.error).toBe("This course is read-only because the teacher's account is inactive");
    expect((await w.s.post(`/api/v1/student/contents/${done.content_id}/progress`, { positionSec: 5 })).status).toBe(403);
    expect((await w.s.post('/api/v1/student/doubts', { courseId: w.courseId, question: 'Help?' })).status).toBe(403);
  });
});

describe('doubts, live classes, progress, profile, privacy', () => {
  test('student asks a doubt (with attachment) and sees only their own', async () => {
    const w = await world();
    const PNG = Buffer.from('89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000A49444154789C6300010000050001', 'hex');
    const r = await w.s.attach('/api/v1/student/doubts', { courseId: String(w.courseId), question: 'How do I factorise?' }, { buffer: PNG, name: 'q.png' });
    expect(r.status).toBe(201);
    const other = await asStudent(await createUser({ role: 'student' }));
    expect((await other.get('/api/v1/student/doubts')).body.data).toHaveLength(0);
    const mine = await w.s.get('/api/v1/student/doubts');
    expect(mine.body.data[0]).toMatchObject({ question: 'How do I factorise?', status: 'open' });
    expect(mine.body.data[0].attachmentUrl).toMatch(/\?exp=/);
  });

  test('live classes: only my batch or all-batch classes; progress shows attendance %', async () => {
    clock.set(new Date('2026-06-15T03:00:00Z'));
    const w = await world();
    const evening = (await w.t.post(`/api/v1/teacher/courses/${w.courseId}/batches`, { name: 'Evening', startDate: '2026-01-01' })).body.data;
    const mine = (await w.t.post('/api/v1/teacher/live-classes', { courseId: w.courseId, batchId: w.batch.id, topic: 'Mine', startsAt: '2026-06-16T03:00:00Z' })).body.data;
    await w.t.post('/api/v1/teacher/live-classes', { courseId: w.courseId, topic: 'Everyone', startsAt: '2026-06-17T03:00:00Z' });
    await w.t.post('/api/v1/teacher/live-classes', { courseId: w.courseId, batchId: evening.id, topic: 'Not mine', startsAt: '2026-06-18T03:00:00Z' });
    const lc = await w.s.get('/api/v1/student/live-classes');
    expect(lc.body.data.map((x) => x.topic)).toEqual(['Mine', 'Everyone']);
    await w.t.put(`/api/v1/teacher/live-classes/${mine.id}/attendance`, { records: [{ studentPublicId: w.s.user.public_id, present: true }] });
    const p = await w.s.get('/api/v1/student/progress');
    expect(p.body.data.courses[0]).toMatchObject({ title: 'Class 10 Maths', attendancePct: 100, classesHeld: 1, completedLessons: 0, totalLessons: 3 });
  });

  test('profile update; no student endpoint exposes another student\'s mobile', async () => {
    const w = await world();
    const res = await w.s.put('/api/v1/student/profile', { name: 'Meera K', education: 'B.Sc', classStandard: 'FY', city: 'Nashik', preferredLang: 'mr' });
    expect(res.body.data).toMatchObject({ name: 'Meera K', education: 'B.Sc', preferredLang: 'mr' });
    const classmate = await createUser({ role: 'student', mobile: '+919876512345' });
    const { activeEnrollment } = require('../../setup/operations');
    await activeEnrollment(w.courseId, w.t.user.user_id, classmate.user_id, w.batch.id);
    for (const url of ['/api/v1/student/dashboard', `/api/v1/student/courses/${w.courseId}`, '/api/v1/student/live-classes', '/api/v1/student/progress', '/api/v1/student/doubts']) {
      const body = JSON.stringify((await w.s.get(url)).body);
      expect(body).not.toContain('+919876512345');
    }
  });
});
