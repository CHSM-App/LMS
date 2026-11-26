const path = require('path');
const OpenApiValidator = require('express-openapi-validator');

const { SPEC_CANDIDATES, resolveFirst } = require('../utils/paths');

// docs/openapi.yaml sits beside api/ in the monorepo, or inside the root on the deployed `backend` branch.
const apiSpec = resolveFirst(SPEC_CANDIDATES) || SPEC_CANDIDATES[1];

// Validates requests against docs/openapi.yaml. Routes are documented phase by phase;
// tests/integration/openapi.test.js checks that every mounted route is documented.
const validator = OpenApiValidator.middleware({
  apiSpec,
  validateRequests: { allowUnknownQueryParameters: false, removeAdditional: false },
  validateResponses: false,
  ignoreUndocumented: true,
  // Multipart and binary routes are validated inside the route (body isn't parsed yet here).
  ignorePaths: /\/api\/v1\/(uploads|files|teacher-requests$|student\/doubts$|teacher\/modules\/\d+\/questions\/import$)/,
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
