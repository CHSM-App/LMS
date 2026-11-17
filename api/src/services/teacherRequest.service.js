const { query, one, T } = require('../db/query');
const { withTransaction } = require('../db/tx');
const otpService = require('./otp.service');
const consentService = require('./consent.service');
const { notify, notifyAdmins } = require('./notification.service');
const { audit } = require('./audit.service');
const storage = require('../providers/storage');
const { clock } = require('../utils/clock');
const { conflict, notFound } = require('../utils/APIError');
const { maskMobile } = require('../utils/mobile');

async function create(fields, uploads, ip) {
  const existing = await one('SELECT user_id FROM dbo.users WHERE mobile = @m AND deleted_at IS NULL', { m: T.varchar(fields.mobile, 20) });
  if (existing) throw conflict('This number is already registered. Log in instead.', 'MOBILE_REGISTERED');
  const pending = await one("SELECT request_id FROM dbo.teacher_requests WHERE mobile = @m AND status = 'pending'", { m: T.varchar(fields.mobile, 20) });
  if (pending) throw conflict('A request is already pending', 'REQUEST_PENDING');

  await otpService.verify(fields.mobile, 'teacher_register', fields.otp);

  const photoKey = uploads.photo ? await storage.save(uploads.photo.buffer, 'photo', uploads.photo.ext) : null;
  const docKey = uploads.idDocument ? await storage.save(uploads.idDocument.buffer, 'id_document', uploads.idDocument.ext) : null;
  try {
    return await withTransaction(async (tx) => {
      const row = await one(
        `INSERT INTO dbo.teacher_requests (mobile, name, course_name, subject, experience_years, email, city, qualification, photo_key, id_document_key)
         OUTPUT INSERTED.request_id, INSERTED.status
         VALUES (@m, @n, @c, @s, @e, @em, @city, @q, @p, @d)`,
        {
          m: T.varchar(fields.mobile, 20),
          n: T.nvarchar(fields.name, 120),
          c: T.nvarchar(fields.courseName, 200),
          s: T.nvarchar(fields.subject, 120),
          e: T.tinyint(fields.experienceYears),
          em: T.varchar(fields.email, 160),
          city: T.nvarchar(fields.city, 80),
          q: T.nvarchar(fields.qualification, 160),
          p: T.varchar(photoKey, 200),
          d: T.varchar(docKey, 200),
        },
        tx,
      );
      await consentService.record({ mobile: fields.mobile, type: 'terms_privacy', ip }, tx);
      if (fields.whatsappOptIn) await consentService.record({ mobile: fields.mobile, type: 'whatsapp', ip }, tx);
      await notifyAdmins({ key: 'teacherRequest.new', vars: { name: fields.name }, link: '/admin/teacher-requests' }, tx);
      return { requestId: row.request_id, status: row.status };
    });
  } catch (err) {
    await storage.remove(photoKey);
    await storage.remove(docKey);
    if (err.number === 2601 || err.number === 2627) throw conflict('A request is already pending', 'REQUEST_PENDING');
    throw err;
  }
}

const serialize = (r) => ({
  id: r.request_id,
  name: r.name,
  mobile: r.mobile,
  courseName: r.course_name,
  subject: r.subject,
  experienceYears: r.experience_years,
  email: r.email,
  city: r.city,
  qualification: r.qualification,
  photoUrl: r.photo_key ? storage.signedUrl(r.photo_key) : null,
  idDocumentUrl: r.id_document_key ? storage.signedUrl(r.id_document_key) : null,
  status: r.status,
  rejectReason: r.reject_reason,
  createdAt: r.created_at,
  reviewedAt: r.reviewed_at,
});

