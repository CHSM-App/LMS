const crypto = require('crypto');
const { query, one, T } = require('../db/query');
const { withTransaction } = require('../db/tx');
const uploads = require('./upload.service');
const storage = require('../providers/storage');
const { tableExists } = require('./accountHooks');
const { validateVideoLink } = require('../utils/videoLinks');
const { text } = require('../utils/validate');
const { clock } = require('../utils/clock');
const { APIError, badRequest, conflict } = require('../utils/APIError');

const LANGUAGES = ['en', 'mr', 'hi', 'other'];

function slugify(title) {
  const base = String(title)
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${base || 'course'}-${crypto.randomBytes(3).toString('hex')}`;
}

async function demoVideo(teacherId, value, field) {
  if (value === undefined || value === null || value === '') return { source: null, ref: null };
  const { source } = value;
  if (source === 'upload') {
    await uploads.assertOwnedKey(teacherId, value.fileKey, ['demo_video', 'video']);
    return { source, ref: value.fileKey };
  }
  if (!source) throw badRequest(`${field}: choose upload, youtube, vimeo or bunny`);
  return { source, ref: validateVideoLink(source, value.url) };
}

async function parse(teacherId, b) {
  const language = b.language;
  if (!LANGUAGES.includes(language)) throw badRequest('language: choose en, mr, hi or other');
  const thumbnailKey = b.thumbnailKey ? await uploads.assertOwnedKey(teacherId, b.thumbnailKey, ['thumbnail']) : null;
  return {
    title: text(b.title, 'title', { max: 200 }),
    description: text(b.description, 'description', { max: 20000 }),
    subject: text(b.subject, 'subject', { max: 120 }),
    language,
    thumbnailKey,
    durationText: text(b.durationText, 'durationText', { required: false, max: 60 }),
    feeDisplay: text(b.feeDisplay, 'feeDisplay', { required: false, max: 60 }),
    demo1: await demoVideo(teacherId, b.demoVideo1, 'demoVideo1'),
    demo2: await demoVideo(teacherId, b.demoVideo2, 'demoVideo2'),
  };
}

const videoOut = (source, ref) => {
  if (!source) return null;
  return source === 'upload' ? { source, fileKey: ref, url: storage.publicUrl(ref) } : { source, url: ref };
};

function serialize(c) {
  return {
    id: c.course_id,
    publicId: c.public_id,
    slug: c.slug,
    title: c.title,
    description: c.description,
    subject: c.subject,
    language: c.language,
    thumbnailKey: c.thumbnail_key,
    thumbnailUrl: storage.publicUrl(c.thumbnail_key),
    durationText: c.duration_text,
    feeDisplay: c.fee_display,
    demoVideo1: videoOut(c.demo1_source, c.demo1_ref),
    demoVideo2: videoOut(c.demo2_source, c.demo2_ref),
    status: c.status,
    publishedAt: c.published_at,
    updatedAt: c.updated_at,
  };
}

const params = (f) => ({
  title: T.nvarchar(f.title, 200),
  description: T.nvarchar(f.description),
  subject: T.nvarchar(f.subject, 120),
  language: T.varchar(f.language, 5),
  thumb: T.varchar(f.thumbnailKey, 200),
  duration: T.nvarchar(f.durationText, 60),
  fee: T.nvarchar(f.feeDisplay, 60),
  d1s: T.varchar(f.demo1.source, 8),
  d1r: T.varchar(f.demo1.ref, 500),
  d2s: T.varchar(f.demo2.source, 8),
  d2r: T.varchar(f.demo2.ref, 500),
});

async function getById(courseId) {
  return one('SELECT * FROM dbo.courses WHERE course_id = @id', { id: T.int(courseId) });
}

async function create(teacherId, body) {
  const f = await parse(teacherId, body);
  const row = await one(
    `INSERT INTO dbo.courses (teacher_id, title, slug, description, subject, language, thumbnail_key, duration_text, fee_display,
       demo1_source, demo1_ref, demo2_source, demo2_ref)
     OUTPUT INSERTED.*
     VALUES (@t, @title, @slug, @description, @subject, @language, @thumb, @duration, @fee, @d1s, @d1r, @d2s, @d2r)`,
    { ...params(f), t: T.int(teacherId), slug: T.varchar(slugify(f.title), 220) },
  );
  return serialize(row);
}

async function update(teacherId, courseId, body) {
  const f = await parse(teacherId, body);
  const row = await one(
    `UPDATE dbo.courses SET title = @title, description = @description, subject = @subject, language = @language, thumbnail_key = @thumb,
       duration_text = @duration, fee_display = @fee, demo1_source = @d1s, demo1_ref = @d1r, demo2_source = @d2s, demo2_ref = @d2r,
       updated_at = @now
     OUTPUT INSERTED.* WHERE course_id = @id`,
    { ...params(f), id: T.int(courseId), now: T.datetime(clock.now()) },
  );
  return serialize(row);
}

async function list(teacherId) {
  const rows = await query(
    `SELECT c.*, (SELECT COUNT(*) FROM dbo.contents x WHERE x.course_id = c.course_id) AS content_count
     FROM dbo.courses c WHERE c.teacher_id = @t ORDER BY c.updated_at DESC, c.course_id DESC`,
    { t: T.int(teacherId) },
  );
  return rows.map((r) => ({ ...serialize(r), contentCount: r.content_count }));
}

// What still blocks publishing, in a fixed order.
async function readiness(courseId) {
  const c = await getById(courseId);
  const missing = [];
  if (!c.title) missing.push('title');
  if (!c.description) missing.push('description');
  if (!c.demo1_source) missing.push('demo_video_1');
  const content = await one('SELECT COUNT(*) n FROM dbo.contents WHERE course_id = @id', { id: T.int(courseId) });
  if (!content.n) missing.push('content');
  return { ready: missing.length === 0, missing };
}

async function setStatus(courseId, status) {
  if (!['draft', 'published'].includes(status)) throw badRequest('status: choose draft or published');
  if (status === 'published') {
    const r = await readiness(courseId);
    if (!r.ready) throw new APIError(422, 'Finish these before publishing', 'NOT_READY', { missing: r.missing });
  }
  const row = await one(
    `UPDATE dbo.courses SET status = @s, updated_at = @now,
       published_at = CASE WHEN @s = 'published' THEN COALESCE(published_at, @now) ELSE published_at END
     OUTPUT INSERTED.* WHERE course_id = @id`,
    { s: T.varchar(status, 10), now: T.datetime(clock.now()), id: T.int(courseId) },
  );
  return serialize(row);
}

async function remove(courseId) {
  const c = await getById(courseId);
  if (c.status === 'published') throw conflict('Unpublish the course first', 'COURSE_PUBLISHED');
  if (await tableExists('enrollments')) {
    const e = await one('SELECT TOP 1 1 AS y FROM dbo.enrollments WHERE course_id = @id', { id: T.int(courseId) });
    if (e) throw conflict('This course has students. Unpublish it instead of deleting.', 'COURSE_HAS_STUDENTS');
  }
  await withTransaction(async (tx) => {
    const p = { id: T.int(courseId) };
    await query('DELETE FROM dbo.contents WHERE course_id = @id', p, tx);
    await query('DELETE FROM dbo.modules WHERE course_id = @id', p, tx);
    await query('DELETE FROM dbo.subjects WHERE course_id = @id', p, tx);
    await query('DELETE FROM dbo.batches WHERE course_id = @id', p, tx);
    await query('DELETE FROM dbo.courses WHERE course_id = @id', p, tx);
  });
  return { deleted: true };
}

module.exports = { create, update, list, getById, serialize, readiness, setStatus, remove, slugify, LANGUAGES };
