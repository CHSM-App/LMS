const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { query, one, T } = require('../db/query');
const { withTransaction } = require('../db/tx');
const { clock } = require('../utils/clock');
const { APIError } = require('../utils/APIError');

const ACCESS_TTL_SEC = 15 * 60;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
// A rotated token presented again this soon, while its replacement is unused, is a lost response, not theft.
const REUSE_GRACE_MS = 20 * 1000;

const sha256 = (s) => crypto.createHash('sha256').update(s).digest();
const unauthorized = (msg = 'Your session has ended. Log in again.', code = 'SESSION_ENDED') => new APIError(401, msg, code);

function signAccess(user) {
  return jwt.sign({ sub: user.user_id, role: user.role, pid: user.public_id }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: ACCESS_TTL_SEC,
  });
}

async function insertRefresh(userId, familyId, deviceId, tx) {
  const token = crypto.randomBytes(48).toString('base64url');
  const row = await one(
    `INSERT INTO dbo.refresh_tokens (user_id, family_id, token_hash, device_id, expires_at, created_at)
     OUTPUT INSERTED.token_id VALUES (@u, @f, @h, @d, @exp, @now)`,
    {
      u: T.int(userId),
      f: T.uuid(familyId),
      h: T.varbinary(sha256(token)),
      d: T.varchar(deviceId || null, 64),
      exp: T.datetime(new Date(clock.now().getTime() + REFRESH_TTL_MS)),
      now: T.datetime(clock.now()),
    },
    tx,
  );
  return { token, tokenId: row.token_id };
}

async function issue(user, { deviceId } = {}, tx) {
  const { token } = await insertRefresh(user.user_id, crypto.randomUUID(), deviceId, tx);
  return { accessToken: signAccess(user), refreshToken: token };
}

// Rotates a refresh token. Reusing an already-rotated token logs out every session of that user.
async function rotate(refreshToken) {
  if (!refreshToken || typeof refreshToken !== 'string') throw unauthorized();
  const outcome = await withTransaction(async (tx) => {
    const row = await one(
      `SELECT t.token_id, t.user_id, t.family_id, t.device_id, t.expires_at, t.revoked_at, t.replaced_by,
              u.role, u.status, u.public_id, u.deleted_at
       FROM dbo.refresh_tokens t WITH (UPDLOCK) JOIN dbo.users u ON u.user_id = t.user_id
       WHERE t.token_hash = @h`,
      { h: T.varbinary(sha256(refreshToken)) },
      tx,
    );
    if (!row) return { error: unauthorized() };
    if (row.revoked_at) {
      // Lost response: the browser reloaded (or the network dropped) while a refresh was in flight, so the
      // client never stored the replacement. Within a short window, and only while that replacement is still
      // unused, issue a new token in the same family instead of treating it as theft.
      const successor = row.replaced_by
        ? await one('SELECT token_id, revoked_at FROM dbo.refresh_tokens WITH (UPDLOCK) WHERE token_id = @id', { id: T.int(row.replaced_by) }, tx)
        : null;
      const withinGrace = clock.now() - new Date(row.revoked_at) <= REUSE_GRACE_MS;
      if (!successor || successor.revoked_at || !withinGrace || row.deleted_at || row.status !== 'approved') {
        await revokeAllForUser(row.user_id, tx);
        return { error: unauthorized('This session was used somewhere else. Log in again.', 'TOKEN_REUSED') };
      }
      const next = await insertRefresh(row.user_id, row.family_id, row.device_id, tx);
      // The undelivered successor is retired, and the presented token now points at the new one, so a further
      // lost response (rapid reloads) is still recognised — while a successor that was really used is not.
      await query('UPDATE dbo.refresh_tokens SET revoked_at = @now, replaced_by = @n WHERE token_id = @id', { id: T.int(successor.token_id), n: T.int(next.tokenId), now: T.datetime(clock.now()) }, tx);
      await query('UPDATE dbo.refresh_tokens SET replaced_by = @n WHERE token_id = @id', { id: T.int(row.token_id), n: T.int(next.tokenId) }, tx);
      const user = { user_id: row.user_id, role: row.role, public_id: row.public_id };
      return { accessToken: signAccess(user), refreshToken: next.token, userId: row.user_id };
    }
    if (new Date(row.expires_at) <= clock.now() || row.deleted_at || row.status !== 'approved') {
      await query('UPDATE dbo.refresh_tokens SET revoked_at = @now WHERE token_id = @id', { id: T.int(row.token_id), now: T.datetime(clock.now()) }, tx);
      if (row.status === 'blocked') return { error: unauthorized('Your account is blocked. Contact support.', 'ACCOUNT_BLOCKED') };
      return { error: unauthorized() };
    }
    const next = await insertRefresh(row.user_id, row.family_id, row.device_id, tx);
    await query('UPDATE dbo.refresh_tokens SET revoked_at = @now, replaced_by = @n WHERE token_id = @id', {
      id: T.int(row.token_id),
      n: T.int(next.tokenId),
      now: T.datetime(clock.now()),
    }, tx);
    const user = { user_id: row.user_id, role: row.role, public_id: row.public_id };
    return { accessToken: signAccess(user), refreshToken: next.token, userId: row.user_id };
  });
  if (outcome.error) throw outcome.error;
  return outcome;
}

async function revokeByToken(refreshToken) {
  if (!refreshToken) return;
  await query(
    `UPDATE dbo.refresh_tokens SET revoked_at = @now
     WHERE family_id = (SELECT family_id FROM dbo.refresh_tokens WHERE token_hash = @h) AND revoked_at IS NULL`,
    { h: T.varbinary(sha256(refreshToken)), now: T.datetime(clock.now()) },
  );
}

async function revokeAllForUser(userId, tx, { exceptTokenHash } = {}) {
  await query(
    `UPDATE dbo.refresh_tokens SET revoked_at = @now WHERE user_id = @u AND revoked_at IS NULL
       AND (@except IS NULL OR token_hash <> @except)`,
    { u: T.int(userId), now: T.datetime(clock.now()), except: T.varbinary(exceptTokenHash || null) },
    tx,
  );
}

async function ownerOf(refreshToken) {
  const r = await one('SELECT user_id FROM dbo.refresh_tokens WHERE token_hash = @h', { h: T.varbinary(sha256(refreshToken)) });
  return r ? r.user_id : null;
}

function verifyAccess(token) {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
}

module.exports = { issue, rotate, revokeByToken, revokeAllForUser, verifyAccess, ownerOf, sha256, ACCESS_TTL_SEC, REFRESH_TTL_MS };
