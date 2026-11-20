// Doubts, class programs, public profile and the teacher dashboard.
const { query, one, T } = require('../db/query');
const { notify } = require('./notification.service');
const { owned } = require('./ownership');
const uploads = require('./upload.service');
const studentCount = require('./studentCount.service');
const storage = require('../providers/storage');
const { sanitize } = require('../utils/sanitize');
const { clock, todayIST } = require('../utils/clock');
const { text, int } = require('../utils/validate');
const { validateHttpUrl } = require('../utils/videoLinks');
const { badRequest, conflict, notFound } = require('../utils/APIError');

// ---------- Doubts ----------
const doubtOut = (d) => ({
  id: d.doubt_id,
  student: { publicId: d.student_public_id, name: d.student_name },
  course: { id: d.course_id, title: d.course_title },
  question: d.question,
  attachmentUrl: d.attachment_key ? storage.signedUrl(d.attachment_key) : null,
  reply: d.reply,
  repliedAt: d.replied_at,
  status: d.status,
  createdAt: d.created_at,
});

const DOUBT_SELECT = `SELECT d.*, c.title AS course_title, c.teacher_id, u.public_id AS student_public_id, u.name AS student_name
                      FROM dbo.doubts d JOIN dbo.courses c ON c.course_id = d.course_id JOIN dbo.users u ON u.user_id = d.student_id`;

async function listDoubts(teacherId, { status, courseId }) {
  const rows = await query(
    `${DOUBT_SELECT} WHERE c.teacher_id = @t AND (@s IS NULL OR d.status = @s) AND (@c IS NULL OR d.course_id = @c) ORDER BY d.created_at DESC`,
    { t: T.int(teacherId), s: T.varchar(status || null, 8), c: T.int(courseId ? Number(courseId) : null) },
  );
  return rows.map(doubtOut);
}

async function replyDoubt(id, teacher, body) {
  const d = await one(`${DOUBT_SELECT} WHERE d.doubt_id = @id`, { id: T.int(Number(id)) });
  if (!d || d.teacher_id !== teacher.id) throw notFound('Doubt not found');
  const raw = text(body.reply, 'reply', { max: 2000 });
  const reply = sanitize(raw);
  await query("UPDATE dbo.doubts SET reply = @r, replied_at = @now, status = 'answered' WHERE doubt_id = @id", {
    r: T.nvarchar(reply, 2000), now: T.datetime(clock.now()), id: T.int(d.doubt_id),
  });
  await notify(d.student_id, { key: 'doubt.answered', vars: { teacher: teacher.name, course: d.course_title }, link: '/student/doubts' });
  return doubtOut(await one(`${DOUBT_SELECT} WHERE d.doubt_id = @id`, { id: T.int(d.doubt_id) }));
}

async function closeDoubt(id, teacherId) {
  const d = await one(`${DOUBT_SELECT} WHERE d.doubt_id = @id`, { id: T.int(Number(id)) });
  if (!d || d.teacher_id !== teacherId) throw notFound('Doubt not found');
  await query("UPDATE dbo.doubts SET status = 'closed' WHERE doubt_id = @id", { id: T.int(d.doubt_id) });
  return { id: d.doubt_id, status: 'closed' };
}

// ---------- Class programs ----------
const programOut = (p) => ({
  id: p.program_id,
  title: p.title,
  startsAt: p.starts_at,
  course: p.course_id ? { id: p.course_id, title: p.course_title } : null,
  batch: p.batch_id ? { id: p.batch_id, name: p.batch_name } : null,
});
const PROGRAM_SELECT = `SELECT p.*, c.title AS course_title, b.name AS batch_name FROM dbo.class_programs p
                        LEFT JOIN dbo.courses c ON c.course_id = p.course_id LEFT JOIN dbo.batches b ON b.batch_id = p.batch_id`;

async function parseProgram(teacherId, b) {
  const title = text(b.title, 'title', { max: 200 });
  const startsAt = new Date(b.startsAt);
  if (!b.startsAt || Number.isNaN(startsAt.getTime())) throw badRequest('startsAt: choose a date and time');
  const courseId = b.courseId ? (await owned('course', b.courseId, teacherId)).id : null;
  let batchId = b.batchId ? Number(b.batchId) : null;
  if (batchId) {
    if (!courseId) throw badRequest('Choose the course for this batch');
    const ok = await one('SELECT 1 AS y FROM dbo.batches WHERE batch_id = @b AND course_id = @c', { b: T.int(batchId), c: T.int(courseId) });
    if (!ok) throw badRequest('Choose a batch of this course');
  } else batchId = null;
  return { title, startsAt, courseId, batchId };
}

