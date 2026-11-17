const multer = require('multer');
const FileType = require('file-type');
const { APIError } = require('../utils/APIError');

// Allowed types are checked by magic bytes, never by the file name.
const KINDS = {
  image: { exts: ['jpg', 'png', 'webp'], maxMb: 5 },
  document: { exts: ['jpg', 'png', 'webp', 'pdf'], maxMb: 5 },
  pdf: { exts: ['pdf'], maxMb: 20 },
  xlsx: { exts: ['xlsx'], maxMb: 5 },
  attachment: { exts: ['jpg', 'png', 'webp', 'pdf'], maxMb: 5 },
};

async function detect(buffer) {
  const t = await FileType.fromBuffer(buffer);
  return t ? t.ext : null;
}

// fields: [{ name: 'photo', kind: 'image' }]. Puts validated files on req.uploads[name] = { buffer, ext, size, originalName }.
function uploadFields(fields) {
  const maxBytes = Math.max(...fields.map((f) => KINDS[f.kind].maxMb)) * 1024 * 1024;
  const mw = multer({ storage: multer.memoryStorage(), limits: { fileSize: maxBytes, files: fields.length, fields: 40 } }).fields(
    fields.map((f) => ({ name: f.name, maxCount: 1 })),
  );
  return [
    (req, res, next) => mw(req, res, (err) => {
      if (!err) return next();
      if (err.code === 'LIMIT_FILE_SIZE') return next(new APIError(413, 'File is too large'));
      if (err.code === 'LIMIT_UNEXPECTED_FILE') return next(new APIError(400, 'Unexpected file field'));
      return next(err);
    }),
    async (req, res, next) => {
      try {
        req.uploads = {};
        for (const f of fields) {
          const file = req.files && req.files[f.name] && req.files[f.name][0];
          if (!file) continue;
          const spec = KINDS[f.kind];
          if (file.size > spec.maxMb * 1024 * 1024) throw new APIError(413, `File is larger than ${spec.maxMb} MB`);
          const ext = await detect(file.buffer);
          if (!ext || !spec.exts.includes(ext)) throw new APIError(400, 'File type not allowed');
          req.uploads[f.name] = { buffer: file.buffer, ext, size: file.size, originalName: file.originalname };
        }
        next();
      } catch (e) {
        next(e);
      }
    },
  ];
}

module.exports = { uploadFields, detect, KINDS };
