const cron = require('node-cron');

// Jobs register here as phases add them: { name, schedule, run }.
const jobs = [];

function register(job) {
  jobs.push(job);
}

function start() {
  for (const job of jobs) {
    cron.schedule(job.schedule, () => {
      job.run().catch((e) => console.error(`[job:${job.name}]`, e.message));
    });
  }
}

module.exports = { register, start, jobs };
