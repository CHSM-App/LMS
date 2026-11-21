const crypto = require('crypto');
const logger = require('../../utils/logger');

// Google Meet links. MEET_PROVIDER:
//   console - dev: a well-formed fake meet.google.com link
//   manual  - the teacher pastes the link (fallback while Google Workspace is pending)
//   google  - Calendar API on GOOGLE_CALENDAR_ID, signed in one of two ways (see docs/BACKEND_NEEDS.md):
//             a) OAuth refresh token of one account: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
//             b) service account: GOOGLE_SERVICE_ACCOUNT_JSON (+ GOOGLE_IMPERSONATE_USER for domain-wide delegation)
// createLink() returns null whenever a link can't be made, so the teacher is asked to paste one.
const MEET_RE = /^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/;
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/calendar.events';

const letters = (n) => Array.from(crypto.randomBytes(n), (b) => String.fromCharCode(97 + (b % 26))).join('');
const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');

let cached = null; // { token, expiresAt }

// OAuth refresh token for one Google account (works with a free Gmail or an Internal Workspace app).
const hasRefreshToken = () => Boolean(process.env.GOOGLE_REFRESH_TOKEN && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

function refreshTokenGrant() {
  return {
    grant_type: 'refresh_token',
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
  };
}

function serviceAccountGrant() {
  const sa = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const now = Math.floor(Date.now() / 1000);
  const claims = { iss: sa.client_email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 };
  if (process.env.GOOGLE_IMPERSONATE_USER) claims.sub = process.env.GOOGLE_IMPERSONATE_USER;
  const unsigned = `${b64url({ alg: 'RS256', typ: 'JWT' })}.${b64url(claims)}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(unsigned), sa.private_key).toString('base64url');
  return { grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` };
}

async function accessToken() {
  if (cached && cached.expiresAt > Date.now() + 60000) return cached.token;
  const grant = hasRefreshToken() ? refreshTokenGrant() : serviceAccountGrant();
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(grant).toString(),
  });
  if (!res.ok) throw new Error(`Google token endpoint responded ${res.status}`);
  const body = await res.json();
  cached = { token: body.access_token, expiresAt: Date.now() + (body.expires_in || 3600) * 1000 };
  return cached.token;
}

const google = {
  async createLink({ title, start, durationMin }) {
    if (!process.env.GOOGLE_CALENDAR_ID) return null;
    if (!hasRefreshToken() && !process.env.GOOGLE_SERVICE_ACCOUNT_JSON) return null;
    try {
      const token = await accessToken();
      const begin = new Date(start);
      const end = new Date(begin.getTime() + (durationMin || 60) * 60000);
      const calendar = encodeURIComponent(process.env.GOOGLE_CALENDAR_ID);
      const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendar}/events?conferenceDataVersion=1`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: title,
          start: { dateTime: begin.toISOString() },
          end: { dateTime: end.toISOString() },
          conferenceData: { createRequest: { requestId: crypto.randomUUID(), conferenceSolutionKey: { type: 'hangoutsMeet' } } },
        }),
      });
      if (!res.ok) throw new Error(`Calendar API responded ${res.status}`);
      const event = await res.json();
      return MEET_RE.test(event.hangoutLink || '') ? event.hangoutLink : null;
    } catch (err) {
      logger.warn({ event: 'meet_link_failed', err: err.message });
      return null;
    }
  },
};

const providers = {
  console: { async createLink() { return `https://meet.google.com/${letters(3)}-${letters(4)}-${letters(3)}`; } },
  manual: { async createLink() { return null; } },
  google,
};

function provider() {
  return providers[process.env.MEET_PROVIDER || 'console'] || providers.manual;
}

module.exports = {
  createLink: (opts) => provider().createLink(opts),
  // Only the Google provider makes real links. Live classes never get a console (fake) link.
  createsRealLinks: () => process.env.MEET_PROVIDER === 'google',
  isMeetLink: (url) => MEET_RE.test(String(url || '').trim()),
};
