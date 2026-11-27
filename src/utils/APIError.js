class APIError extends Error {
  constructor(status, message, code, details) {
    super(message);
    this.statusCode = status;
    this.code = code;
    this.details = details;
  }
}

const badRequest = (msg, code, details) => new APIError(400, msg, code, details);
const forbidden = (msg = 'You do not have access to this', code) => new APIError(403, msg, code);
const notFound = (msg = 'Not found') => new APIError(404, msg);
const conflict = (msg, code, details) => new APIError(409, msg, code, details);

module.exports = { APIError, badRequest, forbidden, notFound, conflict };
