// Offline video downloads (DECISIONS.md "Offline video download rules"; SECURITY.md §6b).
// Licence per (student, content, device): 7 days offline, never past the subscription end, renewed online.
const crypto = require('crypto');
const fs = require('fs');
const { query, one, T } = require('../db/query');
const storage = require('../providers/storage');
const { courseAccess, loadContent, isVisible } = require('./studentAccess');
const { loadEnrollment } = require('../middlewares/enrollment');
const { clock, todayIST } = require('../utils/clock');
const { APIError, badRequest, conflict, notFound } = require('../utils/APIError');

const MAX_DEVICES = 2;
const OFFLINE_MS = 7 * 86400000;
const DEVICE_RE = /^[\w-]{6,64}$/;

const endOfDayIST = (date) => new Date(`${new Date(date).toISOString().slice(0, 10)}T23:59:59+05:30`);
const keyFor = (keyId, deviceId) =>
  crypto.createHmac('sha256', process.env.DOWNLOAD_KEY_SECRET || process.env.OTP_SECRET).update(`${String(keyId).toLowerCase()}|${deviceId}`).digest('base64');

function checkDeviceId(id) {
  if (!DEVICE_RE.test(String(id || ''))) throw badRequest('deviceId: 6-64 letters, numbers or dashes');
  return String(id);
}

async function activeDevice(studentId, deviceId) {
  return one('SELECT * FROM dbo.student_devices WHERE student_id = @s AND device_id = @d AND removed_at IS NULL', { s: T.int(studentId), d: T.varchar(deviceId, 64) });
}

async function registerDevice(studentId, { deviceId, deviceName, platform }) {
  const id = checkDeviceId(deviceId);
  if (await activeDevice(studentId, id)) return { deviceId: id, registered: true };
  const { n } = await one('SELECT COUNT(*) n FROM dbo.student_devices WHERE student_id = @s AND removed_at IS NULL', { s: T.int(studentId) });
  if (n >= MAX_DEVICES) throw conflict('Downloads are allowed on 2 devices. Remove one in Profile → Downloads.', 'DEVICE_LIMIT');
  const params = { s: T.int(studentId), d: T.varchar(id, 64), n: T.nvarchar(String(deviceName || '').slice(0, 80) || null, 80), p: T.varchar(['android', 'ios', 'web'].includes(platform) ? platform : null, 10), now: T.datetime(clock.now()) };
  const re = await query('UPDATE dbo.student_devices SET removed_at = NULL, registered_at = @now, device_name = @n, platform = @p OUTPUT INSERTED.device_id WHERE student_id = @s AND device_id = @d', params);
  if (!re.length) await query('INSERT INTO dbo.student_devices (student_id, device_id, device_name, platform, registered_at) VALUES (@s, @d, @n, @p, @now)', params);
  return { deviceId: id, registered: true };
}

async function listDevices(studentId) {
  const rows = await query(
    `SELECT d.device_id, d.device_name, d.platform, d.registered_at,
            (SELECT COUNT(*) FROM dbo.offline_downloads o WHERE o.student_id = d.student_id AND o.device_id = d.device_id AND o.revoked_at IS NULL) AS downloads
     FROM dbo.student_devices d WHERE d.student_id = @s AND d.removed_at IS NULL ORDER BY d.registered_at`,
    { s: T.int(studentId) },
  );
  return rows.map((r) => ({ deviceId: r.device_id, deviceName: r.device_name, platform: r.platform, registeredAt: r.registered_at, downloads: r.downloads }));
}

async function revokeDevice(studentId, deviceId, reason) {
  await query(
    'UPDATE dbo.offline_downloads SET revoked_at = @now, revoke_reason = @r WHERE student_id = @s AND device_id = @d AND revoked_at IS NULL',
    { now: T.datetime(clock.now()), r: T.varchar(reason, 30), s: T.int(studentId), d: T.varchar(deviceId, 64) },
  );
}

async function removeDevice(studentId, deviceId) {
  const id = checkDeviceId(deviceId);
  const res = await query('UPDATE dbo.student_devices SET removed_at = @now OUTPUT INSERTED.device_id WHERE student_id = @s AND device_id = @d AND removed_at IS NULL', {
    now: T.datetime(clock.now()), s: T.int(studentId), d: T.varchar(id, 64),
  });
  if (!res.length) throw notFound('Device not found');
  await revokeDevice(studentId, id, 'device_removed');
  return { removed: true };
}

// Why a licence can't be (re)issued right now, or null when it can.
async function blockReason(studentId, content) {
  const e = await loadEnrollment(studentId, content.course_id);
  if (!e || e.status !== 'approved') return 'not_enrolled';
  if (e.teacher_status === 'blocked') {
    const p = await one('SELECT completed_at FROM dbo.content_progress WHERE student_id = @s AND content_id = @c', { s: T.int(studentId), c: T.int(content.content_id) });
    return p && p.completed_at ? null : 'teacher_inactive';
  }
  if (!e.start_date) return 'not_enrolled';
  if (!e.access_enabled) return 'access_paused';
  const today = todayIST();
  if (today > new Date(e.end_date).toISOString().slice(0, 10)) return 'subscription_ended';
  if (today < new Date(e.start_date).toISOString().slice(0, 10)) return 'not_started';
  return null;
}

