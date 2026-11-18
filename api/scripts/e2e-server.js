// End-to-end test API (Playwright). NEVER for production.
// - Uses ONLY the test database from api/.env.test (DB_TEST_NAME) and wipes it on start.
// - Console OTP/WhatsApp/Meet providers; test hooks under /api/v1/__e2e/* exist only in this process.
// Usage: node scripts/e2e-server.js   (port E2E_API_PORT, default 4100)
require('../tests/setup/env'); // loads .env then .env.test; throws without DB_TEST_NAME; NODE_ENV=test

if (!/test/i.test(process.env.DB_NAME || '') || process.env.NODE_ENV !== 'test') {
  throw new Error('e2e-server refuses to run outside NODE_ENV=test with a *test* database');
}
process.env.OTP_PROVIDER = 'console';
process.env.WHATSAPP_PROVIDER = 'console';
process.env.MEET_PROVIDER = 'console';
const PORT = Number(process.env.E2E_API_PORT || 4100);
process.env.WEB_ORIGIN = process.env.E2E_WEB_ORIGIN || 'http://localhost:4173';

const express = require('express');
const { createApp } = require('../src/app');
const { resetTestDb, truncateAll } = require('../tests/setup/testDb');
const { createUser, query, one, T, clock } = require('../tests/setup/helpers');
const { teacher } = require('../tests/setup/content');
const { world } = require('../tests/setup/student');
const otp = require('../src/providers/otp/console');
const whatsapp = require('../src/providers/whatsapp');

const ADMIN = { mobile: '+919000000001', name: 'Asha Admin' };

async function seed() {
  clock.reset();
  await truncateAll();
  otp.clear();
  whatsapp.clearSent();
  await createUser({ role: 'admin', name: ADMIN.name, mobile: ADMIN.mobile });
}

const mcq = (n) => ({
  type: 'mcq', text: `What is ${n} + ${n}?`, difficulty: 'easy', marks: 1, negativeMarks: 0, explanation: `${n} + ${n} = ${n * 2}`,
  options: [{ text: String(n * 2), isCorrect: true }, { text: String(n * 2 + 1), isCorrect: false }],
});

