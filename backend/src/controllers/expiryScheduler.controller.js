import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import {
  runExpiryProcessingJob,
  listExpiryAlertsService,
  acknowledgeExpiryAlertService,
  listSchedulerLogsService,
} from '../services/expiryScheduler.service.js';

/**
 * @desc    Manually trigger the Expiry-Processing & Dynamic Pricing Job (supports optional simulatedDate)
 * @route   POST /api/v1/expiry/run-job
 * @access  Private (ADMIN, SELLER)
 */
export const triggerExpiryJobManually = asyncHandler(async (req, res) => {
  const referenceDate = req.body?.referenceDate ? new Date(req.body.referenceDate) : new Date();
  if (Number.isNaN(referenceDate.getTime())) {
    throw new ApiError(400, 'Invalid referenceDate format.', 'INVALID_REFERENCE_DATE');
  }

  const metrics = await runExpiryProcessingJob({
    triggerType: 'ADMIN_MANUAL',
    referenceDate,
    triggeredBy: req.user._id,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, 'Expiry processing job executed successfully', { metrics }));
});

/**
 * @desc    List Expiry & Critical Alerts (Seller sees own store alerts; Admin sees all)
 * @route   GET /api/v1/expiry/alerts
 * @access  Private (SELLER, ADMIN)
 */
export const listExpiryAlerts = asyncHandler(async (req, res) => {
  const result = await listExpiryAlertsService(req.query, req.user);
  return res
    .status(200)
    .json(new ApiResponse(200, 'Expiry alerts fetched successfully', result));
});

/**
 * @desc    Acknowledge an Expiry Alert
 * @route   PATCH /api/v1/expiry/alerts/:id/acknowledge
 * @access  Private (SELLER, ADMIN)
 */
export const acknowledgeExpiryAlert = asyncHandler(async (req, res) => {
  try {
    const alert = await acknowledgeExpiryAlertService(req.params.id, req.user);
    return res
      .status(200)
      .json(new ApiResponse(200, 'Expiry alert acknowledged', { alert }));
  } catch (err) {
    throw new ApiError(
      err.message.includes('Forbidden') ? 403 : 404,
      err.message,
      'ALERT_ACKNOWLEDGE_ERROR'
    );
  }
});

/**
 * @desc    List Scheduler Execution Logs
 * @route   GET /api/v1/expiry/job-logs
 * @access  Private (ADMIN)
 */
export const listSchedulerLogs = asyncHandler(async (req, res) => {
  const logs = await listSchedulerLogsService(req.query.limit);
  return res.status(200).json(
    new ApiResponse(200, 'Scheduler execution logs fetched successfully', {
      count: logs.length,
      logs,
    })
  );
});
