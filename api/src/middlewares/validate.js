const path = require('path');
const OpenApiValidator = require('express-openapi-validator');

const apiSpec = path.join(__dirname, '../../../docs/openapi.yaml');

// Validates requests against docs/openapi.yaml. Routes are documented phase by phase;
// tests/integration/openapi.test.js checks that every mounted route is documented.
const validator = OpenApiValidator.middleware({
  apiSpec,
  validateRequests: { allowUnknownQueryParameters: false, removeAdditional: false },
  validateResponses: false,
  ignoreUndocumented: true,
  ignorePaths: /\/(uploads|files)\b/,
  fileUploader: false,
  validateSecurity: false,
});

function validate(req, res, next) {
  let i = 0;
  const run = (err) => {
    if (err) return mapError(err, next);
    const mw = validator[i++];
    if (!mw) return next();
    return mw(req, res, run);
  };
  run();
}

function mapError(err, next) {
  if (err.status && err.status < 500 && err.errors) {
    const first = err.errors[0] || {};
    const field = (first.path || '').replace(/^\/(body|query|params)\//, '').replace(/^\.(body|query|params)\./, '');
    const msg = field ? `${field}: ${first.message}` : err.message;
    const e = new Error(msg);
    e.statusCode = err.status === 415 ? 415 : 400;
    e.code = 'VALIDATION_ERROR';
    return next(e);
  }
  return next(err);
}

module.exports = { validate };
