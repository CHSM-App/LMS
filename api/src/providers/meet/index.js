const crypto = require('crypto');

// Google Meet links. MEET_PROVIDER:
//   console - dev: a well-formed fake meet.google.com link
//   manual  - the teacher pastes the link (fallback while Google Workspace is pending)
//   google  - Calendar API (needs GOOGLE_SERVICE_ACCOUNT_JSON + GOOGLE_CALENDAR_ID); see docs/BACKEND_NEEDS.md
const MEET_RE = /^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/;

const letters = (n) => Array.from(crypto.randomBytes(n), (b) => String.fromCharCode(97 + (b % 26))).join('');

const providers = {
  console: { async createLink() { return `https://meet.google.com/${letters(3)}-${letters(4)}-${letters(3)}`; } },
  manual: { async createLink() { return null; } },
  google: {
    async createLink() {
      // Not configured yet: behave like manual so teachers can paste a link.
      if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON || !process.env.GOOGLE_CALENDAR_ID) return null;
      throw new Error('Google Calendar integration is enabled in Phase 10');
    },
  },
};

function provider() {
  return providers[process.env.MEET_PROVIDER || 'console'] || providers.manual;
}

module.exports = {
  createLink: (opts) => provider().createLink(opts),
  isMeetLink: (url) => MEET_RE.test(String(url || '').trim()),
};
