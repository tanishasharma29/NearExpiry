import cron from 'node-cron';
import { runExpiryProcessingJob } from '../services/expiryScheduler.service.js';

let dailyMidnightTask = null;
let hourlyCriticalTask = null;

/**
 * Registers and starts the node-cron background schedules for NearExpiry:
 * 1. Daily Midnight Full Sweep ("0 0 * * *") in configured timezone
 * 2. Hourly Sweep ("0 * * * *") to catch intra-day status/expiry transitions & critical alerts
 */
export const startExpiryProcessingCronJobs = () => {
  const timezone = process.env.APP_TIMEZONE || 'Asia/Kolkata';

  // 1. Daily Midnight Full Expiry & Pricing Sweep
  dailyMidnightTask = cron.schedule(
    '0 0 * * *',
    async () => {
      console.log('[Cron] Running Daily Midnight Expiry & Dynamic Pricing Sweep...');
      await runExpiryProcessingJob({ triggerType: 'CRON_SCHEDULED' });
    },
    {
      scheduled: true,
      timezone,
    }
  );

  // 2. Hourly Critical Expiry & Price Tier Sweep
  hourlyCriticalTask = cron.schedule(
    '0 * * * *',
    async () => {
      console.log('[Cron] Running Hourly Expiry & Critical Alert Sweep...');
      await runExpiryProcessingJob({ triggerType: 'CRON_SCHEDULED' });
    },
    {
      scheduled: true,
      timezone,
    }
  );

  console.log(
    `[Jobs] node-cron Expiry Processing Scheduler active (Timezone: ${timezone} | Schedules: '0 0 * * *' & '0 * * * *').`
  );
};

export const stopExpiryProcessingCronJobs = () => {
  if (dailyMidnightTask) dailyMidnightTask.stop();
  if (hourlyCriticalTask) hourlyCriticalTask.stop();
};
