// Dev demo data: one complete teacher for demos, built through the real API (same rules as the app).
//   teacher applies with OTP -> admin accepts -> yearly subscription -> full public profile
//   -> published course (2 subjects, 4 modules, video/PDF/link lessons) -> 2 batches
//   -> question bank (all 4 types) -> Unit Test 1, Unit Test 2, Final and Practice exams
//   -> 4 enrolled students with lesson progress and exam results, 1 waiting for approval
//   -> a held live class with attendance, an upcoming one, two live lessons (one recorded),
//      doubts, demo requests, a class program.
// Every step checks first, so re-running adds only what is missing. Called by scripts/seed.js.
const request = require('supertest');
const { createApp } = require('../src/app');
const { one, query, T } = require('../src/db/query');
const tokenService = require('../src/services/token.service');
const consoleOtp = require('../src/providers/otp/console');
const { clock } = require('../src/utils/clock');

const DEMO = {
  teacher: { mobile: '+919999900002', name: 'Priya Deshmukh', slug: 'priya-deshmukh' },
  liveNowTitle: 'Demo live class: try the Join button',
  // skill = how many of every 10 answers the student gets right.
  students: [
    { mobile: '+919999900003', name: 'Rohan Kulkarni', batch: 'Morning Batch', skill: 9, final: true },
    { mobile: '+919999900004', name: 'Sneha Joshi', batch: 'Morning Batch', skill: 7, practice: true },
    { mobile: '+919999900005', name: 'Aarav Patil', batch: 'Evening Batch', skill: 4, absent: true },
    { mobile: '+919999900006', name: 'Kavya Shinde', batch: 'Evening Batch', skill: 8, final: true },
  ],
  pendingStudent: { mobile: '+919999900007', name: 'Om Jadhav' },
  demoRequests: [
    { mobile: '+919999900008', name: 'Isha More', preferredTime: 'Weekday evenings' },
    { mobile: '+919999900009', name: 'Yash Pawar', preferredTime: 'Saturday morning', schedule: true },
  ],
};
DEMO.student = DEMO.students[0];

const COURSE_TITLE = 'Class 10 Maths (SSC) - Demo';
const MEET = 'https://meet.google.com/dem-oabc-xyz';

// Smallest valid PNG and PDF, enough for the upload checks. Replace them from the UI for a real demo.
const PNG = Buffer.from('89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000A49444154789C6300010000050001', 'hex');
const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n');

// ---------- Curriculum and question bank ----------
const mcq = (difficulty, text, right, wrong, explanation) => ({ type: 'mcq', difficulty, text, explanation, options: [{ text: right, isCorrect: true }, ...wrong.map((w) => ({ text: w, isCorrect: false }))] });
const tf = (difficulty, text, correct, explanation) => ({ type: 'true_false', difficulty, text, correct, explanation });
const fill = (difficulty, text, answers, explanation) => ({ type: 'fill_blank', difficulty, text, acceptedAnswers: answers, explanation });
const multi = (difficulty, text, right, wrong, explanation) => ({ type: 'multi_correct', difficulty, text, explanation, options: [...right.map((r) => ({ text: r, isCorrect: true })), ...wrong.map((w) => ({ text: w, isCorrect: false }))] });
const video = (title, id, isFreePreview = false) => ({ title, type: 'video', videoSource: 'youtube', url: `https://youtu.be/${id}`, isFreePreview });
const link = (title, url) => ({ title, type: 'link', url });
const pdf = (title) => ({ title, type: 'pdf' });

