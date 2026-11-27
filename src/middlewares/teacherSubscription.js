const { APIError } = require('../utils/APIError');
const subscriptions = require('../services/teacherSubscription.service');

// Limited mode (DECISIONS.md): an expired teacher can log in, but cannot publish courses or approve enrollments.
async function requireActiveTeacherSubscription(req, res, next) {
  try {
    const current = await subscriptions.currentForTeacher(req.user.id);
    if (current.status === 'active') return next();
    const message = current.endDate
      ? `Your subscription ended on ${current.endDate}. Contact the admin to renew.`
      : "You don't have an active subscription yet. Contact the admin.";
    return next(new APIError(403, message, 'TEACHER_SUBSCRIPTION_EXPIRED'));
  } catch (err) {
    return next(err);
  }
}

module.exports = { requireActiveTeacherSubscription };
