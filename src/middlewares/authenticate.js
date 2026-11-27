const jwt = require('jsonwebtoken');
const { one, T } = require('../db/query');
const { APIError } = require('../utils/APIError');

// The role/status is re-read from the DB (cached 60s) so blocks take effect quickly.
const CACHE_MS = 60 * 1000;
const cache = new Map();

function clearAuthCache(userId) {
  if (userId === undefined) cache.clear();
  else cache.delete(userId);
}

async function loadUser(userId) {
  const hit = cache.get(userId);
  if (hit && hit.at > Date.now() - CACHE_MS) return hit.user;
  const user = await one(
    `SELECT user_id, public_id, role, status, name, mobile, preferred_lang, deleted_at FROM dbo.users WHERE user_id = @id`,
    { id: T.int(userId) },
  );
  cache.set(userId, { at: Date.now(), user });
  return user;
}

async function authenticate(req, res, next) {
  if (req.user) return next(); // already identified earlier in this request (accessGate)
  try {
    const header = req.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new APIError(401, 'Log in to continue', 'AUTH_REQUIRED');
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    } catch (e) {
      if (e.name === 'TokenExpiredError') throw new APIError(401, 'Your session expired', 'TOKEN_EXPIRED');
      throw new APIError(401, 'Log in to continue', 'AUTH_REQUIRED');
    }
    const user = await loadUser(Number(payload.sub));
    if (!user || user.deleted_at) throw new APIError(401, 'Your session has ended. Log in again.', 'SESSION_ENDED');
    if (user.status === 'blocked') throw new APIError(401, 'Your account is blocked. Contact support.', 'ACCOUNT_BLOCKED');
    if (user.status !== 'approved') throw new APIError(401, 'Your session has ended. Log in again.', 'SESSION_ENDED');
    req.user = { id: user.user_id, publicId: user.public_id, role: user.role, status: user.status, name: user.name, mobile: user.mobile, lang: user.preferred_lang };
    next();
  } catch (err) {
    next(err);
  }
}

// authorize('admin') / authorize('teacher', 'admin') — deny by default.
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(new APIError(401, 'Log in to continue', 'AUTH_REQUIRED'));
    if (!roles.includes(req.user.role)) return next(new APIError(403, 'You do not have access to this', 'FORBIDDEN'));
    return next();
  };
}

module.exports = { authenticate, authorize, clearAuthCache };
