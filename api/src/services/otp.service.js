const crypto = require('crypto');
const { withTransaction } = require('../db/tx');
const { query, one, T } = require('../db/query');
const { otpSender } = require('../providers/otp');
const { clock } = require('../utils/clock');
const { APIError, badRequest } = require('../utils/APIError');

const EXPIRY_MS = 5 * 60 * 1000;
const WINDOW_MS = 15 * 60 * 1000;
const MAX_SENDS = 3;
const MAX_ATTEMPTS = 5;
const RESEND_AFTER_SEC = 30;

const hash = (mobile, purpose, code) =>
  crypto.createHmac('sha256', process.env.OTP_SECRET).update(`${mobile}|${purpose}|${code}`).digest();

const generate = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');

// Sends a new OTP. Same response for known and unknown numbers.
async function send(mobile, purpose) {
  const code = generate();
  const now = clock.now();
  await withTransaction(async (tx) => {
    const row = await one(
      `SELECT TOP 1 otp_id, resend_count, window_started_at FROM dbo.otp_codes WITH (UPDLOCK, HOLDLOCK)
       WHERE mobile = @m AND purpose = @p ORDER BY otp_id DESC`,
      { m: T.varchar(mobile, 20), p: T.varchar(purpose, 20) },
      tx,
    );
    const inWindow = row && now - new Date(row.window_started_at) < WINDOW_MS;
    if (inWindow && row.resend_count >= MAX_SENDS) {
      const waitMin = Math.max(1, Math.ceil((WINDOW_MS - (now - new Date(row.window_started_at))) / 60000));
      throw new APIError(429, `Too many OTP requests. Try again in ${waitMin} minute${waitMin === 1 ? '' : 's'}.`, 'OTP_LIMIT');
    }
    const params = {
      m: T.varchar(mobile, 20),
      p: T.varchar(purpose, 20),
      h: T.varbinary(hash(mobile, purpose, code)),
      exp: T.datetime(new Date(now.getTime() + EXPIRY_MS)),
      now: T.datetime(now),
    };
    if (inWindow) {
      await query(
        `UPDATE dbo.otp_codes SET code_hash = @h, expires_at = @exp, attempts = 0, resend_count = resend_count + 1, consumed_at = NULL
         WHERE otp_id = @id`,
        { ...params, id: T.int(row.otp_id) },
        tx,
      );
    } else {
      await query(
        `INSERT INTO dbo.otp_codes (mobile, purpose, code_hash, expires_at, window_started_at, created_at)
         VALUES (@m, @p, @h, @exp, @now, @now)`,
        params,
        tx,
      );
    }
  });
  try {
    await otpSender().send(mobile, code, purpose);
  } catch (err) {
    // Provider outage: the code was never delivered, so it must not count toward the limit.
    await query(
      `UPDATE TOP (1) dbo.otp_codes SET resend_count = CASE WHEN resend_count > 0 THEN resend_count - 1 ELSE 0 END, consumed_at = @now
       WHERE otp_id = (SELECT MAX(otp_id) FROM dbo.otp_codes WHERE mobile = @m AND purpose = @p)`,
      { m: T.varchar(mobile, 20), p: T.varchar(purpose, 20), now: T.datetime(clock.now()) },
    );
    throw new APIError(503, "Couldn't send OTP. Try again shortly", 'OTP_PROVIDER_DOWN');
  }
  return { sent: true, resendAfterSec: RESEND_AFTER_SEC };
}

// Verifies and consumes an OTP. Throws APIError(400) with a user-facing message otherwise.
async function verify(mobile, purpose, code, tx) {
  const run = async (t) => {
    const row = await one(
      `SELECT TOP 1 otp_id, code_hash, expires_at, attempts, consumed_at FROM dbo.otp_codes WITH (UPDLOCK, HOLDLOCK)
       WHERE mobile = @m AND purpose = @p ORDER BY otp_id DESC`,
      { m: T.varchar(mobile, 20), p: T.varchar(purpose, 20) },
      t,
    );
    const now = clock.now();
    if (!row || row.consumed_at || new Date(row.expires_at) <= now) return { error: 'OTP expired or already used' };
    if (row.attempts >= MAX_ATTEMPTS) return { error: 'Too many wrong attempts. Request a new OTP.' };
    const ok = typeof code === 'string' && /^\d{6}$/.test(code) && crypto.timingSafeEqual(Buffer.from(row.code_hash), hash(mobile, purpose, code));
    if (!ok) {
      await query('UPDATE dbo.otp_codes SET attempts = attempts + 1 WHERE otp_id = @id', { id: T.int(row.otp_id) }, t);
      const left = MAX_ATTEMPTS - row.attempts - 1;
      return { error: left > 0 ? `Wrong OTP. ${left} attempt${left === 1 ? '' : 's'} left.` : 'Too many wrong attempts. Request a new OTP.' };
    }
    await query('UPDATE dbo.otp_codes SET consumed_at = @now WHERE otp_id = @id', { id: T.int(row.otp_id), now: T.datetime(now) }, t);
    return { ok: true };
  };
  // Wrong-attempt counts must persist even though verification fails, so they commit in their own transaction.
  const result = tx ? await run(tx) : await withTransaction(run);
  if (result.error) throw badRequest(result.error, 'OTP_INVALID');
  return true;
}

module.exports = { send, verify, MAX_SENDS, MAX_ATTEMPTS };
