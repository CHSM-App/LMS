const express = require('express');
const multer = require('multer');
const { h } = require('../utils/http');
const { authenticate, authorize } = require('../middlewares/authenticate');
const { APIError } = require('../utils/APIError');
const uploads = require('../services/upload.service');

const router = express.Router();
const small = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024, files: 1 } }).single('file');

router.use('/uploads', authenticate, authorize('teacher'));

router.post('/uploads', (req, res, next) => small(req, res, (err) => {
  if (err && err.code === 'LIMIT_FILE_SIZE') return next(new APIError(413, 'File is too large'));
  return next(err);
}), h((req) => uploads.saveSmall(req.user.id, req.body.kind, req.file), 201));

router.post('/uploads/sessions', h((req) => uploads.startSession(req.user.id, req.body), 201));
router.get('/uploads/sessions/:uploadId', h((req) => uploads.sessionStatus(req.user.id, req.params.uploadId)));
router.put(
  '/uploads/sessions/:uploadId',
  express.raw({ type: 'application/octet-stream', limit: '6mb' }),
  h((req) => uploads.appendChunk(req.user.id, req.params.uploadId, req.get('content-range'), req.body)),
);
router.post('/uploads/sessions/:uploadId/complete', h((req) => uploads.complete(req.user.id, req.params.uploadId)));

module.exports = router;
