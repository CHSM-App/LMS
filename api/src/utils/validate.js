const { badRequest } = require('./APIError');
const { normalizeMobile } = require('./mobile');

// Small validators for routes OpenAPI can't check (multipart) and for cross-field rules.
function requireMobile(value, field = 'mobile') {
  const m = normalizeMobile(String(value || ''));
  if (!m) throw badRequest('Enter a valid 10-digit mobile number', 'VALIDATION_ERROR', { field });
  return m;
}

function text(value, field, { min = 1, max = 200, required = true } = {}) {
  const v = value === undefined || value === null ? '' : String(value).trim();
  if (!v) {
    if (required) throw badRequest(`${field}: is required`, 'VALIDATION_ERROR', { field });
    return null;
  }
  if (v.length < min || v.length > max) throw badRequest(`${field}: must be ${min}-${max} characters`, 'VALIDATION_ERROR', { field });
  return v;
}

function int(value, field, { min = 0, max = 1e9, required = true } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw badRequest(`${field}: is required`, 'VALIDATION_ERROR', { field });
    return null;
  }
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw badRequest(`${field}: must be a whole number from ${min} to ${max}`, 'VALIDATION_ERROR', { field });
  return n;
}

// A required email: empty -> 400 with details.field, so forms can mark the field.
function requiredEmail(value, message = 'Enter your email address', field = 'email') {
  const v = email(value, field);
  if (!v) throw badRequest(message, 'VALIDATION_ERROR', { field });
  return v;
}

function email(value, field = 'email') {
  const v = text(value, field, { required: false, max: 160 });
  if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw badRequest('Enter a valid email address', 'VALIDATION_ERROR', { field });
  return v ? v.toLowerCase() : null;
}

const bool = (value) => value === true || value === 'true' || value === '1' || value === 1 || value === 'on';

function isoDate(value, field, { required = true } = {}) {
  if (!value) {
    if (required) throw badRequest(`${field}: is required`, 'VALIDATION_ERROR', { field });
    return null;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw badRequest(`${field}: use the format YYYY-MM-DD`, 'VALIDATION_ERROR', { field });
  }
  return value;
}

module.exports = { requireMobile, text, int, email, requiredEmail, bool, isoDate };
