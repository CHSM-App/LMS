const { reset, closeAll, clock, asUser } = require('../../setup/helpers');
const { teacher, readyCourse } = require('../../setup/content');
const { demoRequest, student, enrollment, activeEnrollment, query, one, T } = require('../../setup/operations');
const whatsapp = require('../../../src/providers/whatsapp');
const studentCount = require('../../../src/services/studentCount.service');

beforeEach(async () => {
  await reset();
  whatsapp.clearSent();
  process.env.MEET_PROVIDER = 'console';
});
afterAll(closeAll);

async function setup() {
  const t = await teacher({ name: 'Suresh' });
  const c = await readyCourse(t);
  const batch = (await t.post(`/api/v1/teacher/courses/${c.courseId}/batches`, { name: 'Morning', startDate: '2026-01-01', maxStudents: 2 })).body.data;
  return { t, ...c, batch };
}

describe('demo requests', () => {
  test('schedule generates a Meet link; WhatsApp sends to opted-in students', async () => {
    const { t, courseId } = await setup();
    const d = await demoRequest(courseId, t.user.user_id, { name: 'Asha' });
    await query("UPDATE dbo.demo_requests SET whatsapp_opt_in = 1 WHERE demo_request_id = @id", { id: T.int(d.demo_request_id) });
    const past = await t.post(`/api/v1/teacher/demo-requests/${d.demo_request_id}/schedule`, { scheduledAt: '2020-01-01T10:00:00Z' });
    expect(past.status).toBe(400);
    const s = await t.post(`/api/v1/teacher/demo-requests/${d.demo_request_id}/schedule`, { scheduledAt: '2099-05-01T04:30:00Z' });
    expect(s.status).toBe(200);
    expect(s.body.data).toMatchObject({ status: 'scheduled' });
    expect(s.body.data.meetLink).toMatch(/^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/);
    const w = await t.post(`/api/v1/teacher/demo-requests/${d.demo_request_id}/send-whatsapp`);
    expect(w.status).toBe(200);
    expect(whatsapp.sentMessages()[0].text).toContain(s.body.data.meetLink);
    expect((await one('SELECT whatsapp_sent_at FROM dbo.demo_requests WHERE demo_request_id = @id', { id: T.int(d.demo_request_id) })).whatsapp_sent_at).toBeTruthy();
  });

  test('pasted link must be a Meet link; manual provider needs one', async () => {
    const { t, courseId } = await setup();
    const d = await demoRequest(courseId, t.user.user_id);
    expect((await t.post(`/api/v1/teacher/demo-requests/${d.demo_request_id}/schedule`, { scheduledAt: '2099-05-01T04:30:00Z', meetLink: 'https://zoom.us/j/1' })).status).toBe(400);
    process.env.MEET_PROVIDER = 'manual';
    const r = await t.post(`/api/v1/teacher/demo-requests/${d.demo_request_id}/schedule`, { scheduledAt: '2099-05-01T04:30:00Z' });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('Paste a Meet link');
    const ok = await t.post(`/api/v1/teacher/demo-requests/${d.demo_request_id}/schedule`, { scheduledAt: '2099-05-01T04:30:00Z', meetLink: 'https://meet.google.com/abc-defg-hij' });
    expect(ok.body.data.meetLink).toBe('https://meet.google.com/abc-defg-hij');
  });

  test('WhatsApp without opt-in or on provider failure returns a wa.me fallback', async () => {
    const { t, courseId } = await setup();
    const d = await demoRequest(courseId, t.user.user_id);
    await t.post(`/api/v1/teacher/demo-requests/${d.demo_request_id}/schedule`, { scheduledAt: '2099-05-01T04:30:00Z' });
    const noOptIn = await t.post(`/api/v1/teacher/demo-requests/${d.demo_request_id}/send-whatsapp`);
    expect(noOptIn.status).toBe(409);
    expect(noOptIn.body.error).toBe("This student hasn't agreed to WhatsApp messages");
    expect(noOptIn.body.details.fallbackUrl).toMatch(/^https:\/\/wa\.me\/919811100001\?text=/);
    await query('UPDATE dbo.demo_requests SET whatsapp_opt_in = 1 WHERE demo_request_id = @id', { id: T.int(d.demo_request_id) });
    const spy = jest.spyOn(whatsapp, 'send').mockRejectedValueOnce(new Error('provider down'));
    const fail = await t.post(`/api/v1/teacher/demo-requests/${d.demo_request_id}/send-whatsapp`);
    expect(fail.status).toBe(502);
    expect(fail.body.error).toBe('WhatsApp message not sent. Try again.');
    expect(fail.body.details.fallbackUrl).toBeTruthy();
    const row = await one('SELECT status, whatsapp_error FROM dbo.demo_requests WHERE demo_request_id = @id', { id: T.int(d.demo_request_id) });
    expect(row).toMatchObject({ status: 'scheduled', whatsapp_error: 'provider down' });
    spy.mockRestore();
    expect((await t.post(`/api/v1/teacher/demo-requests/${d.demo_request_id}/send-whatsapp`)).status).toBe(200);
  });

  test('list, reject, complete and ownership', async () => {
    const { t, courseId } = await setup();
    const d = await demoRequest(courseId, t.user.user_id);
    expect((await t.get('/api/v1/teacher/demo-requests?status=pending')).body.data).toHaveLength(1);
    const other = await teacher({ name: 'Other' });
    expect((await other.post(`/api/v1/teacher/demo-requests/${d.demo_request_id}/reject`)).status).toBe(404);
    expect((await t.post(`/api/v1/teacher/demo-requests/${d.demo_request_id}/reject`)).body.data.status).toBe('rejected');
  });
});

