require('dotenv').config({ quiet: true });
const { config } = require('./config/env');
const { createApp } = require('./app');
const { getPool } = require('./db/pool');
const jobs = require('./jobs');

const cfg = config();
const app = createApp();
const host = process.env.HOST || '0.0.0.0'; // reachable from other devices on the network
if (typeof cfg.port === 'string') {
  // Named pipe (iisnode): listen on the pipe, there is no host.
  app.listen(cfg.port, () => console.log(`API listening on ${cfg.port}`));
} else {
  app.listen(cfg.port, host, () => console.log(`API listening on http://${host}:${cfg.port}/api/v1`));
}
getPool()
  .then(() => console.log('Database connected'))
  .catch((e) => console.error('Database unavailable:', e.message));
jobs.start();
