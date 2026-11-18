// Dev demo data: one complete teacher, built through the real API (same rules as the app).
// Teacher applies with OTP -> admin accepts -> admin adds a yearly subscription -> teacher builds and
// publishes a course, a batch and a unit test -> a student registers, asks to join and is approved.
// Idempotent: does nothing when the demo teacher already exists. Called by scripts/seed.js.
const request = require('supertest');
const { createApp } = require('../src/app');
const { one, T } = require('../src/db/query');
const tokenService = require('../src/services/token.service');
const consoleOtp = require('../src/providers/otp/console');
const { clock } = require('../src/utils/clock');

const DEMO = {
  teacher: { mobile: '+919999900002', name: 'Priya Deshmukh' },
  student: { mobile: '+919999900003', name: 'Rohan Kulkarni' },
};

// Smallest valid PNG and PDF, enough for the upload checks. Replace them from the UI for a real demo.
const PNG = Buffer.from('89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000A49444154789C6300010000050001', 'hex');
const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n');

const isoDay = (d) => d.toISOString().slice(0, 10);

function client(app, token) {
  const auth = (r) => (token ? r.set('Authorization', `Bearer ${token}`) : r);
  const check = (label) => (res) => {
    if (res.status >= 400) throw new Error(`demo seed: ${label} failed (${res.status}): ${JSON.stringify(res.body.error || res.body)}`);
    return res.body.data;
  };
  return {
    post: (url, body) => auth(request(app).post(url)).send(body).then(check(`POST ${url}`)),
    upload: (kind, buffer, name) => auth(request(app).post('/api/v1/uploads')).field('kind', kind).attach('file', buffer, name).then(check(`upload ${kind}`)),
    form: (url, fields) => {
      let r = auth(request(app).post(url));
      for (const [k, v] of Object.entries(fields)) r = r.field(k, String(v));
      return r.then(check(`POST ${url}`));
    },
  };
}

async function otpFor(api, mobile, purpose) {
  await api.post('/api/v1/auth/otp/send', { mobile, purpose });
  const code = consoleOtp.lastCode(mobile, purpose);
  if (!code) throw new Error('demo seed: needs OTP_PROVIDER=console');
  return code;
}

const findUser = (mobile) => one('SELECT * FROM dbo.users WHERE mobile = @m AND deleted_at IS NULL', { m: T.varchar(mobile, 20) });

const question = (text, right, wrong, explanation) => ({
  type: 'mcq', text, difficulty: 'easy', marks: 1, negativeMarks: 0, explanation,
  options: [{ text: right, isCorrect: true }, ...wrong.map((w) => ({ text: w, isCorrect: false }))],
});

