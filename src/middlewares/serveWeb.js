const fs = require('fs');
const path = require('path');
const express = require('express');
const { webDistCandidates } = require('../utils/paths');

// Serves the built web app (web/dist) from the same origin as the API, so one domain hosts both.
// WEB_DIST_DIR points at the build. In production it defaults to public/ (deployed backend branch) or ../web/dist (monorepo).
// With no build present nothing is mounted and the API behaves exactly as before.
function webDir() {
  if (process.env.WEB_DIST_DIR) return path.resolve(process.env.WEB_DIST_DIR);
  if (process.env.NODE_ENV === 'production') {
    return webDistCandidates().find((d) => fs.existsSync(path.join(d, 'index.html'))) || null;
  }
  return null;
}

function serveWeb(app) {
  const dir = webDir();
  if (!dir || !fs.existsSync(path.join(dir, 'index.html'))) return;
  // Hashed build assets can be cached for a long time; index.html must always be re-fetched.
  app.use(express.static(dir, { index: false, setHeaders: (res, file) => {
    if (file.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  } }));
  // Client-side routes (/student/courses/12) fall back to index.html. Only GET/HEAD, and never under /api.
  app.use((req, res, next) => {
    if ((req.method !== 'GET' && req.method !== 'HEAD') || req.path.startsWith('/api/')) return next();
    res.setHeader('Cache-Control', 'no-cache');
    return res.sendFile(path.join(dir, 'index.html'), { dotfiles: 'deny' });
  });
}

module.exports = { serveWeb };
