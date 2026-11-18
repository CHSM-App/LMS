// Student side: enrollment requests, dashboard, player, progress, live classes, doubts, profile.
const { query, one, T } = require('../db/query');
const { withTransaction } = require('../db/tx');
const { notify } = require('./notification.service');
const catalog = require('./publicCatalog.service');
const storage = require('../providers/storage');
const { accessStatus } = require('./enrollment.service');
const { courseAccess, requireWritable, contentWithAccess, loadContent, isVisible, visibleSql } = require('./studentAccess');
const { liveStage } = require('../domain/liveLesson');
const { sanitize } = require('../utils/sanitize');
const { clock } = require('../utils/clock');
const { text } = require('../utils/validate');
const { APIError, badRequest, conflict } = require('../utils/APIError');

const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);

// ---------- Enrollment requests ----------
const enrollmentOut = (e) => ({
  id: e.enrollment_id,
  course: { slug: e.slug, title: e.title },
  teacher: e.teacher_name,
  status: e.status,
  rejectReason: e.reject_reason,
  requestedAt: e.requested_at,
});

async function requestEnrollment(student, { courseSlug, message }) {
  const course = await catalog.findPublished(courseSlug);
  const msg = message ? text(message, 'message', { max: 1000 }) : null;
  await withTransaction(async (tx) => {
    const existing = await one('SELECT * FROM dbo.enrollments WITH (UPDLOCK, HOLDLOCK) WHERE student_id = @s AND course_id = @c', {
      s: T.int(student.id), c: T.int(course.course_id),
    }, tx);
    if (existing && existing.status === 'pending') throw conflict('You have already asked to join this course', 'ENROLLMENT_PENDING');
    if (existing && existing.status === 'approved') throw conflict("You're already enrolled in this course", 'ALREADY_ENROLLED');
    if (existing && existing.status === 'blocked') throw conflict('The teacher has blocked enrollment for you in this course', 'ENROLLMENT_BLOCKED');
    if (existing) {
      await query(
        "UPDATE dbo.enrollments SET status = 'pending', message = @m, reject_reason = NULL, decided_at = NULL, batch_id = NULL, requested_at = @now WHERE enrollment_id = @id",
        { m: T.nvarchar(msg, 1000), now: T.datetime(clock.now()), id: T.int(existing.enrollment_id) },
        tx,
      );
    } else {
      await query(
        'INSERT INTO dbo.enrollments (student_id, course_id, teacher_id, message, requested_at) VALUES (@s, @c, @t, @m, @now)',
        { s: T.int(student.id), c: T.int(course.course_id), t: T.int(course.teacher_id), m: T.nvarchar(msg, 1000), now: T.datetime(clock.now()) },
        tx,
      );
    }
    await notify(course.teacher_id, { key: 'enrollment.new', vars: { name: student.name, course: course.title }, link: '/teacher/requests' }, tx);
  });
  return (await myEnrollments(student.id)).find((e) => e.course.slug === course.slug);
}

async function myEnrollments(studentId) {
  const rows = await query(
    `SELECT e.*, c.slug, c.title, u.name AS teacher_name FROM dbo.enrollments e
     JOIN dbo.courses c ON c.course_id = e.course_id JOIN dbo.users u ON u.user_id = e.teacher_id
     WHERE e.student_id = @s ORDER BY e.requested_at DESC`,
    { s: T.int(studentId) },
  );
  return rows.map(enrollmentOut);
}

