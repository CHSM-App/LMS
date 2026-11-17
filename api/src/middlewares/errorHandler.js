const logger = require('../utils/logger');

function notFound(req, res) {
  res.status(404).json({ success: false, error: 'Not found' });
}

// SQL Server duplicate-key errors surface as 409 instead of 500.
function mapSqlError(err) {
  if (err && (err.number === 2627 || err.number === 2601)) {
    return { statusCode: 409, message: 'This record already exists' };
  }
  return null;
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const mapped = mapSqlError(err);
  let status = mapped ? mapped.statusCode : err.statusCode || err.status || 500;
  if (err.type === 'entity.too.large' || err.code === 'LIMIT_FILE_SIZE') status = 413;
  const env = process.env.NODE_ENV || 'development';
  let message = mapped ? mapped.message : err.message;
  if (status === 413 && err.code === 'LIMIT_FILE_SIZE') message = 'File is too large';
  if (status >= 500 && env === 'production') message = 'Something went wrong. Try again.';
  const body = { success: false, error: message };
  if (typeof err.code === 'string' && status < 500 && !err.code.startsWith('LIMIT_')) body.code = err.code;
  if (err.details) body.details = err.details;
  if (env === 'development' && status >= 500) body.stack = err.stack;
  if (status === 403) logger.warn({ event: 'forbidden', method: req.method, path: req.originalUrl.split('?')[0], userId: req.user ? req.user.id : null, code: body.code || null });
  if (status >= 500) logger.error({ event: 'server_error', method: req.method, path: req.originalUrl.split('?')[0], err: err.message, stack: env === 'production' ? undefined : err.stack });
  res.status(status).json(body);
}

module.exports = { notFound, errorHandler };
