const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const { notFound, errorHandler } = require('./middlewares/errorHandler');
const { apiLimiter } = require('./middlewares/rateLimits');

// extraRoutes(app) is used only by scripts/e2e-server.js (test hooks); src/server.js never passes it.
function createApp({ getPool, extraRoutes } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.locals.getPool = getPool || require('./db/pool').getPool;

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use(cors({ origin: process.env.WEB_ORIGIN || 'http://localhost:5173', credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  if (process.env.NODE_ENV === 'development') app.use(morgan('dev'));
  app.use('/api/v1', apiLimiter);
  app.use(require('./middlewares/validate').validate);
  app.use('/api/v1', require('./routes'));

  if (extraRoutes) extraRoutes(app);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
