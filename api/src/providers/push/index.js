const crypto = require('crypto');
const logger = require('../../utils/logger');

// Push notifications through Firebase Cloud Messaging (HTTP v1). PUSH_PROVIDER:
//   console - dev/test (default): records messages, sends nothing
//   fcm     - FIREBASE_SERVICE_ACCOUNT_JSON (the whole service-account JSON) or FIREBASE_SERVICE_ACCOUNT_FILE (path to it)
// send() resolves { ok: true } or { ok: false, invalidToken: true|false }; it never throws.
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const sent = [];
let cached = null; // { token, expiresAt }

const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');

function serviceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    || (process.env.FIREBASE_SERVICE_ACCOUNT_FILE && require('fs').readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_FILE, 'utf8'));
  if (!raw) throw new Error('Firebase service account is not configured');
  return JSON.parse(raw);
}

async function accessToken(sa) {
  if (cached && cached.expiresAt > Date.now() + 60000) return cached.token;
  const now = Math.floor(Date.now() / 1000);
  const claims = { iss: sa.client_email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 };
  const unsigned = `${b64url({ alg: 'RS256', typ: 'JWT' })}.${b64url(claims)}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(unsigned), sa.private_key).toString('base64url');
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }).toString(),
  });
  if (!res.ok) throw new Error(`Google token endpoint responded ${res.status}`);
  const body = await res.json();
  cached = { token: body.access_token, expiresAt: Date.now() + (body.expires_in || 3600) * 1000 };
  return cached.token;
}

const consoleProvider = {
  async send(msg) {
    sent.push(msg);
    return { ok: true };
  },
};

const fcmProvider = {
  async send({ token, title, body, link }) {
    try {
      const sa = serviceAccount();
      const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${await accessToken(sa)}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            token,
            notification: { title, body },
            data: { link: link || '' },
            android: { priority: 'high' },
          },
        }),
      });
      if (res.ok) return { ok: true };
      const err = await res.json().catch(() => ({}));
      const dead = (err.error?.details || []).some((d) => d.errorCode === 'UNREGISTERED') || err.error?.status === 'NOT_FOUND';
      logger.warn({ event: 'push_failed', status: res.status, dead });
      return { ok: false, invalidToken: dead };
    } catch (e) {
      logger.warn({ event: 'push_failed', err: e.message });
      return { ok: false, invalidToken: false };
    }
  },
};

const provider = () => ((process.env.PUSH_PROVIDER || 'console') === 'fcm' ? fcmProvider : consoleProvider);

module.exports = {
  send: (msg) => provider().send(msg),
  sentMessages: () => sent,
  clearSent: () => sent.splice(0, sent.length),
  _resetTokenCache: () => { cached = null; },
};