// ---------- Dashboard ----------
async function enrolledCourses(studentId) {
  return query(
    `SELECT e.enrollment_id, e.course_id, e.batch_id, c.title, c.slug, c.thumbnail_key, u.name AS teacher_name, u.status AS teacher_status,
            b.name AS batch_name, s.start_date, s.end_date, s.access_enabled,
            (SELECT COUNT(*) FROM dbo.contents x LEFT JOIN dbo.live_classes l ON l.live_class_id = x.live_class_id
              WHERE x.course_id = e.course_id AND ${visibleSql('e.batch_id')}) AS total_lessons,
            (SELECT COUNT(*) FROM dbo.content_progress p JOIN dbo.contents x ON x.content_id = p.content_id
              LEFT JOIN dbo.live_classes l ON l.live_class_id = x.live_class_id
              WHERE p.student_id = e.student_id AND x.course_id = e.course_id AND p.completed_at IS NOT NULL
                AND ${visibleSql('e.batch_id')}) AS done_lessons
     FROM dbo.enrollments e
     JOIN dbo.courses c ON c.course_id = e.course_id
     JOIN dbo.users u ON u.user_id = e.teacher_id
     LEFT JOIN dbo.batches b ON b.batch_id = e.batch_id
     LEFT JOIN dbo.student_subscriptions s ON s.enrollment_id = e.enrollment_id
     WHERE e.student_id = @s AND e.status = 'approved'
     ORDER BY c.title`,
    { s: T.int(studentId) },
  );
}

const courseOut = (r) => ({
  courseId: r.course_id,
  slug: r.slug,
  title: r.title,
  thumbnailUrl: storage.publicUrl(r.thumbnail_key),
  teacher: r.teacher_name,
  batch: r.batch_name,
  progressPct: pct(r.done_lessons, r.total_lessons),
  endDate: iso(r.end_date),
  accessStatus: accessStatus(r),
  readOnly: r.teacher_status === 'blocked',
});

async function liveClasses(studentId, { upcomingOnly = true } = {}) {
  const now = clock.now();
  const rows = await query(
    `SELECT l.live_class_id, l.course_id, l.topic, l.starts_at, l.duration_min, l.meet_link, l.status, c.title AS course_title, b.name AS batch_name,
            x.content_id
     FROM dbo.live_classes l
     LEFT JOIN dbo.contents x ON x.live_class_id = l.live_class_id
     JOIN dbo.enrollments e ON e.course_id = l.course_id AND e.student_id = @s AND e.status = 'approved'
     JOIN dbo.student_subscriptions s ON s.enrollment_id = e.enrollment_id AND s.access_enabled = 1
     JOIN dbo.courses c ON c.course_id = l.course_id
     JOIN dbo.users t ON t.user_id = c.teacher_id AND t.status = 'approved'
     LEFT JOIN dbo.batches b ON b.batch_id = l.batch_id
     WHERE (l.batch_id IS NULL OR l.batch_id = e.batch_id) AND l.status <> 'cancelled'
       AND (@up = 0 OR DATEADD(MINUTE, l.duration_min, l.starts_at) >= @now)
     ORDER BY l.starts_at`,
    { s: T.int(studentId), now: T.datetime(now), up: T.bit(upcomingOnly) },
  );
  return rows.map((r) => ({
    id: r.live_class_id,
    courseId: r.course_id,
    contentId: r.content_id || null,
    topic: r.topic,
    course: r.course_title,
    batch: r.batch_name,
    startsAt: r.starts_at,
    durationMin: r.duration_min,
    meetLink: r.meet_link,
    status: r.status,
  }));
}

async function dashboard(studentId) {
  const courses = (await enrolledCourses(studentId)).map(courseOut);
  const pending = (await myEnrollments(studentId)).filter((e) => e.status !== 'approved');
  return { myCourses: courses, upcomingLiveClasses: (await liveClasses(studentId)).slice(0, 5), requests: pending };
}

