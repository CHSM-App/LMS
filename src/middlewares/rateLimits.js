const rateLimit = require('express-rate-limit');

const skip = () => process.env.NODE_ENV === 'test';
const handler = (req, res) => res.status(429).json({ success: false, error: 'Too many requests. Try again shortly.' });
const common = { standardHeaders: true, legacyHeaders: false, skip, handler };

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, ...common });
const authLimiter = rateLimit({ windowMs: 60 * 1000, limit: 5, ...common });
const publicFormLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 20, ...common });

module.exports = { apiLimiter, authLimiter, publicFormLimiter };
