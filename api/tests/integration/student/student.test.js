const { app, request, reset, closeAll, sendOtp, clock, createUser } = require('../../setup/helpers');
const { teacher, readyCourse } = require('../../setup/content');
const { world, asStudent, query, one, T } = require('../../setup/student');

beforeEach(reset);
afterAll(closeAll);

describe('registration and enrollment', () => {
  test('student registers with OTP and is logged in; a teacher number is refused', async () => {
    const otp = await sendOtp('+919833300001', 'student_register');
    const body = { name: 'Asha', mobile: '9833300001', otp, education: '12th Science', city: 'Pune', email: 'Asha@Gmail.com', acceptTerms: true, whatsappOptIn: true };
    const res = await request(app).post('/api/v1/auth/register-student').send(body);
    expect(res.status).toBe(201);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.user).toMatchObject({ role: 'student', status: 'approved', name: 'Asha' });
    const u = await one("SELECT user_id, whatsapp_opt_in FROM dbo.users WHERE mobile = '+919833300001'");
    expect(u.whatsapp_opt_in).toBe(true);
    expect((await one("SELECT email FROM dbo.users WHERE mobile = '+919833300001'")).email).toBe('asha@gmail.com');
    expect((await one('SELECT education FROM dbo.student_profiles WHERE user_id = @u', { u: T.int(u.user_id) })).education).toBe('12th Science');
    await createUser({ role: 'teacher', mobile: '+919833300002' });
    const otp2 = await sendOtp('+919833300002', 'student_register');
    const t = await request(app).post('/api/v1/auth/register-student').send({ ...body, mobile: '9833300002', otp: otp2 });
    expect(t.status).toBe(409);
    expect(t.body.error).toBe('This number is registered as a teacher');
    expect((await request(app).post('/api/v1/auth/register-student').send({ ...body, acceptTerms: false })).status).toBe(400);
  });

  test('the email is required to register, and must be valid', async () => {
    const otp = await sendOtp('+919833300003', 'student_register');
    const body = { name: 'Asha', mobile: '9833300003', otp, education: '12th Science', acceptTerms: true };
    expect((await request(app).post('/api/v1/auth/register-student').send(body)).status).toBe(400);
    expect((await request(app).post('/api/v1/auth/register-student').send({ ...body, email: '' })).status).toBe(400);
    expect((await request(app).post('/api/v1/auth/register-student').send({ ...body, email: 'not-an-email' })).status).toBe(400);
    expect((await one("SELECT COUNT(*) n FROM dbo.users WHERE mobile = '+919833300003'")).n).toBe(0);
    expect((await request(app).post('/api/v1/auth/register-student').send({ ...body, email: 'asha@gmail.com' })).status).toBe(201);
  });

  test('enroll request goes to the teacher; duplicates refused; can re-request after rejection', async () => {
    const t = await teacher({ name: 'Suresh' });
    const c = await readyCourse(t);
    await t.post(`/api/v1/teacher/courses/${c.courseId}/status`, { status: 'published' });
    const { slug } = (await t.get(`/api/v1/teacher/courses/${c.courseId}`)).body.data;
    const s = await asStudent(await createUser({ role: 'student', name: 'Ravi' }));
    // Enroll now always needs an email, and keeps it on the account.
    const noEmail = await s.post('/api/v1/student/enrollments', { courseSlug: slug, message: 'Morning batch please' });
    expect(noEmail.status).toBe(400);
    expect(noEmail.body).toMatchObject({ code: 'VALIDATION_ERROR', error: expect.stringContaining('email') });
    expect((await s.post('/api/v1/student/enrollments', { courseSlug: slug, email: 'not-an-email' })).status).toBe(400);
    expect((await s.get('/api/v1/student/enrollments')).body.data).toHaveLength(0);
    const r = await s.post('/api/v1/student/enrollments', { courseSlug: slug, message: 'Morning batch please', email: 'Ravi@Gmail.com' });
    expect(r.status).toBe(201);
    expect((await one('SELECT email FROM dbo.users WHERE user_id = @s', { s: T.int(s.user.user_id) })).email).toBe('ravi@gmail.com');
    expect(r.body.data).toMatchObject({ status: 'pending', course: { title: 'Class 10 Maths' } });
    expect((await one('SELECT message FROM dbo.notifications WHERE user_id = @t', { t: T.int(t.user.user_id) })).message).toBe('Ravi wants to enroll in Class 10 Maths.');
    expect((await s.post('/api/v1/student/enrollments', { courseSlug: slug })).status).toBe(400); // even with an email on the account
    expect((await s.post('/api/v1/student/enrollments', { courseSlug: slug, email: 'ravi@gmail.com' })).status).toBe(409);
    await query("UPDATE dbo.enrollments SET status = 'rejected' WHERE student_id = @s", { s: T.int(s.user.user_id) });
    expect((await s.post('/api/v1/student/enrollments', { courseSlug: slug, email: 'ravi@gmail.com' })).status).toBe(201);
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

  test('dashboard: each course has its next lesson and when it was last studied; most recent first, finished last', async () => {
    const w = await world();
    const first = (await w.s.get('/api/v1/student/dashboard')).body.data.myCourses[0];
    expect(first.lastStudiedAt).toBeNull();
    expect(first.nextLesson).toEqual({ id: w.contents[0].content_id, title: w.contents[0].title });

    await w.s.post(`/api/v1/student/contents/${w.contents[0].content_id}/progress`, { completed: true });
    const after = (await w.s.get('/api/v1/student/dashboard')).body.data.myCourses[0];
    expect(after.lastStudiedAt).toBeTruthy();
    expect(after.nextLesson).toEqual({ id: w.contents[1].content_id, title: w.contents[1].title });

    // A second course, studied more recently, comes first.
    const t2 = await teacher({ name: 'Amit' });
    const c2 = await readyCourse(t2);
    await t2.post(`/api/v1/teacher/courses/${c2.courseId}/status`, { status: 'published' });
    const b2 = (await t2.post(`/api/v1/teacher/courses/${c2.courseId}/batches`, { name: 'Weekend', startDate: '2026-01-01' })).body.data;
    const { activeEnrollment } = require('../../setup/operations');
    await activeEnrollment(c2.courseId, t2.user.user_id, w.s.user.user_id, b2.id);
    await query("UPDATE dbo.content_progress SET updated_at = DATEADD(DAY, -3, SYSUTCDATETIME()) WHERE student_id = @s", { s: T.int(w.s.user.user_id) });
    const c2Lesson = await one('SELECT content_id FROM dbo.contents WHERE course_id = @c', { c: T.int(c2.courseId) });
    await w.s.post(`/api/v1/student/contents/${c2Lesson.content_id}/progress`, { positionSec: 10 });
    let list = (await w.s.get('/api/v1/student/dashboard')).body.data.myCourses;
    expect(list.map((c) => c.courseId)).toEqual([c2.courseId, w.courseId]);

    // Finishing every lesson of course 2 moves it to the end.
    await w.s.post(`/api/v1/student/contents/${c2Lesson.content_id}/progress`, { completed: true });
    list = (await w.s.get('/api/v1/student/dashboard')).body.data.myCourses;
    expect(list.map((c) => c.courseId)).toEqual([w.courseId, c2.courseId]);
    expect(list[1]).toMatchObject({ progressPct: 100, nextLesson: null });
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

  test('attendance history is course-wise, newest first, only for my batch and held classes', async () => {
    clock.set(new Date('2026-06-15T03:00:00Z'));
    const w = await world();
    const evening = (await w.t.post(`/api/v1/teacher/courses/${w.courseId}/batches`, { name: 'Evening', startDate: '2026-01-01' })).body.data;
    const mk = async (topic, startsAt, batchId) =>
      (await w.t.post('/api/v1/teacher/live-classes', { courseId: w.courseId, ...(batchId ? { batchId } : { batchId: w.batch.id }), topic, startsAt })).body.data;
    const c1 = await mk('Algebra', '2026-06-16T03:00:00Z');
    const c2 = await mk('Geometry', '2026-06-17T03:00:00Z');
    await mk('Not held yet', '2026-06-18T03:00:00Z');
    const other = await mk('Other batch', '2026-06-19T03:00:00Z', evening.id);
    await w.t.put(`/api/v1/teacher/live-classes/${c1.id}/attendance`, { records: [{ studentPublicId: w.s.user.public_id, present: true }] });
    await w.t.put(`/api/v1/teacher/live-classes/${c2.id}/attendance`, { records: [{ studentPublicId: w.s.user.public_id, present: false }] });
    await w.t.put(`/api/v1/teacher/live-classes/${other.id}/attendance`, { records: [] });

    const r = await w.s.get('/api/v1/student/attendance');
    expect(r.status).toBe(200);
    const course = r.body.data.courses[0];
    expect(course).toMatchObject({ courseId: w.courseId, title: 'Class 10 Maths', classesHeld: 2, classesAttended: 1, attendancePct: 50 });
    expect(course.classes.map((c) => [c.topic, c.present])).toEqual([['Geometry', false], ['Algebra', true]]);
    expect(course.classes[0]).toHaveProperty('startsAt');
  });

  test('joining a live class marks the student present automatically', async () => {
    clock.set(new Date('2026-06-15T03:00:00Z'));
    const w = await world();
    const evening = (await w.t.post(`/api/v1/teacher/courses/${w.courseId}/batches`, { name: 'Evening', startDate: '2026-01-01' })).body.data;
    const link = 'https://meet.google.com/abc-defg-hij';
    const lc = (await w.t.post('/api/v1/teacher/live-classes', { courseId: w.courseId, topic: 'Algebra', startsAt: '2026-06-15T04:00:00Z', meetLink: link })).body.data;
    const other = (await w.t.post('/api/v1/teacher/live-classes', { courseId: w.courseId, batchId: evening.id, topic: 'Not mine', startsAt: '2026-06-15T04:00:00Z', meetLink: link })).body.data;
    // Too early: outside the join window, nothing is recorded.
    const early = await w.s.post(`/api/v1/student/live-classes/${lc.id}/join`, {});
    expect(early.status).toBe(409);
    expect(early.body.code).toBe('NOT_JOINABLE');
    clock.set(new Date('2026-06-15T04:05:00Z'));
    const res = await w.s.post(`/api/v1/student/live-classes/${lc.id}/join`, {});
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ meetLink: link, present: true });
    // Joining again (rejoin after a drop) is fine and keeps one record.
    expect((await w.s.post(`/api/v1/student/live-classes/${lc.id}/join`, {})).status).toBe(200);
    const rows = await query('SELECT present FROM dbo.attendance WHERE live_class_id = @l', { l: T.int(lc.id) });
    expect(rows).toEqual([{ present: true }]);
    // The teacher's sheet already shows the student present.
    const sheet = (await w.t.get(`/api/v1/teacher/live-classes/${lc.id}/attendance`)).body.data;
    expect(sheet.find((s) => s.studentPublicId === w.s.user.public_id).present).toBe(true);
    // A class for another batch is not found for this student.
    expect((await w.s.post(`/api/v1/student/live-classes/${other.id}/join`, {})).status).toBe(404);
    const p = await w.s.get('/api/v1/student/progress');
    expect(p.body.data.courses[0]).toMatchObject({ attendancePct: 100, classesHeld: 1 });
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

// Review Focus (Phase 7 #2): access that ends today lasts until midnight IST, not midnight UTC.
test('a subscription ending today keeps access until the end of the day in IST', async () => {
  const w = await world({ enrollOpts: { start: '2026-01-01', end: '2026-06-15' } });
  const lesson = `/api/v1/student/contents/${w.contents[0].content_id}`;
  clock.set(new Date('2026-06-15T18:00:00Z')); // 23:30 IST on the last day
  expect((await w.s.get(lesson)).status).toBe(200);
  clock.set(new Date('2026-06-15T18:29:00Z')); // 23:59 IST
  expect((await w.s.get(lesson)).status).toBe(200);
  clock.set(new Date('2026-06-15T18:31:00Z')); // 00:01 IST on the 16th
  const after = await w.s.get(lesson);
  expect(after.status).toBe(403);
  expect(after.body.code).toBe('ACCESS_ENDED');
});