const CURRICULUM = [
  {
    subject: 'Algebra',
    modules: [
      {
        key: 'linear',
        name: 'Linear equations in two variables',
        lessons: [video('Introduction to linear equations', 'abcdefgh125', true), link('Practice sheet (link)', 'https://example.com/practice'), pdf('Chapter notes')],
        questions: [
          mcq('easy', 'Solve: x + 3 = 7', '4', ['3', '10'], '7 - 3 = 4'),
          mcq('easy', 'Solve: 2x = 10', '5', ['20', '8'], '10 / 2 = 5'),
          mcq('easy', 'Solve: x - 5 = 2', '7', ['3', '-3'], '2 + 5 = 7'),
          mcq('easy', 'If x + y = 5 and x - y = 1, x = ?', '3', ['2', '4'], 'Add both: 2x = 6, so x = 3'),
          mcq('easy', 'Solve: 3x + 1 = 10', '3', ['4', '9'], '3x = 9, so x = 3'),
          tf('medium', 'A pair of linear equations always has exactly one solution.', false, 'It can have one, none or infinitely many solutions.'),
          fill('medium', 'The graph of a linear equation in two variables is a straight ____.', ['line'], 'Every solution lies on one straight line.'),
          multi('medium', 'Which of these are linear equations?', ['2x + 3y = 6', 'x = 4'], ['x² + y = 1'], 'x² makes the last one quadratic.'),
        ],
      },
      {
        key: 'quadratic',
        name: 'Quadratic equations',
        lessons: [video('Quadratic equations - concept', 'abcdefgh126'), pdf('Quadratic formula notes'), link('Practice: factorisation', 'https://example.com/factorisation')],
        questions: [
          mcq('easy', 'What is the degree of a quadratic equation?', '2', ['1', '3'], 'The highest power of x is 2.'),
          mcq('easy', 'The roots of x² - 9 = 0 are:', '3 and -3', ['9 and -9', 'Only 3'], 'x² = 9, so x = ±3.'),
          tf('easy', 'x² + 1 = 0 has real roots.', false, 'x² = -1 has no real solution.'),
          fill('medium', 'The discriminant of ax² + bx + c = 0 is b² - ____.', ['4ac'], 'D = b² - 4ac.'),
          multi('medium', 'Which numbers are roots of x² - 5x + 6 = 0?', ['2', '3'], ['5', '6'], '(x - 2)(x - 3) = 0.'),
        ],
      },
    ],
  },
  {
    subject: 'Geometry',
    modules: [
      {
        key: 'similarity',
        name: 'Similar triangles',
        lessons: [video('Similarity - AA, SSS and SAS', 'abcdefgh127'), pdf('Theorems summary')],
        questions: [
          mcq('easy', 'Two triangles are similar if their corresponding angles are:', 'Equal', ['Unequal', 'Supplementary'], 'AA criterion.'),
          mcq('easy', 'For similar triangles, the ratio of areas equals the ratio of the ____ of corresponding sides.', 'Squares', ['Cubes', 'Square roots'], 'Area ratio = (side ratio)².'),
          tf('easy', 'All equilateral triangles are similar.', true, 'All their angles are 60°.'),
          fill('medium', 'In a right triangle, hypotenuse² equals the sum of the squares of the other two ____.', ['sides'], 'Pythagoras theorem.'),
          multi('medium', 'Which are valid similarity criteria?', ['AA', 'SSS', 'SAS'], ['ASS'], 'ASS is not a criterion.'),
        ],
      },
      {
        key: 'circles',
        name: 'Circles',
        lessons: [video('Tangents to a circle', 'abcdefgh128'), link('Interactive circle (GeoGebra)', 'https://www.geogebra.org/geometry')],
        questions: [
          mcq('easy', 'At how many points does a tangent touch a circle?', '1', ['2', '0'], 'A tangent touches at exactly one point.'),
          tf('easy', 'A tangent is perpendicular to the radius at the point of contact.', true, 'Tangent-radius theorem.'),
          mcq('easy', 'How many tangents can be drawn to a circle from an external point?', '2', ['1', 'Infinitely many'], 'Exactly two.'),
          fill('medium', 'A line that cuts a circle at two points is called a ____.', ['secant'], 'Secant = two points of intersection.'),
        ],
      },
    ],
  },
];
const QUESTIONS = new Map(CURRICULUM.flatMap((s) => s.modules.flatMap((m) => m.questions)).map((q) => [q.text, q]));

