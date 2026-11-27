const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

// Local disk storage under STORAGE_DIR (outside any web root). Keys look like "<kind>/<uuid>.<ext>".
const root = () => path.resolve(process.env.STORAGE_DIR || './storage');
const KEY_RE = /^[a-z_]+\/[0-9a-f-]{36}\.[a-z0-9]{2,5}$/;

function absPath(key) {
  if (!KEY_RE.test(key)) throw new Error('Invalid storage key');
  return path.join(root(), key);
}

async function save(buffer, kind, ext) {
  const key = `${kind}/${crypto.randomUUID()}.${ext}`;
  const full = absPath(key);
  await fsp.mkdir(path.dirname(full), { recursive: true });
  await fsp.writeFile(full, buffer);
  return key;
}

async function moveIn(tempPath, kind, ext) {
  const key = `${kind}/${crypto.randomUUID()}.${ext}`;
  const full = absPath(key);
  await fsp.mkdir(path.dirname(full), { recursive: true });
  await fsp.rename(tempPath, full);
  return key;
}

async function remove(key) {
  if (!key) return;
  try {
    await fsp.unlink(absPath(key));
  } catch {
    /* already gone */
  }
}

function exists(key) {
  try {
    return fs.existsSync(absPath(key));
  } catch {
    return false;
  }
}

const sign = (key, exp) => crypto.createHmac('sha256', process.env.FILE_SIGNING_SECRET || process.env.OTP_SECRET).update(`${key}|${exp}`).digest('base64url');

// Short-lived URL for protected files (default 10 minutes).
function signedUrl(key, ttlSec = 600, now = Date.now()) {
  const exp = Math.floor(now / 1000) + ttlSec;
  return `/api/v1/files/${key}?exp=${exp}&sig=${sign(key, exp)}`;
}

function verifySignature(key, exp, sig, now = Date.now()) {
  if (!exp || !sig || Number(exp) < Math.floor(now / 1000)) return false;
  const expected = Buffer.from(sign(key, Number(exp)));
  const given = Buffer.from(String(sig));
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

const publicUrl = (key) => (key ? `/api/v1/files/${key}` : null);

module.exports = { save, moveIn, remove, exists, absPath, signedUrl, verifySignature, publicUrl, root, KEY_RE };
