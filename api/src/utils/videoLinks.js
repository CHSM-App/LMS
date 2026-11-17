const { badRequest } = require('./APIError');

// Allowed linked-video hosts (DECISIONS.md: link or upload per video).
const PATTERNS = {
  youtube: /^https:\/\/(www\.|m\.)?(youtube\.com\/(watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)[\w-]{6,}/,
  vimeo: /^https:\/\/(www\.|player\.)?vimeo\.com\/(video\/)?\d+/,
  bunny: /^https:\/\/(iframe|video|player)\.mediadelivery\.net\/(embed|play)\/\d+\/[\w-]+/,
};
const NAMES = { youtube: 'YouTube', vimeo: 'Vimeo', bunny: 'Bunny Stream' };

function validateVideoLink(source, url) {
  const re = PATTERNS[source];
  if (!re) throw badRequest('videoSource: choose upload, youtube, vimeo or bunny');
  if (typeof url !== 'string' || url.length > 500 || !re.test(url.trim())) throw badRequest(`Enter a valid ${NAMES[source]} link`, 'INVALID_VIDEO_LINK');
  return url.trim();
}

function validateHttpUrl(url, field = 'url') {
  try {
    const u = new URL(String(url));
    if (!['http:', 'https:'].includes(u.protocol) || String(url).length > 500) throw new Error('bad');
    return u.toString();
  } catch {
    throw badRequest(`${field}: enter a full web address starting with https://`, 'VALIDATION_ERROR');
  }
}

module.exports = { validateVideoLink, validateHttpUrl, VIDEO_SOURCES: ['upload', ...Object.keys(PATTERNS)] };