async function seedDemo({ admin, log = console.log }) {
  const existing = await findUser(DEMO.teacher.mobile);
  if (existing) {
    log(`demo teacher already exists: ${DEMO.teacher.mobile}`);
    return { created: false, teacher: DEMO.teacher, student: DEMO.student };
  }

  const app = createApp();
  const anon = client(app);
  const asAdmin = client(app, (await tokenService.issue(admin)).accessToken);
  const today = clock.now();
  const nextYear = new Date(today.getTime());
  nextYear.setUTCFullYear(nextYear.getUTCFullYear() + 1);

  // 1. Teacher applies (OTP-verified form), admin accepts and adds a yearly subscription.
  const reqOtp = await otpFor(anon, DEMO.teacher.mobile, 'teacher_register');
  const { requestId } = await anon.form('/api/v1/teacher-requests', {
    name: DEMO.teacher.name, mobile: DEMO.teacher.mobile, otp: reqOtp, courseName: 'Class 10 Maths (SSC)', subject: 'Maths',
    experienceYears: 6, email: 'demo.teacher@example.com', city: 'Pune', qualification: 'M.Sc. B.Ed.', acceptTerms: true, whatsappOptIn: true,
  });
  await asAdmin.post(`/api/v1/admin/teacher-requests/${requestId}/accept`);
  const teacherUser = await findUser(DEMO.teacher.mobile);
  await asAdmin.post('/api/v1/admin/subscriptions', { teacherPublicId: teacherUser.public_id, planType: 'yearly', startDate: isoDay(today) });

  // 2. Teacher builds and publishes a course: subject -> module -> video, notes link and PDF lessons.
  const teacher = client(app, (await tokenService.issue(teacherUser)).accessToken);
  const thumbnailKey = (await teacher.upload('thumbnail', PNG, 'thumbnail.png')).key;
  const course = await teacher.post('/api/v1/teacher/courses', {
    title: 'Class 10 Maths (SSC) - Demo',
    description: 'Algebra for Class 10 SSC: linear equations step by step, with notes and a unit test.',
    subject: 'Maths',
    language: 'mr',
    thumbnailKey,
    demoVideo1: { source: 'youtube', url: 'https://youtu.be/abcdefgh123' },
    demoVideo2: { source: 'youtube', url: 'https://youtu.be/abcdefgh124' },
  });
  const subject = await teacher.post(`/api/v1/teacher/courses/${course.id}/subjects`, { name: 'Algebra' });
  const mod = await teacher.post(`/api/v1/teacher/subjects/${subject.id}/modules`, { name: 'Linear equations in two variables' });
  await teacher.post(`/api/v1/teacher/modules/${mod.id}/contents`, {
    title: 'Introduction to linear equations', type: 'video', videoSource: 'youtube', url: 'https://youtu.be/abcdefgh125', isFreePreview: true,
  });
  await teacher.post(`/api/v1/teacher/modules/${mod.id}/contents`, { title: 'Practice sheet (link)', type: 'link', url: 'https://example.com/practice' });
  const pdfKey = (await teacher.upload('pdf', PDF, 'notes.pdf')).key;
  await teacher.post(`/api/v1/teacher/modules/${mod.id}/contents`, { title: 'Chapter notes', type: 'pdf', fileKey: pdfKey });
  await teacher.post(`/api/v1/teacher/courses/${course.id}/status`, { status: 'published' });
  const batch = await teacher.post(`/api/v1/teacher/courses/${course.id}/batches`, { name: 'Morning Batch', startDate: isoDay(today), timing: '7:00 - 8:00 AM', maxStudents: 30 });

  // 3. Question bank + a published unit test.
  const questions = [
    question('Solve: x + 3 = 7', '4', ['3', '10'], '7 - 3 = 4'),
    question('Solve: 2x = 10', '5', ['20', '8'], '10 / 2 = 5'),
    question('Solve: x - 5 = 2', '7', ['3', '-3'], '2 + 5 = 7'),
    question('If x + y = 5 and x - y = 1, x = ?', '3', ['2', '4'], 'Add both: 2x = 6, so x = 3'),
    question('Solve: 3x + 1 = 10', '3', ['4', '9'], '3x = 9, so x = 3'),
  ];
  for (const q of questions) await teacher.post(`/api/v1/teacher/modules/${mod.id}/questions`, q);
  const exam = await teacher.post(`/api/v1/teacher/courses/${course.id}/exams`, {
    title: 'Unit Test 1 - Linear equations', scope: 'module', moduleIds: [mod.id], mode: 'mock', selection: 'random',
    randomMix: [{ moduleId: mod.id, easy: questions.length, medium: 0, hard: 0 }], category: 'unit_test_1', weightage: 20,
    negativeMarking: false, timeLimitMin: 15, passingPct: 40, shuffleQuestions: true, shuffleOptions: true, attemptLimit: 3, batchIds: [],
  });
  await teacher.post(`/api/v1/teacher/exams/${exam.id}/publish`);

  // 4. A student registers with OTP, asks to join, and the teacher approves into the batch for a year.
  const regOtp = await otpFor(anon, DEMO.student.mobile, 'student_register');
  const reg = await request(app).post('/api/v1/auth/register-student').set('X-Client', 'mobile').send({
    name: DEMO.student.name, mobile: DEMO.student.mobile, otp: regOtp, education: '10th', classStandard: '10', city: 'Pune', acceptTerms: true, whatsappOptIn: false,
  });
  if (reg.status !== 201) throw new Error(`demo seed: student register failed (${reg.status}): ${JSON.stringify(reg.body.error)}`);
  const studentApi = client(app, reg.body.data.accessToken);
  const { slug } = await one('SELECT slug FROM dbo.courses WHERE course_id = @c', { c: T.int(course.id) });
  await studentApi.post('/api/v1/student/enrollments', { courseSlug: slug, message: 'Please add me to the morning batch.' });
  const studentUser = await findUser(DEMO.student.mobile);
  const enrollment = await one('SELECT enrollment_id FROM dbo.enrollments WHERE student_id = @s AND course_id = @c', { s: T.int(studentUser.user_id), c: T.int(course.id) });
  await teacher.post(`/api/v1/teacher/enrollments/${enrollment.enrollment_id}/approve`, { batchId: batch.id, startDate: isoDay(today), endDate: isoDay(nextYear) });

  log(`demo teacher: ${DEMO.teacher.mobile} (${DEMO.teacher.name}) - course "${course.title}" published, Morning Batch, Unit Test 1`);
  log(`demo student: ${DEMO.student.mobile} (${DEMO.student.name}) - enrolled in the demo course`);
  return { created: true, teacher: DEMO.teacher, student: DEMO.student };
}

module.exports = { seedDemo, DEMO };
