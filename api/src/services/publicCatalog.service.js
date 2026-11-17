// Public (no login) catalog. Only published courses of approved, non-deleted teachers.
// Serializers list allowed fields explicitly: no mobile, email, internal ids or private file keys.
const { query, one, T } = require('../db/query');
const storage = require('../providers/storage');
const { notFound } = require('../utils/APIError');

const VISIBLE = "c.status = 'published' AND u.status = 'approved' AND u.deleted_at IS NULL";

const videoOut = (source, ref) => {
  if (!source) return null;
  return source === 'upload' ? { source, url: storage.publicUrl(ref) } : { source, url: ref };
};

const card = (r) => ({
  slug: r.slug,
  title: r.title,
  subject: r.subject,
  language: r.language,
  thumbnailUrl: storage.publicUrl(r.thumbnail_key),
  durationText: r.duration_text,
  feeDisplay: r.fee_display,
  teacher: { name: r.teacher_name, slug: r.public_slug, photoUrl: storage.publicUrl(r.photo_key) },
});

const SELECT = `SELECT c.course_id, c.slug, c.title, c.subject, c.language, c.thumbnail_key, c.duration_text, c.fee_display, c.published_at,
                       u.name AS teacher_name, u.photo_key, p.public_slug
                FROM dbo.courses c JOIN dbo.users u ON u.user_id = c.teacher_id LEFT JOIN dbo.teacher_profiles p ON p.user_id = u.user_id`;

async function list({ q, language, subject, teacher, offset, limit }) {
  const params = {
    q: T.nvarchar(q ? `%${String(q).trim()}%` : null, 140),
    lang: T.varchar(language || null, 5),
    subj: T.nvarchar(subject || null, 120),
    t: T.varchar(teacher || null, 80),
    off: T.int(offset),
    lim: T.int(limit),
  };
  const where = `WHERE ${VISIBLE}
    AND (@q IS NULL OR c.title LIKE @q OR c.subject LIKE @q OR u.name LIKE @q)
    AND (@lang IS NULL OR c.language = @lang) AND (@subj IS NULL OR c.subject = @subj) AND (@t IS NULL OR p.public_slug = @t)`;
  const rows = await query(`${SELECT} ${where} ORDER BY c.published_at DESC, c.course_id DESC OFFSET @off ROWS FETCH NEXT @lim ROWS ONLY`, params);
  const { n } = await one(`SELECT COUNT(*) n FROM dbo.courses c JOIN dbo.users u ON u.user_id = c.teacher_id LEFT JOIN dbo.teacher_profiles p ON p.user_id = u.user_id ${where}`, params);
  return { rows: rows.map(card), total: n };
}

async function filters() {
  const langs = await query(`SELECT DISTINCT c.language FROM dbo.courses c JOIN dbo.users u ON u.user_id = c.teacher_id WHERE ${VISIBLE}`);
  const subjects = await query(`SELECT DISTINCT c.subject FROM dbo.courses c JOIN dbo.users u ON u.user_id = c.teacher_id WHERE ${VISIBLE} ORDER BY c.subject`);
  return { languages: langs.map((r) => r.language), subjects: subjects.map((r) => r.subject) };
}

async function findPublished(slug) {
  const c = await one(
    `SELECT c.*, u.name AS teacher_name, u.photo_key, u.status AS teacher_status, p.public_slug, p.bio, p.experience_years, p.qualification, p.subject AS teacher_subjects
     FROM dbo.courses c JOIN dbo.users u ON u.user_id = c.teacher_id LEFT JOIN dbo.teacher_profiles p ON p.user_id = u.user_id
     WHERE c.slug = @s AND ${VISIBLE}`,
    { s: T.varchar(String(slug).slice(0, 220), 220) },
  );
  if (!c) throw notFound('Course not found');
  return c;
}

// Lesson titles are public; only free-preview lessons carry a (short-lived) link.
function previewUrl(x) {
  if (!x.is_free_preview) return undefined;
  if (x.file_key) return storage.signedUrl(x.file_key, 3600);
  return x.url;
}

async function details(slug) {
  const c = await findPublished(slug);
  const p = { c: T.int(c.course_id) };
  const subjects = await query('SELECT * FROM dbo.subjects WHERE course_id = @c ORDER BY sort_order', p);
  const modules = await query('SELECT * FROM dbo.modules WHERE course_id = @c ORDER BY sort_order', p);
  const contents = await query('SELECT * FROM dbo.contents WHERE course_id = @c ORDER BY sort_order', p);
  const batches = await query("SELECT name, start_date, timing_text FROM dbo.batches WHERE course_id = @c AND status = 'active' ORDER BY start_date", p);
  return {
    slug: c.slug,
    title: c.title,
    description: c.description,
    subject: c.subject,
    language: c.language,
    thumbnailUrl: storage.publicUrl(c.thumbnail_key),
    durationText: c.duration_text,
    feeDisplay: c.fee_display,
    demoVideos: [videoOut(c.demo1_source, c.demo1_ref), videoOut(c.demo2_source, c.demo2_ref)].filter(Boolean),
    batches: batches.map((b) => ({ name: b.name, startDate: new Date(b.start_date).toISOString().slice(0, 10), timingText: b.timing_text })),
    curriculum: subjects.map((s) => ({
      name: s.name,
      modules: modules
        .filter((m) => m.subject_id === s.subject_id)
        .map((m) => ({
          name: m.name,
          contents: contents
            .filter((x) => x.module_id === m.module_id)
            .map((x) => {
              const out = { title: x.title, type: x.type, isFreePreview: x.is_free_preview };
              const url = previewUrl(x);
              if (url) {
                out.previewUrl = url;
                out.videoSource = x.video_source;
              }
              return out;
            }),
        })),
    })),
    teacher: {
      name: c.teacher_name,
      slug: c.public_slug,
      photoUrl: storage.publicUrl(c.photo_key),
      bio: c.bio,
      experienceYears: c.experience_years,
      qualification: c.qualification,
      subjects: c.teacher_subjects,
    },
  };
}

async function teacherPage(slug) {
  const t = await one(
    `SELECT u.user_id, u.name, u.photo_key, p.public_slug, p.bio, p.subject, p.experience_years, p.qualification, p.languages,
            p.intro_video_url, p.social_links_json
     FROM dbo.teacher_profiles p JOIN dbo.users u ON u.user_id = p.user_id
     WHERE p.public_slug = @s AND u.status = 'approved' AND u.deleted_at IS NULL`,
    { s: T.varchar(String(slug).slice(0, 80), 80) },
  );
  if (!t) throw notFound('Teacher not found');
  const courses = await query(`${SELECT} WHERE ${VISIBLE} AND c.teacher_id = @t ORDER BY c.published_at DESC`, { t: T.int(t.user_id) });
  return {
    name: t.name,
    slug: t.public_slug,
    photoUrl: storage.publicUrl(t.photo_key),
    bio: t.bio,
    subjects: t.subject,
    experienceYears: t.experience_years,
    qualification: t.qualification,
    languages: t.languages,
    introVideoUrl: t.intro_video_url,
    socialLinks: t.social_links_json ? JSON.parse(t.social_links_json) : {},
    courses: courses.map(card),
  };
}

module.exports = { list, filters, details, teacherPage, findPublished };
