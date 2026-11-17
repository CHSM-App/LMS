require('dotenv').config({ quiet: true });
const { config } = require('./config/env');
const { createApp } = require('./app');
const { getPool } = require('./db/pool');
const jobs = require('./jobs');

const cfg = config();
const app = createApp();
app.listen(cfg.port, () => console.log(`API listening on http://localhost:${cfg.port}/api/v1`));
getPool()
  .then(() => console.log('Database connected'))
  .catch((e) => console.error('Database unavailable:', e.message));
jobs.start();
