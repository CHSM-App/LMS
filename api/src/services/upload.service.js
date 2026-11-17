const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const FileType = require('file-type');
const { query, one, T } = require('../db/query');
const storage = require('../providers/storage');
const { clock } = require('../utils/clock');
const { APIError, badRequest, conflict, notFound } = require('../utils/APIError');

const MB = 1024 * 1024;
// Small files go through POST /uploads; videos use resumable sessions.
const SMALL = { thumbnail: { exts: ['jpg', 'png', 'webp'], maxMb: 5 }, photo: { exts: ['jpg', 'png', 'webp'], maxMb: 5 }, pdf: { exts: ['pdf'], maxMb: 20 } };
const LARGE = { video: { exts: ['mp4'], maxMb: 500 }, demo_video: { exts: ['mp4'], maxMb: 500 } };
const CHUNK = 5 * MB;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

const tmpPath = (id) => path.join(storage.root(), 'tmp', `${id}.part`);

async function saveSmall(teacherId, kind, file) {
  const spec = SMALL[kind];
  if (!spec) throw badRequest('kind: choose thumbnail, photo or pdf');
  if (!file) throw badRequest('file: is required');
  if (file.size > spec.maxMb * MB) throw new APIError(413, `File is larger than ${spec.maxMb} MB`);
  const t = await FileType.fromBuffer(file.buffer);
  if (!t || !spec.exts.includes(t.ext)) throw badRequest('File type not allowed', 'FILE_TYPE');
  const key = await storage.save(file.buffer, kind, t.ext);
  await query(
    `INSERT INTO dbo.upload_sessions (teacher_id, kind, file_name, total_bytes, received_bytes, status, file_key, expires_at)
     VALUES (@t, @k, @n, @b, @b, 'complete', @key, @exp)`,
    { t: T.int(teacherId), k: T.varchar(kind, 20), n: T.nvarchar((file.originalname || 'file').slice(0, 200), 200), b: T.bigint(file.size), key: T.varchar(key, 200), exp: T.datetime(clock.now()) },
  );
  return { key, url: storage.signedUrl(key) };
}

async function startSession(teacherId, { kind, fileName, totalBytes }) {
  const spec = LARGE[kind];
  if (!spec) throw badRequest('kind: choose video or demo_video');
  const total = Number(totalBytes);
  if (!Number.isInteger(total) || total <= 0) throw badRequest('totalBytes: must be a positive whole number');
  if (total > spec.maxMb * MB) throw new APIError(413, `Videos can be up to ${spec.maxMb} MB. Use a YouTube, Vimeo or Bunny link for longer videos.`);
  const row = await one(
    `INSERT INTO dbo.upload_sessions (teacher_id, kind, file_name, total_bytes, expires_at)
     OUTPUT INSERTED.upload_id VALUES (@t, @k, @n, @b, @exp)`,
    { t: T.int(teacherId), k: T.varchar(kind, 20), n: T.nvarchar(String(fileName || 'video').slice(0, 200), 200), b: T.bigint(total), exp: T.datetime(new Date(clock.now().getTime() + SESSION_TTL_MS)) },
  );
  await fsp.mkdir(path.dirname(tmpPath(row.upload_id)), { recursive: true });
  await fsp.writeFile(tmpPath(row.upload_id), Buffer.alloc(0));
  return { uploadId: row.upload_id, chunkSize: CHUNK, receivedBytes: 0 };
}

async function getSession(teacherId, uploadId) {
  if (!/^[0-9a-fA-F-]{36}$/.test(uploadId)) throw notFound('Upload not found');
  const s = await one('SELECT * FROM dbo.upload_sessions WHERE upload_id = @id AND teacher_id = @t', { id: T.uuid(uploadId), t: T.int(teacherId) });
  if (!s) throw notFound('Upload not found');
  return s;
}

const status = (s) => ({ uploadId: s.upload_id, kind: s.kind, totalBytes: Number(s.total_bytes), receivedBytes: Number(s.received_bytes), status: s.status, key: s.file_key });