// ---------- Player ----------
async function courseView(studentId, courseId) {
  const { readOnly, enrollment } = await courseAccess(studentId, courseId);
  const c = await one('SELECT course_id, title, slug FROM dbo.courses WHERE course_id = @c', { c: T.int(Number(courseId)) });
  const p = { c: T.int(c.course_id), s: T.int(studentId), b: T.int(enrollment.batch_id ?? null) };
  const subjects = await query('SELECT * FROM dbo.subjects WHERE course_id = @c ORDER BY sort_order', p);
  const modules = await query('SELECT * FROM dbo.modules WHERE course_id = @c ORDER BY sort_order', p);
  const contents = await query(
    `SELECT x.content_id, x.module_id, x.title, x.type, x.video_source, x.file_key, x.live_class_id, p.completed_at, p.last_position_sec,
            l.starts_at AS live_starts_at, l.duration_min AS live_duration_min, l.status AS live_status
     FROM dbo.contents x LEFT JOIN dbo.content_progress p ON p.content_id = x.content_id AND p.student_id = @s
     LEFT JOIN dbo.live_classes l ON l.live_class_id = x.live_class_id
     WHERE x.course_id = @c AND ${visibleSql('@b')} ORDER BY x.sort_order`,
    p,
  );
  const done = contents.filter((x) => x.completed_at).length;
  return {
    courseId: c.course_id,
    title: c.title,
    readOnly,
    progressPct: pct(done, contents.length),
    subjects: subjects.map((s) => ({
      id: s.subject_id,
      name: s.name,
      modules: modules
        .filter((m) => m.subject_id === s.subject_id)
        .map((m) => ({
          id: m.module_id,
          name: m.name,
          contents: contents
            .filter((x) => x.module_id === m.module_id)
            .map((x) => {
              const o = {
                id: x.content_id,
                title: x.title,
                type: x.type,
                videoSource: x.video_source,
                completed: !!x.completed_at,
                locked: readOnly && !x.completed_at,
                downloadable: isDownloadable(x),
              };
              if (x.type === 'live') o.live = liveSummary(x);
              return o;
            }),
        })),
    })),
  };
}

// Uploaded videos and uploaded live-lesson recordings can be saved offline.
const isDownloadable = (x) => (x.type === 'video' || x.type === 'live') && x.video_source === 'upload';

// x: content row with live_* columns.
function liveSummary(x) {
  const hasRecording = !!x.video_source;
  const stage = liveStage({ status: x.live_status, startsAt: x.live_starts_at, durationMin: x.live_duration_min, hasRecording }, clock.now());
  return { startsAt: x.live_starts_at, durationMin: x.live_duration_min, stage };
}

// A live lesson can be completed only once it has ended or has a recording; other lessons always.
const canComplete = (x) => x.type !== 'live' || ['ended', 'recorded'].includes(liveSummary(x).stage);

async function contentView(studentId, contentId) {
  const { content: x, progress } = await contentWithAccess(studentId, contentId);
  const out = {
    id: x.content_id,
    courseId: x.course_id,
    title: x.title,
    type: x.type,
    videoSource: x.video_source,
    url: x.file_key ? storage.signedUrl(x.file_key) : x.url,
    lastPositionSec: progress ? progress.last_position_sec : 0,
    completed: !!(progress && progress.completed_at),
    downloadable: isDownloadable(x),
    canComplete: canComplete(x),
  };
  if (x.type === 'live') {
    out.live = liveSummary(x);
    // The Meet link is shared only until the class ends.
    if (['upcoming', 'live'].includes(out.live.stage)) out.live.meetLink = x.live_meet_link;
  }
  return out;
}

async function upsertProgress(studentId, contentId, { positionSec, completed, completedAt }, tx) {
  const pos = positionSec === undefined || positionSec === null ? null : Math.max(0, Math.floor(Number(positionSec)) || 0);
  const doneAt = completed ? clock.now() : completedAt ? new Date(completedAt) : null;
  const params = { s: T.int(studentId), c: T.int(contentId), pos: T.int(pos), done: T.datetime(doneAt), now: T.datetime(clock.now()) };
  const updated = await query(
    `UPDATE dbo.content_progress WITH (UPDLOCK, SERIALIZABLE)
     SET last_position_sec = COALESCE(@pos, last_position_sec), completed_at = COALESCE(completed_at, @done), updated_at = @now
     OUTPUT INSERTED.content_id WHERE student_id = @s AND content_id = @c`,
    params,
    tx,
  );
  if (!updated.length) {
    await query(
      'INSERT INTO dbo.content_progress (student_id, content_id, last_position_sec, completed_at, updated_at) VALUES (@s, @c, COALESCE(@pos, 0), @done, @now)',
      params,
      tx,
    );
  }
}