async function listPrograms(teacherId) {
  const rows = await query(`${PROGRAM_SELECT} WHERE p.teacher_id = @t ORDER BY p.starts_at DESC`, { t: T.int(teacherId) });
  return rows.map(programOut);
}

async function saveProgram(teacherId, body, id) {
  const f = await parseProgram(teacherId, body);
  const params = { t: T.int(teacherId), title: T.nvarchar(f.title, 200), s: T.datetime(f.startsAt), c: T.int(f.courseId), b: T.int(f.batchId) };
  let programId = id;
  if (id) {
    const res = await query('UPDATE dbo.class_programs SET title = @title, starts_at = @s, course_id = @c, batch_id = @b OUTPUT INSERTED.program_id WHERE program_id = @id AND teacher_id = @t', { ...params, id: T.int(Number(id)) });
    if (!res.length) throw notFound('Program not found');
  } else {
    programId = (await one('INSERT INTO dbo.class_programs (teacher_id, title, starts_at, course_id, batch_id) OUTPUT INSERTED.program_id VALUES (@t, @title, @s, @c, @b)', params)).program_id;
  }
  return programOut(await one(`${PROGRAM_SELECT} WHERE p.program_id = @id`, { id: T.int(Number(programId)) }));
}

async function deleteProgram(teacherId, id) {
  const res = await query('DELETE FROM dbo.class_programs OUTPUT DELETED.program_id WHERE program_id = @id AND teacher_id = @t', { id: T.int(Number(id)), t: T.int(teacherId) });
  if (!res.length) throw notFound('Program not found');
  return { deleted: true };
}

// ---------- Public profile ----------
const SLUG_RE = /^[a-z0-9-]{3,60}$/;
const SOCIAL_KEYS = ['website', 'youtube', 'facebook', 'instagram', 'linkedin'];

async function getProfile(teacherId) {
  const r = await one(
    `SELECT u.public_id, u.name, u.mobile, u.email, u.photo_key, u.preferred_lang, p.*
     FROM dbo.users u LEFT JOIN dbo.teacher_profiles p ON p.user_id = u.user_id WHERE u.user_id = @t`,
    { t: T.int(teacherId) },
  );
  return {
    publicId: r.public_id,
    name: r.name,
    mobile: r.mobile,
    email: r.email,
    photoKey: r.photo_key,
    photoUrl: storage.publicUrl(r.photo_key),
    bio: r.bio,
    subjects: r.subject,
    experienceYears: r.experience_years,
    qualification: r.qualification,
    introVideoUrl: r.intro_video_url,
    socialLinks: r.social_links_json ? JSON.parse(r.social_links_json) : {},
    languages: r.languages,
    publicSlug: r.public_slug,
    preferredLang: r.preferred_lang,
  };
}