// ---------- Small helpers ----------
const isoDay = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);
const at = (d, hourUtc) => { const x = new Date(d.getTime()); x.setUTCHours(hourUtc, 30, 0, 0); return x; };

// Each request looks like it comes from its own device (the app trusts one proxy hop), the way real
// users do. Without this, one seed run from one IP trips the per-IP OTP/login rate limits.
let ipSeq = 0;
const fromDevice = (r) => {
  ipSeq += 1;
  return r.set('X-Forwarded-For', `10.99.${Math.floor(ipSeq / 250) % 250}.${(ipSeq % 250) + 1}`);
};

function client(app, token) {
  const auth = (r) => fromDevice(token ? r.set('Authorization', `Bearer ${token}`) : r);
  const check = (label) => (res) => {
    if (res.status >= 400) throw new Error(`demo seed: ${label} failed (${res.status}): ${JSON.stringify(res.body.error || res.body)}`);
    return res.body.data;
  };
  return {
    get: (url) => auth(request(app).get(url)).then(check(`GET ${url}`)),
    post: (url, body) => auth(request(app).post(url)).send(body).then(check(`POST ${url}`)),
    put: (url, body) => auth(request(app).put(url)).send(body).then(check(`PUT ${url}`)),
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
const asUser = async (app, user) => client(app, (await tokenService.issue(user)).accessToken);

// The student answers like a real one: right on `skill` of every 10 questions, wrong on the rest.
function answerFor(q, def, right) {
  if (q.type === 'fill_blank') return { text: right ? def.acceptedAnswers[0] : 'not sure' };
  const correct = def.type === 'true_false' ? [def.correct ? 'True' : 'False'] : def.options.filter((o) => o.isCorrect).map((o) => o.text);
  const ids = (texts) => q.options.filter((o) => texts.includes(o.text)).map((o) => o.id);
  const wrong = q.options.filter((o) => !correct.includes(o.text)).map((o) => o.id);
  if (q.type === 'multi_correct') return { optionIds: right ? ids(correct) : [wrong[0]] };
  return { optionId: right ? ids(correct)[0] : wrong[0] };
}

async function takeExam(app, student, examId, skill, salt) {
  const done = await one('SELECT 1 AS y FROM dbo.exam_attempts WHERE exam_id = @e AND student_id = @s AND submitted_at IS NOT NULL', { e: T.int(examId), s: T.int(student.user_id) });
  if (done) return;
  const res = await fromDevice(request(app).post(`/api/v1/student/exams/${examId}/attempts`)).set('Authorization', `Bearer ${(await tokenService.issue(student)).accessToken}`);
  if (res.status >= 400) throw new Error(`demo seed: start exam ${examId} failed (${res.status}): ${JSON.stringify(res.body.error)}`);
  const paper = res.body.data;
  const api = await asUser(app, student);
  for (const [i, q] of paper.questions.entries()) {
    const right = (i * 7 + salt * 3) % 10 < skill;
    await api.put(`/api/v1/student/attempts/${paper.attemptId}/answers/${q.id}`, answerFor(q, QUESTIONS.get(q.text), right));
  }
  await api.post(`/api/v1/student/attempts/${paper.attemptId}/submit`);
}

// ---------- Steps ----------
async function ensureTeacher(app, asAdmin, anon, today) {
  let user = await findUser(DEMO.teacher.mobile);
  if (!user) {
    const otp = await otpFor(anon, DEMO.teacher.mobile, 'teacher_register');
    const { requestId } = await anon.form('/api/v1/teacher-requests', {
      name: DEMO.teacher.name, mobile: DEMO.teacher.mobile, otp, courseName: 'Class 10 Maths (SSC)', subject: 'Maths',
      experienceYears: 8, email: 'demo.teacher@example.com', city: 'Pune', qualification: 'M.Sc. Mathematics, B.Ed.', acceptTerms: true, whatsappOptIn: true,
    });
    await asAdmin.post(`/api/v1/admin/teacher-requests/${requestId}/accept`);
    user = await findUser(DEMO.teacher.mobile);
  }
  const sub = await one('SELECT 1 AS y FROM dbo.teacher_subscriptions WHERE teacher_id = @t', { t: T.int(user.user_id) });
  if (!sub) await asAdmin.post('/api/v1/admin/subscriptions', { teacherPublicId: user.public_id, planType: 'yearly', startDate: isoDay(today) });
  return user;
}

async function ensureProfile(teacher, user) {
  const p = await one('SELECT public_slug FROM dbo.teacher_profiles WHERE user_id = @t', { t: T.int(user.user_id) });
  if (p && p.public_slug === DEMO.teacher.slug) return;
  const photoKey = (await teacher.upload('photo', PNG, 'photo.png')).key;
  await teacher.put('/api/v1/teacher/profile', {
    name: DEMO.teacher.name,
    email: 'demo.teacher@example.com',
    photoKey,
    publicSlug: DEMO.teacher.slug,
    bio: 'I have taught Class 10 SSC Maths in Pune for 8 years. My classes explain every concept step by step in Marathi, '
      + 'with plenty of practice and regular tests, so students walk into the board exam with confidence.',
    subjects: 'Maths (Algebra, Geometry)',
    experienceYears: 8,
    qualification: 'M.Sc. Mathematics, B.Ed.',
    languages: 'Marathi, English, Hindi',
    introVideoUrl: 'https://youtu.be/abcdefgh129',
    preferredLang: 'mr',
    socialLinks: { website: 'https://example.com/priya-maths', youtube: 'https://www.youtube.com/@example', instagram: 'https://www.instagram.com/example' },
  });
}

async function ensureCourse(teacher, user) {
  const existing = await one('SELECT course_id, slug, status FROM dbo.courses WHERE teacher_id = @t AND title = @title', { t: T.int(user.user_id), title: T.nvarchar(COURSE_TITLE, 200) });
  if (existing) return { id: existing.course_id, slug: existing.slug, published: existing.status === 'published' };
  const thumbnailKey = (await teacher.upload('thumbnail', PNG, 'thumbnail.png')).key;
  const c = await teacher.post('/api/v1/teacher/courses', {
    title: COURSE_TITLE,
    description: 'Complete Class 10 SSC Maths: Algebra (linear and quadratic equations) and Geometry (similar triangles and circles). '
      + 'Video lessons, notes, live doubt classes, two unit tests and a final exam.',
    subject: 'Maths',
    language: 'mr',
    thumbnailKey,
    durationText: '6 months',
    feeDisplay: '₹6,000 for the full course',
    demoVideo1: { source: 'youtube', url: 'https://youtu.be/abcdefgh123' },
    demoVideo2: { source: 'youtube', url: 'https://youtu.be/abcdefgh124' },
  });
  return { id: c.id, slug: c.slug, published: false };
}

// Returns { moduleKey: moduleId }.
async function ensureCurriculum(teacher, courseId) {
  const ids = {};
  for (const s of CURRICULUM) {
    const subj = await one('SELECT subject_id FROM dbo.subjects WHERE course_id = @c AND name = @n', { c: T.int(courseId), n: T.nvarchar(s.subject, 120) });
    const subjectId = subj ? subj.subject_id : (await teacher.post(`/api/v1/teacher/courses/${courseId}/subjects`, { name: s.subject })).id;
    for (const m of s.modules) {
      const mod = await one('SELECT module_id FROM dbo.modules WHERE subject_id = @s AND name = @n', { s: T.int(subjectId), n: T.nvarchar(m.name, 200) });
      const moduleId = mod ? mod.module_id : (await teacher.post(`/api/v1/teacher/subjects/${subjectId}/modules`, { name: m.name })).id;
      ids[m.key] = moduleId;
      for (const l of m.lessons) {
        const has = await one('SELECT 1 AS y FROM dbo.contents WHERE module_id = @m AND title = @t', { m: T.int(moduleId), t: T.nvarchar(l.title, 200) });
        if (has) continue;
        const body = l.type === 'pdf' ? { ...l, fileKey: (await teacher.upload('pdf', PDF, 'notes.pdf')).key } : l;
        await teacher.post(`/api/v1/teacher/modules/${moduleId}/contents`, body);
      }
      for (const q of m.questions) {
        const has = await one('SELECT 1 AS y FROM dbo.questions WHERE module_id = @m AND text = @t AND is_archived = 0', { m: T.int(moduleId), t: T.nvarchar(q.text, 2000) });
        if (!has) await teacher.post(`/api/v1/teacher/modules/${moduleId}/questions`, q);
      }
    }
  }
  return ids;
}

async function ensureBatches(teacher, courseId, today) {
  const out = {};
  for (const b of [
    { name: 'Morning Batch', timingText: 'Mon-Fri, 7:00 - 8:00 AM', maxStudents: 30 },
    { name: 'Evening Batch', timingText: 'Mon-Fri, 6:00 - 7:00 PM', maxStudents: 30 },
  ]) {
    const row = await one('SELECT batch_id FROM dbo.batches WHERE course_id = @c AND name = @n', { c: T.int(courseId), n: T.nvarchar(b.name, 80) });
    out[b.name] = row ? row.batch_id : (await teacher.post(`/api/v1/teacher/courses/${courseId}/batches`, { ...b, startDate: isoDay(today) })).id;
  }
  return out;
}

async function ensureExams(teacher, courseId, mods) {
  const qIds = async (keys) => (await query(
    `SELECT question_id FROM dbo.questions WHERE is_archived = 0 AND module_id IN (SELECT CAST(value AS INT) FROM STRING_SPLIT(@ids, ','))`,
    { ids: T.varchar(keys.map((k) => mods[k]).join(',')) },
  )).map((r) => r.question_id);
  const common = { negativeMarking: false, shuffleQuestions: true, shuffleOptions: true, batchIds: [] };
  const exams = [
    { title: 'Unit Test 1 - Linear equations', scope: 'module', moduleIds: [mods.linear], mode: 'mock', selection: 'random', randomMix: [{ moduleId: mods.linear, easy: 5, medium: 0, hard: 0 }], category: 'unit_test_1', weightage: 20, timeLimitMin: 15, passingPct: 40, attemptLimit: 3 },
    { title: 'Unit Test 2 - Quadratics and similar triangles', scope: 'modules', moduleIds: [mods.quadratic, mods.similarity], mode: 'mock', selection: 'manual', questionIds: await qIds(['quadratic', 'similarity']), category: 'unit_test_2', weightage: 20, timeLimitMin: 20, passingPct: 40, attemptLimit: 2 },
    {
      title: 'Final Exam - Class 10 Maths', scope: 'course', moduleIds: [], mode: 'mock', selection: 'random', category: 'final', weightage: 60, timeLimitMin: 45, passingPct: 35, attemptLimit: 1,
      randomMix: Object.values(mods).map((moduleId) => ({ moduleId, easy: 2, medium: 1, hard: 0 })),
    },
    { title: 'Practice - Circles', scope: 'module', moduleIds: [mods.circles], mode: 'practice', selection: 'manual', questionIds: await qIds(['circles']), category: 'practice' },
  ];
  const out = {};
  for (const e of exams) {
    let row = await one('SELECT exam_id, status FROM dbo.exams WHERE course_id = @c AND title = @t', { c: T.int(courseId), t: T.nvarchar(e.title, 200) });
    if (!row) row = { exam_id: (await teacher.post(`/api/v1/teacher/courses/${courseId}/exams`, { ...common, ...e })).id, status: 'draft' };
    if (row.status !== 'published') await teacher.post(`/api/v1/teacher/exams/${row.exam_id}/publish`);
    out[e.category] = row.exam_id;
  }
  return out;
}

async function ensureStudent(app, anon, s, course) {
  let user = await findUser(s.mobile);
  if (!user) {
    const otp = await otpFor(anon, s.mobile, 'student_register');
    const res = await fromDevice(request(app).post('/api/v1/auth/register-student')).set('X-Client', 'mobile').send({
      name: s.name, mobile: s.mobile, otp, education: '10th', classStandard: '10', city: 'Pune', acceptTerms: true, whatsappOptIn: false,
    });
    if (res.status !== 201) throw new Error(`demo seed: register ${s.name} failed (${res.status}): ${JSON.stringify(res.body.error)}`);
    user = await findUser(s.mobile);
  }
  const e = await one('SELECT 1 AS y FROM dbo.enrollments WHERE student_id = @s AND course_id = @c', { s: T.int(user.user_id), c: T.int(course.id) });
  if (!e) await (await asUser(app, user)).post('/api/v1/student/enrollments', { courseSlug: course.slug, message: s.batch ? `Please add me to the ${s.batch}.` : 'I would like to join this course.' });
  return user;
}

async function ensureEnrolled(teacher, user, course, batchId, today) {
  const e = await one('SELECT enrollment_id, status FROM dbo.enrollments WHERE student_id = @s AND course_id = @c', { s: T.int(user.user_id), c: T.int(course.id) });
  if (e.status === 'pending') {
    await teacher.post(`/api/v1/teacher/enrollments/${e.enrollment_id}/approve`, { batchId, startDate: isoDay(today), endDate: isoDay(addDays(today, 365)) });
  }
}

async function ensureProgress(app, user, courseId, upTo) {
  const has = await one('SELECT 1 AS y FROM dbo.content_progress WHERE student_id = @s', { s: T.int(user.user_id) });
  if (has) return;
  const api = await asUser(app, user);
  const lessons = await query('SELECT content_id FROM dbo.contents WHERE course_id = @c ORDER BY module_id, sort_order', { c: T.int(courseId) });
  for (const l of lessons.slice(0, upTo)) await api.post(`/api/v1/student/contents/${l.content_id}/progress`, { positionSec: 600, completed: true });
}

async function ensureLiveClasses(teacher, courseId, batches, students, today) {
  const held = 'Doubt clearing: linear equations';
  let row = await one('SELECT live_class_id FROM dbo.live_classes WHERE course_id = @c AND topic = @t', { c: T.int(courseId), t: T.nvarchar(held, 200) });
  if (!row) {
    // Classes must be created in the future; then it is moved to two days ago and marked as held.
    const lc = await teacher.post('/api/v1/teacher/live-classes', { courseId, topic: held, startsAt: addDays(today, 1).toISOString(), durationMin: 60, meetLink: MEET });
    await teacher.put(`/api/v1/teacher/live-classes/${lc.id}`, { courseId, topic: held, startsAt: at(addDays(today, -2), 12).toISOString(), durationMin: 60, meetLink: MEET, status: 'completed' });
    await teacher.put(`/api/v1/teacher/live-classes/${lc.id}/attendance`, {
      records: students.map(({ user, s }) => ({ studentPublicId: user.public_id, present: !s.absent })),
    });
  }
  const next = 'Quadratic equations - live problem solving';
  row = await one('SELECT 1 AS y FROM dbo.live_classes WHERE course_id = @c AND topic = @t', { c: T.int(courseId), t: T.nvarchar(next, 200) });
  if (!row) await teacher.post('/api/v1/teacher/live-classes', { courseId, batchId: batches['Morning Batch'], topic: next, startsAt: at(addDays(today, 1), 1).toISOString(), durationMin: 60, meetLink: MEET });
}

// Live lessons inside modules, one per stage:
//  - held three days ago: attendance taken, YouTube recording added (stage "recorded")
//  - the demo class: live right now for 2 hours, so the Join button can be tried (re-seeding re-opens it)
//  - tomorrow 18:00 IST (stage "upcoming")
async function ensureLiveLessons(teacher, mods, today, students) {
  const find = async (moduleId, title) => one(
    "SELECT x.content_id, x.live_class_id, l.starts_at, l.duration_min FROM dbo.contents x JOIN dbo.live_classes l ON l.live_class_id = x.live_class_id WHERE x.module_id = @m AND x.title = @t AND x.type = 'live'",
    { m: T.int(moduleId), t: T.nvarchar(title, 200) },
  );
  const held = 'Live: linear equations recap';
  let h = await find(mods.linear, held);
  if (!h) {
    // The API only accepts future times, so the lesson is created ahead and then moved into the past with SQL.
    const x = await teacher.post(`/api/v1/teacher/modules/${mods.linear}/contents`, {
      title: held, type: 'live', startsAt: addDays(today, 1).toISOString(), durationMin: 60, meetLink: MEET,
    });
    await query("UPDATE dbo.live_classes SET starts_at = @s, status = 'completed' WHERE live_class_id = @id", {
      s: T.datetime(at(addDays(today, -3), 12)), id: T.int(x.live.liveClassId),
    });
    await teacher.put(`/api/v1/teacher/contents/${x.id}/recording`, { videoSource: 'youtube', url: 'https://youtu.be/abcdefgh129' });
    h = { live_class_id: x.live.liveClassId };
  }
  const marked = await one('SELECT TOP 1 1 AS y FROM dbo.attendance WHERE live_class_id = @l', { l: T.int(h.live_class_id) });
  if (!marked) {
    await teacher.put(`/api/v1/teacher/live-classes/${h.live_class_id}/attendance`, {
      records: students.map(({ user, s }) => ({ studentPublicId: user.public_id, present: !s.absent })),
    });
  }

  const demo = await find(mods.similarity, DEMO.liveNowTitle);
  if (!demo) {
    await teacher.post(`/api/v1/teacher/modules/${mods.similarity}/contents`, {
      title: DEMO.liveNowTitle, type: 'live', startsAt: new Date(today.getTime() + 60000).toISOString(), durationMin: 120, meetLink: MEET,
    });
  } else if (new Date(demo.starts_at).getTime() + demo.duration_min * 60000 < today.getTime() + 60 * 60000) {
    // Less than an hour left (or already over): start it again now.
    await query("UPDATE dbo.live_classes SET starts_at = @s, status = 'scheduled', reminder_sent_at = NULL, reminder2_sent_at = NULL WHERE live_class_id = @id", {
      s: T.datetime(today), id: T.int(demo.live_class_id),
    });
  }
  const next = 'Live: solving quadratics together';
  if (!(await find(mods.quadratic, next))) {
    await teacher.post(`/api/v1/teacher/modules/${mods.quadratic}/contents`, {
      title: next, type: 'live', startsAt: at(addDays(today, 1), 12).toISOString(), durationMin: 60, meetLink: MEET,
    });
  }
}

async function ensureDoubts(app, teacher, courseId, students) {
  const doubts = [
    { by: students[0].user, question: 'In Unit Test 1 question 4, why do we add both equations instead of subtracting?', reply: 'Adding removes y because +y and -y cancel. Then 2x = 6, so x = 3. Subtracting would remove x instead - both work!' },
    { by: students[2].user, question: 'How do I know when to use the quadratic formula instead of factorisation?' },
  ];
  for (const d of doubts) {
    let row = await one('SELECT doubt_id, reply FROM dbo.doubts WHERE course_id = @c AND question = @q', { c: T.int(courseId), q: T.nvarchar(d.question, 2000) });
    if (!row) row = { doubt_id: (await (await asUser(app, d.by)).form('/api/v1/student/doubts', { courseId, question: d.question })).id, reply: null };
    if (d.reply && !row.reply) await teacher.post(`/api/v1/teacher/doubts/${row.doubt_id}/reply`, { reply: d.reply });
  }
}

async function ensureDemoRequests(anon, teacher, course, today) {
  for (const d of DEMO.demoRequests) {
    let row = await one('SELECT demo_request_id, status FROM dbo.demo_requests WHERE course_id = @c AND mobile = @m', { c: T.int(course.id), m: T.varchar(d.mobile, 20) });
    if (!row) {
      const otp = await otpFor(anon, d.mobile, 'demo_request');
      await anon.post('/api/v1/public/demo-requests', {
        courseSlug: course.slug, name: d.name, mobile: d.mobile, otp, education: '10th', classStandard: '10', preferredTime: d.preferredTime,
        message: 'I want to see how the classes are taught before joining.', acceptTerms: true, whatsappOptIn: true,
      });
      row = await one('SELECT demo_request_id, status FROM dbo.demo_requests WHERE course_id = @c AND mobile = @m', { c: T.int(course.id), m: T.varchar(d.mobile, 20) });
    }
    if (d.schedule && row.status === 'pending') {
      await teacher.post(`/api/v1/teacher/demo-requests/${row.demo_request_id}/schedule`, { scheduledAt: at(addDays(today, 2), 4).toISOString(), meetLink: MEET });
    }
  }
}

async function ensureProgram(teacher, user, courseId, batches, today) {
  const title = 'Board exam revision marathon';
  const has = await one('SELECT 1 AS y FROM dbo.class_programs WHERE teacher_id = @t AND title = @n', { t: T.int(user.user_id), n: T.nvarchar(title, 200) });
  if (!has) await teacher.post('/api/v1/teacher/programs', { title, startsAt: at(addDays(today, 7), 4).toISOString(), courseId, batchId: batches['Evening Batch'] });
}

async function seedDemo({ admin, log = console.log }) {
  const app = createApp();
  const anon = client(app);
  const asAdmin = await asUser(app, admin);
  const today = clock.now();

  const user = await ensureTeacher(app, asAdmin, anon, today);
  const teacher = await asUser(app, user);
  await ensureProfile(teacher, user);
  const course = await ensureCourse(teacher, user);
  const mods = await ensureCurriculum(teacher, course.id);
  if (!course.published) await teacher.post(`/api/v1/teacher/courses/${course.id}/status`, { status: 'published' });
  const batches = await ensureBatches(teacher, course.id, today);
  const exams = await ensureExams(teacher, course.id, mods);

  const students = [];
  for (const [i, s] of DEMO.students.entries()) {
    const su = await ensureStudent(app, anon, s, course);
    await ensureEnrolled(teacher, su, course, batches[s.batch], today);
    students.push({ user: su, s });
    await ensureProgress(app, su, course.id, 3 + i * 2);
    await takeExam(app, su, exams.unit_test_1, s.skill, i);
    await takeExam(app, su, exams.unit_test_2, s.skill, i + 1);
    if (s.final) await takeExam(app, su, exams.final, s.skill, i + 2);
    if (s.practice) await takeExam(app, su, exams.practice, s.skill, i + 3);
  }
  await ensureStudent(app, anon, DEMO.pendingStudent, course);

  await ensureLiveClasses(teacher, course.id, batches, students, today);
  await ensureLiveLessons(teacher, mods, today, students);
  await ensureDoubts(app, teacher, course.id, students);
  await ensureDemoRequests(anon, teacher, course, today);
  await ensureProgram(teacher, user, course.id, batches, today);

  log(`demo teacher: ${DEMO.teacher.mobile} (${DEMO.teacher.name}) - public profile /teachers/${DEMO.teacher.slug}, course "${COURSE_TITLE}"`);
  log(`demo students: ${DEMO.students.map((s) => `${s.mobile} ${s.name}`).join(', ')}; waiting: ${DEMO.pendingStudent.mobile}`);
  return { teacher: DEMO.teacher, student: DEMO.student };
}

module.exports = { seedDemo, DEMO };
