import { startExpiryProcessingCronJobs } from './expiry.job.js';
import { runExpiryProcessingJob } from '../services/expiryScheduler.service.js';

/**
 * Initializes node-cron background jobs and performs an initial non-blocking startup sync
 * so all batches have accurate remainingDays, dynamic prices, and expiry locks immediately on boot.
 */
export const initializeBackgroundJobs = () => {
  startExpiryProcessingCronJobs();

  // Run an initial idempotent sync on server startup
  setImmediate(async () => {
    try {
      await runExpiryProcessingJob({ triggerType: 'STARTUP_SYNC' });
    } catch (err) {
      console.error('[Jobs] Initial startup expiry sync warning:', err.message);
    }
  });
};