async function saveProfile(teacherId, b) {
  const name = text(b.name, 'name', { max: 120 });
  const slug = b.publicSlug ? String(b.publicSlug).trim() : null;
  if (slug && !SLUG_RE.test(slug)) throw badRequest('Profile address: 3–60 lowercase letters, numbers or dashes', 'INVALID_SLUG');
  if (slug) {
    const taken = await one('SELECT user_id FROM dbo.teacher_profiles WHERE public_slug = @s AND user_id <> @t', { s: T.varchar(slug, 80), t: T.int(teacherId) });
    if (taken) throw conflict('This profile address is taken. Try another.', 'SLUG_TAKEN');
  }
  const photoKey = b.photoKey ? await uploads.assertOwnedKey(teacherId, b.photoKey, ['photo', 'thumbnail']) : null;
  const social = {};
  for (const k of SOCIAL_KEYS) if (b.socialLinks && b.socialLinks[k]) social[k] = validateHttpUrl(b.socialLinks[k], `socialLinks.${k}`);
  const email = b.email ? text(b.email, 'email', { max: 160 }) : null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw badRequest('Enter a valid email address');
  const lang = ['en', 'mr', 'hi'].includes(b.preferredLang) ? b.preferredLang : null;
  await query(
    `UPDATE dbo.users SET name = @n, email = @e, photo_key = COALESCE(@p, photo_key), preferred_lang = COALESCE(@lang, preferred_lang), updated_at = SYSUTCDATETIME() WHERE user_id = @t`,
    { n: T.nvarchar(name, 120), e: T.varchar(email ? email.toLowerCase() : null, 160), p: T.varchar(photoKey, 200), lang: T.char(lang, 2), t: T.int(teacherId) },
  );
  const params = {
    t: T.int(teacherId),
    bio: T.nvarchar(b.bio ? sanitize(String(b.bio)).slice(0, 2000) : null, 2000),
    subj: T.nvarchar(text(b.subjects, 'subjects', { required: false, max: 120 }), 120),
    exp: T.tinyint(int(b.experienceYears, 'experienceYears', { min: 0, max: 60, required: false })),
    q: T.nvarchar(text(b.qualification, 'qualification', { required: false, max: 160 }), 160),
    vid: T.varchar(b.introVideoUrl ? validateHttpUrl(b.introVideoUrl, 'introVideoUrl') : null, 500),
    social: T.nvarchar(Object.keys(social).length ? JSON.stringify(social) : null, 1000),
    langs: T.nvarchar(text(b.languages, 'languages', { required: false, max: 200 }), 200),
    slug: T.varchar(slug, 80),
  };
  const updated = await query(
    `UPDATE dbo.teacher_profiles SET bio = @bio, subject = @subj, experience_years = @exp, qualification = @q, intro_video_url = @vid,
       social_links_json = @social, languages = @langs, public_slug = @slug OUTPUT INSERTED.user_id WHERE user_id = @t`,
    params,
  );
  if (!updated.length) {
    await query(
      `INSERT INTO dbo.teacher_profiles (user_id, bio, subject, experience_years, qualification, intro_video_url, social_links_json, languages, public_slug)
       VALUES (@t, @bio, @subj, @exp, @q, @vid, @social, @langs, @slug)`,
      params,
    );
  }
  return getProfile(teacherId);
}

// ---------- Dashboard ----------
async function dashboard(teacherId) {
  const counts = await one(
    `SELECT
       (SELECT COUNT(*) FROM dbo.demo_requests WHERE teacher_id = @t AND status = 'pending') AS pendingDemoRequests,
       (SELECT COUNT(*) FROM dbo.enrollments WHERE teacher_id = @t AND status = 'pending') AS pendingEnrollments,
       (SELECT COUNT(*) FROM dbo.doubts d JOIN dbo.courses c ON c.course_id = d.course_id WHERE c.teacher_id = @t AND d.status = 'open') AS openDoubts`,
    { t: T.int(teacherId) },
  );
  const today = todayIST();
  const start = new Date(`${today}T00:00:00+05:30`);
  const end = new Date(start.getTime() + 86400000);
  const classes = await query(
    `SELECT l.live_class_id, l.topic, l.starts_at, l.duration_min, l.meet_link, l.status, c.title AS course_title, b.name AS batch_name
     FROM dbo.live_classes l JOIN dbo.courses c ON c.course_id = l.course_id LEFT JOIN dbo.batches b ON b.batch_id = l.batch_id
     WHERE c.teacher_id = @t AND l.status NOT IN ('cancelled', 'completed') AND l.starts_at >= @s AND l.starts_at < @e
       AND DATEADD(MINUTE, l.duration_min, l.starts_at) > @now
     ORDER BY l.starts_at`,
    { t: T.int(teacherId), s: T.datetime(start), e: T.datetime(end), now: T.datetime(clock.now()) },
  );
  const active = await studentCount.countActiveByTeacher([teacherId]);
  return {
    ...counts,
    activeStudents: active.get(teacherId) || 0,
    todaysClasses: classes.map((c) => ({ id: c.live_class_id, topic: c.topic, startsAt: c.starts_at, meetLink: c.meet_link, status: c.status, course: c.course_title, batch: c.batch_name })),
  };
}

module.exports = { listDoubts, replyDoubt, closeDoubt, listPrograms, saveProgram, deleteProgram, getProfile, saveProfile, dashboard };