async function saveProgress(studentId, contentId, body) {
  const c = await loadContent(contentId);
  if (!c) throw new APIError(404, 'Lesson not found');
  const { enrollment } = await requireWritable(studentId, c.course_id);
  if (!isVisible(c, enrollment)) throw new APIError(404, 'Lesson not found');
  if (body.completed === true && !canComplete(c)) throw conflict('You can mark this class complete after it ends', 'LIVE_NOT_FINISHED');
  await upsertProgress(studentId, c.content_id, { positionSec: body.positionSec, completed: body.completed === true });
  return { saved: true };
}

// Offline queue from the app: [{ contentId, positionSec?, completedAt? }] — completion is never undone.
async function syncProgress(studentId, items) {
  if (!Array.isArray(items) || items.length > 500) throw badRequest('items: send up to 500 progress entries');
  let applied = 0;
  for (const it of items) {
    const c = await loadContent(it.contentId);
    if (!c) continue;
    try {
      const { enrollment } = await courseAccess(studentId, c.course_id);
      if (!isVisible(c, enrollment)) continue;
    } catch {
      continue;
    }
    await upsertProgress(studentId, c.content_id, { positionSec: it.positionSec, completedAt: canComplete(c) ? it.completedAt : null });
    applied += 1;
  }
  return { applied };
}

// ---------- Progress summary ----------
async function progress(studentId) {
  const courses = await enrolledCourses(studentId);
  const out = [];
  for (const r of courses) {
    // Held = this student's classes where the teacher took attendance.
    const att = await one(
      `SELECT
         (SELECT COUNT(*) FROM dbo.live_classes l
           WHERE l.course_id = @c AND (l.batch_id IS NULL OR l.batch_id = @b) AND l.status <> 'cancelled'
             AND EXISTS (SELECT 1 FROM dbo.attendance a WHERE a.live_class_id = l.live_class_id)) AS held,
         (SELECT COUNT(*) FROM dbo.attendance a JOIN dbo.live_classes l ON l.live_class_id = a.live_class_id
           WHERE l.course_id = @c AND a.student_id = @s AND a.present = 1) AS present`,
      { s: T.int(studentId), c: T.int(r.course_id), b: T.int(r.batch_id) },
    );
    const exams = await query(
      `SELECT e.exam_id, e.title, e.category, MAX(a.score * 100.0 / NULLIF(a.max_score, 0)) AS best_pct, COUNT(a.attempt_id) AS attempts
       FROM dbo.exams e JOIN dbo.exam_attempts a ON a.exam_id = e.exam_id AND a.student_id = @s AND a.submitted_at IS NOT NULL
       WHERE e.course_id = @c GROUP BY e.exam_id, e.title, e.category`,
      { s: T.int(studentId), c: T.int(r.course_id) },
    );
    out.push({
      courseId: r.course_id,
      title: r.title,
      completedLessons: r.done_lessons,
      totalLessons: r.total_lessons,
      progressPct: pct(r.done_lessons, r.total_lessons),
      classesHeld: att.held || 0,
      classesAttended: att.present || 0,
      attendancePct: pct(att.present || 0, att.held || 0),
      exams: exams.map((e) => ({ examId: e.exam_id, title: e.title, category: e.category, bestPct: Math.round(Number(e.best_pct) * 100) / 100, attempts: e.attempts })),
    });
  }
  return { courses: out };
}