async function sessionStatus(teacherId, uploadId) {
  return status(await getSession(teacherId, uploadId));
}

// Content-Range: bytes start-end/total. The chunk must start exactly where the server stopped.
async function appendChunk(teacherId, uploadId, rangeHeader, body) {
  const s = await getSession(teacherId, uploadId);
  if (s.status !== 'open') throw conflict('This upload is already finished', 'UPLOAD_CLOSED');
  const m = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(rangeHeader || '');
  if (!m || !Buffer.isBuffer(body) || !body.length) throw badRequest('Send the chunk as binary with a Content-Range header');
  const [start, end, total] = m.slice(1).map(Number);
  const received = Number(s.received_bytes);
  if (total !== Number(s.total_bytes) || end - start + 1 !== body.length || end >= total) throw badRequest('Content-Range does not match the chunk');
  if (start !== received) throw conflict('Resume from the last saved byte', 'UPLOAD_OFFSET', { receivedBytes: received });
  if (body.length > CHUNK + 1024) throw new APIError(413, 'Chunk is too large');
  await fsp.appendFile(tmpPath(uploadId), body);
  const updated = await one(
    'UPDATE dbo.upload_sessions SET received_bytes = received_bytes + @n OUTPUT INSERTED.received_bytes WHERE upload_id = @id AND received_bytes = @prev',
    { n: T.bigint(body.length), id: T.uuid(uploadId), prev: T.bigint(received) },
  );
  if (!updated) throw conflict('Resume from the last saved byte', 'UPLOAD_OFFSET', { receivedBytes: received });
  return { receivedBytes: Number(updated.received_bytes) };
}

async function complete(teacherId, uploadId) {
  const s = await getSession(teacherId, uploadId);
  if (s.status === 'complete') return { key: s.file_key, url: storage.signedUrl(s.file_key) };
  if (Number(s.received_bytes) !== Number(s.total_bytes)) throw conflict('The upload is not finished yet', 'UPLOAD_INCOMPLETE', { receivedBytes: Number(s.received_bytes) });
  const t = await FileType.fromFile(tmpPath(uploadId));
  if (!t || !LARGE[s.kind].exts.includes(t.ext)) {
    await fsp.unlink(tmpPath(uploadId)).catch(() => null);
    await query("UPDATE dbo.upload_sessions SET status = 'aborted' WHERE upload_id = @id", { id: T.uuid(uploadId) });
    throw badRequest('File type not allowed', 'FILE_TYPE');
  }
  const key = await storage.moveIn(tmpPath(uploadId), s.kind, t.ext);
  await query("UPDATE dbo.upload_sessions SET status = 'complete', file_key = @k WHERE upload_id = @id", { k: T.varchar(key, 200), id: T.uuid(uploadId) });
  return { key, url: storage.signedUrl(key) };
}

// A key may only be attached by the teacher who uploaded it, and only for the right kinds.
async function assertOwnedKey(teacherId, key, kinds, tx) {
  if (!key) return null;
  const row = await one(
    "SELECT kind FROM dbo.upload_sessions WHERE teacher_id = @t AND file_key = @k AND status = 'complete'",
    { t: T.int(teacherId), k: T.varchar(String(key).slice(0, 200), 200) },
    tx,
  );
  if (!row || !kinds.includes(row.kind)) throw badRequest('Upload the file again', 'UPLOAD_NOT_FOUND');
  return key;
}

// Cleanup job: abandoned sessions after 24h.
async function cleanupExpired() {
  const rows = await query("SELECT upload_id FROM dbo.upload_sessions WHERE status = 'open' AND expires_at < SYSUTCDATETIME()");
  for (const r of rows) {
    await fsp.unlink(tmpPath(r.upload_id)).catch(() => null);
    await query("UPDATE dbo.upload_sessions SET status = 'aborted' WHERE upload_id = @id", { id: T.uuid(r.upload_id) });
  }
  return rows.length;
}

module.exports = { saveSmall, startSession, sessionStatus, appendChunk, complete, assertOwnedKey, cleanupExpired, CHUNK, fs };
