const cron = require('node-cron');

// Scheduled work runs inside Node (SQL Server Express has no SQL Agent).
const jobs = [
  {
    name: 'subscription-reminders',
    schedule: '30 3 * * *', // 09:00 IST daily
    run: () => require('../services/teacherSubscription.service').runSubscriptionReminders(),
  },
  {
    name: 'otp-cleanup',
    schedule: '15 * * * *',
    run: () => require('../db/query').query("DELETE FROM dbo.otp_codes WHERE created_at < DATEADD(DAY, -2, SYSUTCDATETIME())"),
  },
];

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
