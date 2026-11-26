const { authenticate, authorize } = require('./authenticate');

// Deny by default, BEFORE request validation: anonymous or wrong-role callers get 401/403 for every route in a
// protected area, never a 400 that reveals the expected input. The routers still apply the same guards.
// Matching is per path segment, so /teacher-requests (public) is not caught by /teacher.
const AREAS = [
  ['/api/v1/admin', ['admin']],
  ['/api/v1/teacher', ['teacher']],
  ['/api/v1/student', ['student']],
  ['/api/v1/uploads', ['teacher']],
  ['/api/v1/account', null],
  ['/api/v1/notifications', null],
  ['/api/v1/push-tokens', null],
];

function accessGate(req, res, next) {
  const path = req.path;
  const area = AREAS.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`));
  if (!area) return next();
  return authenticate(req, res, (err) => {
    if (err) return next(err);
    if (!area[1]) return next();
    return authorize(...area[1])(req, res, next);
  });
}

module.exports = { accessGate, AREAS };