function hooks(app) {
  const r = express.Router();
  const h = (fn) => (req, res) => Promise.resolve(fn(req)).then((data) => res.json({ success: true, data })).catch((e) => res.status(500).json({ success: false, error: e.message }));

  r.post('/reset', h(async () => {
    await seed();
    return { admin: ADMIN };
  }));
  r.get('/otp', h((req) => ({ code: otp.lastCode(req.query.mobile, req.query.purpose) || null })));
  r.get('/whatsapp', h(() => whatsapp.sentMessages()));

  // An approved teacher with an active subscription (for the course-building flow).
  r.post('/teacher', h(async () => {
    const t = await teacher({ name: 'Suresh Patil' });
    return { mobile: t.user.mobile, name: t.user.name };
  }));

  // Published course (video, notes, link) + batch + enrolled student + a published 4-question unit test.
  r.post('/world', h(async () => {
    const w = await world();
    for (let i = 1; i <= 4; i += 1) await w.t.post(`/api/v1/teacher/modules/${w.moduleId}/questions`, mcq(i));
    const exam = (await w.t.post(`/api/v1/teacher/courses/${w.courseId}/exams`, {
      title: 'Unit Test 1', scope: 'module', moduleIds: [w.moduleId], mode: 'mock', selection: 'random', randomMix: [{ moduleId: w.moduleId, easy: 4, medium: 0, hard: 0 }],
      category: 'unit_test_1', weightage: 20, negativeMarking: false, timeLimitMin: 15, passingPct: 50, shuffleQuestions: false, shuffleOptions: false, attemptLimit: 2, batchIds: [],
    })).body.data;
    const pub = await w.t.post(`/api/v1/teacher/exams/${exam.id}/publish`);
    if (pub.status !== 200) throw new Error(`publish exam: ${JSON.stringify(pub.body)}`);
    const tu = await one('SELECT public_id, mobile, name FROM dbo.users WHERE user_id = @id', { id: T.int(w.t.user.user_id) });
    return {
      slug: w.slug, courseId: w.courseId, examId: exam.id,
      teacher: { mobile: tu.mobile, name: tu.name, publicId: tu.public_id },
      student: { mobile: w.s.user.mobile, name: w.s.user.name },
    };
  }));

  // Server clock (exam deadlines, auto-submit). Only moves forward; /reset puts it back.
  r.post('/clock', h((req) => {
    clock.advance(Number(req.query.ms || 0));
    return { now: clock.now().toISOString() };
  }));

  // Run a scheduled job now.
  r.post('/jobs/:name', h(async (req) => {
    const jobs = {
      'exam-auto-submit': () => require('../src/services/attempt.service').runAutoSubmit(),
      'live-class-reminders': () => require('../src/services/liveClass.service').runLiveClassReminders(),
      'subscription-reminders': () => require('../src/services/teacherSubscription.service').runSubscriptionReminders(),
    };
    if (!jobs[req.params.name]) throw new Error('unknown job');
    return { ran: await jobs[req.params.name]() };
  }));

  // world + UT1 (25%), UT2 (25%), Final (50%) mock exams of 2 questions each, 10 minutes, unlimited attempts.
  r.post('/world-exams', h(async (req) => {
    const w = await world();
    if (req.query.title) await query('UPDATE dbo.courses SET title = @t WHERE course_id = @c', { t: T.nvarchar(req.query.title, 200), c: T.int(w.courseId) });
    for (let i = 1; i <= 4; i += 1) await w.t.post(`/api/v1/teacher/modules/${w.moduleId}/questions`, mcq(i));
    const make = async (title, category, weightage) => {
      const e = (await w.t.post(`/api/v1/teacher/courses/${w.courseId}/exams`, {
        title, scope: 'module', moduleIds: [w.moduleId], mode: 'mock', selection: 'random', randomMix: [{ moduleId: w.moduleId, easy: 2, medium: 0, hard: 0 }],
        category, weightage, negativeMarking: false, timeLimitMin: 10, passingPct: 40, shuffleQuestions: false, shuffleOptions: false, attemptLimit: null, batchIds: [],
      })).body.data;
      const pub = await w.t.post(`/api/v1/teacher/exams/${e.id}/publish`);
      if (pub.status !== 200) throw new Error(`publish ${title}: ${JSON.stringify(pub.body)}`);
      return e.id;
    };
    const ut1 = await make('Unit Test 1', 'unit_test_1', 25);
    const ut2 = await make('Unit Test 2', 'unit_test_2', 25);
    const final = await make('Final Exam', 'final', 50);
    const tu = await one('SELECT mobile, name FROM dbo.users WHERE user_id = @id', { id: T.int(w.t.user.user_id) });
    return { slug: w.slug, courseId: w.courseId, exams: { ut1, ut2, final }, teacher: { mobile: tu.mobile, name: tu.name }, student: { mobile: w.s.user.mobile, name: w.s.user.name } };
  }));

  // world + a second student waiting for approval + a doubt from the enrolled student.
  r.post('/ops-world', h(async () => {
    const w = await world();
    await query('UPDATE dbo.users SET whatsapp_opt_in = 1 WHERE user_id = @id', { id: T.int(w.s.user.user_id) });
    const waiting = await createUser({ role: 'student', name: 'Kiran Joshi' });
    const { asStudent } = require('../tests/setup/student');
    const k = await asStudent(waiting);
    const req1 = await k.post('/api/v1/student/enrollments', { courseSlug: w.slug, message: 'Morning batch please' });
    if (req1.status !== 201) throw new Error(`enroll: ${JSON.stringify(req1.body)}`);
    const d = await w.s.attach('/api/v1/student/doubts', { courseId: String(w.courseId), question: 'How do I solve 2x + 3 = 7?' });
    if (d.status !== 201) throw new Error(`doubt: ${JSON.stringify(d.body)}`);
    return { courseId: w.courseId, teacher: { mobile: w.t.user.mobile, name: w.t.user.name }, student: { mobile: w.s.user.mobile, name: w.s.user.name }, waiting: { name: waiting.name } };
  }));

  // An approved, subscribed teacher with a draft course: Algebra › Linear equations (for the Excel import + exam builder flow).
  r.post('/teacher-course', h(async () => {
    const { readyCourse } = require('../tests/setup/content');
    const t = await teacher({ name: 'Suresh Patil' });
    const c = await readyCourse(t);
    return { mobile: t.user.mobile, courseId: c.courseId, moduleId: c.moduleId };
  }));

  // A visitor-side published course with no students (for the demo request flow).
  r.post('/course', h(async (req) => {
    const w = await world();
    if (req.query.title) await query('UPDATE dbo.courses SET title = @t WHERE course_id = @c', { t: T.nvarchar(req.query.title, 200), c: T.int(w.courseId) });
    await query("UPDATE dbo.users SET whatsapp_opt_in = 1 WHERE user_id = @id", { id: T.int(w.t.user.user_id) });
    return { slug: w.slug, teacher: { mobile: w.t.user.mobile, name: w.t.user.name } };
  }));

  app.use('/api/v1/__e2e', r);
}

(async () => {
  await resetTestDb();
  await seed();
  const app = createApp({ extraRoutes: hooks });
  app.listen(PORT, () => console.log(`E2E API on http://localhost:${PORT}/api/v1 (DB ${process.env.DB_NAME})`));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
