const router = require('express').Router();
const storage = require('../providers/storage');

// Thumbnails, teacher photos and demo videos are public (spec §6). Everything else needs a signed URL.
const PUBLIC_KINDS = new Set(['thumbnail', 'photo', 'demo_video']);

router.get('/files/:kind/:file', (req, res) => {
  const key = `${req.params.kind}/${req.params.file}`;
  if (!storage.KEY_RE.test(key) || !storage.exists(key)) return res.status(404).json({ success: false, error: 'File not found' });
  const isPublic = PUBLIC_KINDS.has(req.params.kind);
  if (!isPublic && !storage.verifySignature(key, req.query.exp, req.query.sig)) {
    return res.status(403).json({ success: false, error: 'This link has expired. Reload the page.' });
  }
  res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  res.set('Cache-Control', isPublic ? 'public, max-age=86400' : 'private, no-store');
  res.set('Content-Disposition', 'inline');
  return res.sendFile(storage.absPath(key), { acceptRanges: true, dotfiles: 'deny' });
});

module.exports = router;