async function list({ status, q, offset, limit }) {
  const params = {
    s: T.varchar(status || null, 10),
    q: T.nvarchar(q ? `%${q}%` : null, 140),
    off: T.int(offset),
    lim: T.int(limit),
  };
  const where = `WHERE (@s IS NULL OR status = @s) AND (@q IS NULL OR name LIKE @q OR mobile LIKE @q OR subject LIKE @q)`;
  const rows = await query(
    `SELECT * FROM dbo.teacher_requests ${where} ORDER BY created_at DESC, request_id DESC OFFSET @off ROWS FETCH NEXT @lim ROWS ONLY`,
    params,
  );
  const { n } = await one(`SELECT COUNT(*) n FROM dbo.teacher_requests ${where}`, params);
  return { rows: rows.map(serialize), total: n };
}

async function lockPending(id, tx) {
  const r = await one('SELECT * FROM dbo.teacher_requests WITH (UPDLOCK, HOLDLOCK) WHERE request_id = @id', { id: T.int(id) }, tx);
  if (!r) throw notFound('Request not found');
  if (r.status !== 'pending') throw conflict(`This request is already ${r.status}`, 'REQUEST_DONE');
  return r;
}

async function accept(id, adminId, ip) {
  return withTransaction(async (tx) => {
    const r = await lockPending(id, tx);
    const taken = await one('SELECT user_id FROM dbo.users WHERE mobile = @m AND deleted_at IS NULL', { m: T.varchar(r.mobile, 20) }, tx);
    if (taken) throw conflict('This number is already registered', 'MOBILE_REGISTERED');
    const wa = await one("SELECT TOP 1 1 AS y FROM dbo.legal_consents WHERE mobile = @m AND consent_type = 'whatsapp'", { m: T.varchar(r.mobile, 20) }, tx);
    const user = await one(
      `INSERT INTO dbo.users (mobile, name, email, city, photo_key, role, status, whatsapp_opt_in)
       OUTPUT INSERTED.user_id VALUES (@m, @n, @e, @c, @p, 'teacher', 'approved', @wa)`,
      {
        m: T.varchar(r.mobile, 20),
        n: T.nvarchar(r.name, 120),
        e: T.varchar(r.email, 160),
        c: T.nvarchar(r.city, 80),
        p: T.varchar(r.photo_key, 200),
        wa: T.bit(!!wa),
      },
      tx,
    );
    await query(
      `INSERT INTO dbo.teacher_profiles (user_id, subject, experience_years, qualification) VALUES (@u, @s, @e, @q)`,
      { u: T.int(user.user_id), s: T.nvarchar(r.subject, 120), e: T.tinyint(r.experience_years), q: T.nvarchar(r.qualification, 160) },
      tx,
    );
    const now = clock.now();
    await query(
      `UPDATE dbo.teacher_requests SET status = 'approved', user_id = @u, reviewed_by = @a, reviewed_at = @now WHERE request_id = @id`,
      { u: T.int(user.user_id), a: T.int(adminId), now: T.datetime(now), id: T.int(id) },
      tx,
    );
    await consentService.linkToUser(r.mobile, user.user_id, tx);
    await audit({ adminId, action: 'teacher_request.accept', entityType: 'teacher_request', entityId: id, before: { status: 'pending' }, after: { status: 'approved', userId: user.user_id, mobile: maskMobile(r.mobile) }, ip }, tx);
    await notify(user.user_id, { key: 'teacherRequest.accepted', link: '/teacher' }, tx);
    return { id, status: 'approved' };
  });
}

async function reject(id, adminId, reason, ip) {
  return withTransaction(async (tx) => {
    await lockPending(id, tx);
    await query(
      `UPDATE dbo.teacher_requests SET status = 'rejected', reject_reason = @r, reviewed_by = @a, reviewed_at = @now WHERE request_id = @id`,
      { r: T.nvarchar(reason, 500), a: T.int(adminId), now: T.datetime(clock.now()), id: T.int(id) },
      tx,
    );
    await audit({ adminId, action: 'teacher_request.reject', entityType: 'teacher_request', entityId: id, before: { status: 'pending' }, after: { status: 'rejected', reason }, ip }, tx);
    return { id, status: 'rejected' };
  });
}

module.exports = { create, list, accept, reject };