// ---------- Doubts ----------
async function askDoubt(studentId, { courseId, question }, attachment) {
  const id = Number(courseId);
  if (!Number.isInteger(id)) throw badRequest('courseId: choose the course');
  await requireWritable(studentId, id);
  const q = sanitize(text(question, 'question', { max: 2000 }));
  const key = attachment ? await storage.save(attachment.buffer, 'doubt', attachment.ext) : null;
  const row = await one(
    'INSERT INTO dbo.doubts (student_id, course_id, question, attachment_key) OUTPUT INSERTED.doubt_id VALUES (@s, @c, @q, @k)',
    { s: T.int(studentId), c: T.int(id), q: T.nvarchar(q, 2000), k: T.varchar(key, 200) },
  );
  return (await myDoubts(studentId)).find((d) => d.id === row.doubt_id);
}

async function myDoubts(studentId) {
  const rows = await query(
    `SELECT d.*, c.title AS course_title FROM dbo.doubts d JOIN dbo.courses c ON c.course_id = d.course_id
     WHERE d.student_id = @s ORDER BY d.created_at DESC`,
    { s: T.int(studentId) },
  );
  return rows.map((d) => ({
    id: d.doubt_id,
    course: { id: d.course_id, title: d.course_title },
    question: d.question,
    attachmentUrl: d.attachment_key ? storage.signedUrl(d.attachment_key) : null,
    reply: d.reply,
    repliedAt: d.replied_at,
    status: d.status,
    createdAt: d.created_at,
  }));
}

// ---------- Profile ----------
async function profile(studentId) {
  const r = await one(
    `SELECT u.public_id, u.name, u.mobile, u.email, u.city, u.photo_key, u.preferred_lang, u.whatsapp_opt_in, p.education, p.class_standard
     FROM dbo.users u LEFT JOIN dbo.student_profiles p ON p.user_id = u.user_id WHERE u.user_id = @s`,
    { s: T.int(studentId) },
  );
  return {
    publicId: r.public_id, name: r.name, mobile: r.mobile, email: r.email, city: r.city, photoUrl: storage.publicUrl(r.photo_key),
    preferredLang: r.preferred_lang, whatsappOptIn: r.whatsapp_opt_in, education: r.education, classStandard: r.class_standard,
  };
}

async function saveProfile(studentId, b) {
  const name = text(b.name, 'name', { max: 120 });
  const email = b.email ? text(b.email, 'email', { max: 160 }) : null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw badRequest('Enter a valid email address');
  const lang = ['en', 'mr', 'hi'].includes(b.preferredLang) ? b.preferredLang : null;
  await withTransaction(async (tx) => {
    await query(
      `UPDATE dbo.users SET name = @n, email = @e, city = @c, preferred_lang = COALESCE(@l, preferred_lang),
         whatsapp_opt_in = COALESCE(@wa, whatsapp_opt_in), updated_at = SYSUTCDATETIME() WHERE user_id = @s`,
      {
        n: T.nvarchar(name, 120), e: T.varchar(email ? email.toLowerCase() : null, 160), c: T.nvarchar(text(b.city, 'city', { required: false, max: 80 }), 80),
        l: T.char(lang, 2), wa: T.bit(b.whatsappOptIn === undefined ? null : !!b.whatsappOptIn), s: T.int(studentId),
      },
      tx,
    );
    const params = { s: T.int(studentId), e: T.nvarchar(text(b.education, 'education', { required: false, max: 120 }), 120), c: T.nvarchar(text(b.classStandard, 'classStandard', { required: false, max: 40 }), 40) };
    const up = await query('UPDATE dbo.student_profiles SET education = @e, class_standard = @c OUTPUT INSERTED.user_id WHERE user_id = @s', params, tx);
    if (!up.length) await query('INSERT INTO dbo.student_profiles (user_id, education, class_standard) VALUES (@s, @e, @c)', params, tx);
  });
  return profile(studentId);
}

module.exports = {
  requestEnrollment, myEnrollments, dashboard, liveClasses, courseView, contentView, saveProgress, syncProgress, upsertProgress,
  progress, askDoubt, myDoubts, profile, saveProfile,
};