describe('enrollments and access', () => {
  test('approve needs an open batch with space, creates access and notifies', async () => {
    const { t, courseId, batch } = await setup();
    const s1 = await student({ name: 'Ravi' });
    const e1 = await enrollment(courseId, t.user.user_id, s1.user_id);
    const body = { batchId: batch.id, startDate: '2026-01-01', endDate: '2026-12-31' };
    expect((await t.post(`/api/v1/teacher/enrollments/${e1.enrollment_id}/approve`, { ...body, batchId: undefined })).status).toBe(400);
    expect((await t.post(`/api/v1/teacher/enrollments/${e1.enrollment_id}/approve`, { ...body, endDate: '2025-01-01' })).status).toBe(400);
    const [a, b] = await Promise.all([
      t.post(`/api/v1/teacher/enrollments/${e1.enrollment_id}/approve`, body),
      t.post(`/api/v1/teacher/enrollments/${e1.enrollment_id}/approve`, body),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect((await one('SELECT COUNT(*) n FROM dbo.student_subscriptions WHERE enrollment_id = @e', { e: T.int(e1.enrollment_id) })).n).toBe(1);
    const note = await one('SELECT message FROM dbo.notifications WHERE user_id = @u', { u: T.int(s1.user_id) });
    expect(note.message).toBe("You're enrolled in Class 10 Maths (Morning).");
    // full batch (max 2)
    const s2 = await student();
    await activeEnrollment(courseId, t.user.user_id, s2.user_id, batch.id);
    const s3 = await student();
    const e3 = await enrollment(courseId, t.user.user_id, s3.user_id);
    const full = await t.post(`/api/v1/teacher/enrollments/${e3.enrollment_id}/approve`, body);
    expect(full.status).toBe(409);
    expect(full.body.error).toBe('This batch is full (2 students)');
    await t.put(`/api/v1/teacher/batches/${batch.id}`, { name: 'Morning', startDate: '2026-01-01', status: 'closed' });
    expect((await t.post(`/api/v1/teacher/enrollments/${e3.enrollment_id}/approve`, body)).body.error).toBe('This batch is closed');
  });

  test('reject needs a reason; limited mode blocks approval', async () => {
    const { t, courseId, batch } = await setup();
    const s = await student();
    const e = await enrollment(courseId, t.user.user_id, s.user_id);
    expect((await t.post(`/api/v1/teacher/enrollments/${e.enrollment_id}/reject`, {})).status).toBe(400);
    await query('UPDATE dbo.teacher_subscriptions SET end_date = \'2021-01-01\', start_date = \'2020-01-01\' WHERE teacher_id = @t', { t: T.int(t.user.user_id) });
    const r = await t.post(`/api/v1/teacher/enrollments/${e.enrollment_id}/approve`, { batchId: batch.id, startDate: '2026-01-01', endDate: '2026-12-31' });
    expect(r.status).toBe(403);
    expect(r.body.code).toBe('TEACHER_SUBSCRIPTION_EXPIRED');
    expect((await t.post(`/api/v1/teacher/enrollments/${e.enrollment_id}/reject`, { reason: 'Batch is full this year' })).body.data.status).toBe('rejected');
  });

  test('move batch, student list, access pause and requireActiveEnrollment', async () => {
    clock.set(new Date('2026-06-15T06:00:00Z'));
    const { t, courseId, batch } = await setup();
    const evening = (await t.post(`/api/v1/teacher/courses/${courseId}/batches`, { name: 'Evening', startDate: '2026-01-01' })).body.data;
    const s = await student({ name: 'Meera' });
    const e = await activeEnrollment(courseId, t.user.user_id, s.user_id, batch.id, { start: '2026-01-01', end: '2026-06-15' });
    expect((await t.put(`/api/v1/teacher/enrollments/${e.enrollment_id}/batch`, { batchId: evening.id })).status).toBe(200);
    const list = await t.get(`/api/v1/teacher/students?course=${courseId}`);
    expect(list.body.data[0]).toMatchObject({ name: 'Meera', batch: { id: evening.id, name: 'Evening' }, subscriptionStatus: 'active' });
    expect(list.body.data[0].mobile).toMatch(/^\+91/);
    const { requireActiveEnrollment } = require('../../../src/middlewares/enrollment');
    const check = async () => {
      const next = jest.fn();
      await requireActiveEnrollment({ user: { id: s.user_id }, params: { courseId: String(courseId) } }, {}, next);
      return next.mock.calls[0][0];
    };
    expect(await check()).toBeUndefined();
    clock.set(new Date('2026-06-16T06:00:00Z'));
    expect((await check()).message).toBe('Your access to this course has ended');
    clock.set(new Date('2026-06-15T06:00:00Z'));
    await t.put(`/api/v1/teacher/students/${s.public_id}/access/${courseId}`, { startDate: '2026-01-01', endDate: '2026-12-31', accessEnabled: false });
    expect((await check()).message).toBe('Your access to this course is paused');
  });

  test('student count only counts approved, active, current access', async () => {
    const { t, courseId, batch } = await setup();
    await activeEnrollment(courseId, t.user.user_id, (await student()).user_id, batch.id);
    await activeEnrollment(courseId, t.user.user_id, (await student()).user_id, null);
    await enrollment(courseId, t.user.user_id, (await student()).user_id);
    await activeEnrollment(courseId, t.user.user_id, (await student()).user_id, null, { start: '2020-01-01', end: '2020-12-31' });
    await activeEnrollment(courseId, t.user.user_id, (await student()).user_id, null, { access: false });
    const counts = await studentCount.countActiveByTeacher([t.user.user_id]);
    expect(counts.get(t.user.user_id)).toBe(2);
    const admin = await asUser({ role: 'admin' });
    const row = (await admin.get('/api/v1/admin/teachers')).body.data.find((r) => r.name === 'Suresh');
    expect(row.studentCount).toBe(2);
  });
});

describe('live classes and attendance', () => {
  test('batch-targeted class notifies only that batch; attendance upserts; reminder once', async () => {
    clock.set(new Date('2026-06-15T03:00:00Z'));
    const { t, courseId, batch } = await setup();
    const evening = (await t.post(`/api/v1/teacher/courses/${courseId}/batches`, { name: 'Evening', startDate: '2026-01-01' })).body.data;
    const a = await student({ name: 'A' });
    const b = await student({ name: 'B' });
    const outsider = await student({ name: 'Out' });
    await activeEnrollment(courseId, t.user.user_id, a.user_id, batch.id);
    await activeEnrollment(courseId, t.user.user_id, b.user_id, evening.id);
    const lc = await t.post('/api/v1/teacher/live-classes', { courseId, batchId: batch.id, topic: 'Algebra revision', startsAt: '2026-06-15T03:20:00Z', durationMin: 60 });
    expect(lc.status).toBe(201);
    expect(lc.body.data).toMatchObject({ meetLink: null, needsMeetLink: true }); // no fake link; the teacher adds it
    expect(await one('SELECT COUNT(*) n FROM dbo.notifications WHERE user_id = @u', { u: T.int(a.user_id) })).toEqual({ n: 1 });
    expect(await one('SELECT COUNT(*) n FROM dbo.notifications WHERE user_id = @u', { u: T.int(b.user_id) })).toEqual({ n: 0 });
    const sheet = await t.get(`/api/v1/teacher/live-classes/${lc.body.data.id}/attendance`);
    expect(sheet.body.data.map((r) => r.name)).toEqual(['A']);
    const mark = [{ studentPublicId: a.public_id, present: true }];
    expect((await t.put(`/api/v1/teacher/live-classes/${lc.body.data.id}/attendance`, { records: mark })).status).toBe(200);
    await t.put(`/api/v1/teacher/live-classes/${lc.body.data.id}/attendance`, { records: [{ studentPublicId: a.public_id, present: false }] });
    expect(await one('SELECT COUNT(*) n, MAX(CAST(present AS INT)) p FROM dbo.attendance')).toEqual({ n: 1, p: 0 });
    const bad = await t.put(`/api/v1/teacher/live-classes/${lc.body.data.id}/attendance`, { records: [{ studentPublicId: outsider.public_id, present: true }] });
    expect(bad.status).toBe(400);
    const { runLiveClassReminders } = require('../../../src/services/liveClass.service');
    expect(await runLiveClassReminders()).toBe(1);
    expect(await runLiveClassReminders()).toBe(0);
  });
});

describe('doubts, programs and profile', () => {
  test('reply answers the doubt, notifies the student and strips scripts', async () => {
    const { t, courseId } = await setup();
    const s = await student({ name: 'Kiran' });
    const d = await one(
      "INSERT INTO dbo.doubts (student_id, course_id, question, status) OUTPUT INSERTED.* VALUES (@s, @c, N'How to factorise?', 'open')",
      { s: T.int(s.user_id), c: T.int(courseId) },
    );
    expect((await t.get('/api/v1/teacher/doubts?status=open')).body.data[0]).toMatchObject({ question: 'How to factorise?', student: { name: 'Kiran' } });
    expect((await t.post(`/api/v1/teacher/doubts/${d.doubt_id}/reply`, { reply: 'x'.repeat(2001) })).status).toBe(400);
    const r = await t.post(`/api/v1/teacher/doubts/${d.doubt_id}/reply`, { reply: 'Take the common factor first <script>alert(1)</script>' });
    expect(r.body.data).toMatchObject({ status: 'answered', reply: 'Take the common factor first ' });
    expect(await one('SELECT COUNT(*) n FROM dbo.notifications WHERE user_id = @u', { u: T.int(s.user_id) })).toEqual({ n: 1 });
  });

  test('programs CRUD; profile slug rules and sanitized bio', async () => {
    const { t, courseId, batch } = await setup();
    const p = await t.post('/api/v1/teacher/programs', { title: 'Revision camp', startsAt: '2026-07-01T04:00:00Z', courseId, batchId: batch.id });
    expect(p.status).toBe(201);
    expect((await t.get('/api/v1/teacher/programs')).body.data).toHaveLength(1);
    expect((await t.del(`/api/v1/teacher/programs/${p.body.data.id}`)).status).toBe(200);
    expect((await t.put('/api/v1/teacher/profile', { name: 'Suresh Patil', publicSlug: 'Bad Slug!' })).status).toBe(400);
    const ok = await t.put('/api/v1/teacher/profile', { name: 'Suresh Patil', publicSlug: 'suresh-patil', bio: '<b>10 years</b><img src=x onerror=alert(1)>', subjects: 'Maths, Science', experienceYears: 10 });
    expect(ok.status).toBe(200);
    expect(ok.body.data.bio).toBe('<b>10 years</b><img src="x">');
    const other = await teacher({ name: 'Other' });
    expect((await other.put('/api/v1/teacher/profile', { name: 'Other', publicSlug: 'suresh-patil' })).status).toBe(409);
  });

  test('dashboard tiles', async () => {
    const { t, courseId, batch } = await setup();
    await demoRequest(courseId, t.user.user_id);
    await enrollment(courseId, t.user.user_id, (await student()).user_id);
    await activeEnrollment(courseId, t.user.user_id, (await student()).user_id, batch.id);
    const d = await t.get('/api/v1/teacher/dashboard');
    expect(d.body.data).toMatchObject({ pendingDemoRequests: 1, pendingEnrollments: 1, openDoubts: 0, activeStudents: 1, todaysClasses: [] });
  });

  test("dashboard today's classes drop a class once it has ended, so the next one moves up", async () => {
    const { t, courseId } = await setup();
    clock.set(new Date('2026-06-15T05:00:00Z'));
    await t.post('/api/v1/teacher/live-classes', { courseId, topic: 'Noon', startsAt: '2026-06-15T06:30:00Z', durationMin: 60 });
    await t.post('/api/v1/teacher/live-classes', { courseId, topic: 'Evening', startsAt: '2026-06-15T13:42:00Z', durationMin: 60 });
    const topics = async () => (await t.get('/api/v1/teacher/dashboard')).body.data.todaysClasses.map((c) => c.topic);
    expect(await topics()).toEqual(['Noon', 'Evening']);
    clock.set(new Date('2026-06-15T07:00:00Z'));
    expect(await topics()).toEqual(['Noon', 'Evening']);
    clock.set(new Date('2026-06-15T07:31:00Z'));
    expect(await topics()).toEqual(['Evening']);
    clock.set(new Date('2026-06-15T14:43:00Z'));
    expect(await topics()).toEqual([]);
  });
});