async function licenceExpiry(studentId, content) {
  const e = await loadEnrollment(studentId, content.course_id);
  const max = new Date(clock.now().getTime() + OFFLINE_MS);
  if (e.teacher_status === 'blocked' || !e.end_date) return max;
  const end = endOfDayIST(e.end_date);
  return end < max ? end : max;
}

async function issue(studentId, contentId, deviceId) {
  const dev = checkDeviceId(deviceId);
  if (!(await activeDevice(studentId, dev))) throw new APIError(403, 'Register this device first', 'DEVICE_NOT_REGISTERED');
  const c = await loadContent(contentId);
  if (!c) throw notFound('Lesson not found');
  if (c.type !== 'video' && c.type !== 'live') throw badRequest('Only videos can be downloaded');
  const { enrollment } = await courseAccess(studentId, c.course_id);
  if (!isVisible(c, enrollment)) throw notFound('Lesson not found');
  if (c.type === 'live' && !c.video_source) throw conflict('The recording is not ready yet', 'NO_RECORDING');
  if (c.video_source !== 'upload') throw conflict('This video can only be watched online', 'ONLINE_ONLY');
  const reason = await blockReason(studentId, c);
  if (reason) throw new APIError(403, reason === 'teacher_inactive' ? "This course is read-only because the teacher's account is inactive" : 'You cannot download this lesson now', 'DOWNLOAD_NOT_ALLOWED');
  const expires = await licenceExpiry(studentId, c);
  const params = { s: T.int(studentId), c: T.int(c.content_id), d: T.varchar(dev, 64), exp: T.datetime(expires), now: T.datetime(clock.now()) };
  let row = await one(
    `UPDATE dbo.offline_downloads SET license_expires_at = @exp, last_renewed_at = @now, revoked_at = NULL, revoke_reason = NULL
     OUTPUT INSERTED.* WHERE student_id = @s AND content_id = @c AND device_id = @d`,
    params,
  );
  if (!row) {
    row = await one(
      'INSERT INTO dbo.offline_downloads (student_id, content_id, device_id, license_expires_at, last_renewed_at) OUTPUT INSERTED.* VALUES (@s, @c, @d, @exp, @now)',
      params,
    );
  }
  let sizeBytes = 0;
  try {
    sizeBytes = fs.statSync(storage.absPath(c.file_key)).size;
  } catch {
    sizeBytes = 0;
  }
  return {
    contentId: c.content_id,
    title: c.title,
    downloadUrl: storage.signedUrl(c.file_key, 600),
    keyId: row.key_id,
    key: keyFor(row.key_id, dev),
    licenseExpiresAt: new Date(row.license_expires_at).toISOString(),
    sizeBytes,
  };
}

async function renew(studentId, deviceId, contentIds) {
  const dev = checkDeviceId(deviceId);
  if (!Array.isArray(contentIds) || contentIds.length > 500) throw badRequest('contentIds: send up to 500 lesson ids');
  const deviceOk = !!(await activeDevice(studentId, dev));
  const out = [];
  for (const raw of contentIds) {
    const id = Number(raw);
    const row = await one('SELECT * FROM dbo.offline_downloads WHERE student_id = @s AND content_id = @c AND device_id = @d', { s: T.int(studentId), c: T.int(id), d: T.varchar(dev, 64) });
    if (!row || row.revoked_at) {
      out.push({ contentId: id, revoked: true, reason: row ? row.revoke_reason || 'revoked' : 'not_found' });
      continue;
    }
    const c = await one('SELECT * FROM dbo.contents WHERE content_id = @c', { c: T.int(id) });
    const reason = !deviceOk ? 'device_removed' : !c ? 'content_removed' : await blockReason(studentId, c);
    if (reason) {
      await query('UPDATE dbo.offline_downloads SET revoked_at = @now, revoke_reason = @r WHERE download_id = @id', { now: T.datetime(clock.now()), r: T.varchar(reason, 30), id: T.int(row.download_id) });
      out.push({ contentId: id, revoked: true, reason });
      continue;
    }
    const expires = await licenceExpiry(studentId, c);
    await query('UPDATE dbo.offline_downloads SET license_expires_at = @exp, last_renewed_at = @now WHERE download_id = @id', { exp: T.datetime(expires), now: T.datetime(clock.now()), id: T.int(row.download_id) });
    out.push({ contentId: id, licenseExpiresAt: expires.toISOString() });
  }
  return out;
}

module.exports = { registerDevice, listDevices, removeDevice, revokeDevice, issue, renew, MAX_DEVICES };
