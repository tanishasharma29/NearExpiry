import { Router } from 'express';
import {
  triggerExpiryJobManually,
  listExpiryAlerts,
  acknowledgeExpiryAlert,
  listSchedulerLogs,
} from '../controllers/expiryScheduler.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { authorizeRoles } from '../middleware/role.middleware.js';
import { USER_ROLES } from '../models/user.model.js';

const router = Router();

router.use(authenticate);

// 1. Trigger Expiry & Pricing Job On-Demand (with optional referenceDate for demo simulation)
router.post(
  '/run-job',
  authorizeRoles(USER_ROLES.ADMIN, USER_ROLES.SELLER),
  triggerExpiryJobManually
);

// 2. View & Acknowledge Expiry / Critical Alerts
router.get(
  '/alerts',
  authorizeRoles(USER_ROLES.SELLER, USER_ROLES.ADMIN),
  listExpiryAlerts
);

router.patch(
  '/alerts/:id/acknowledge',
  authorizeRoles(USER_ROLES.SELLER, USER_ROLES.ADMIN),
  acknowledgeExpiryAlert
);

// 3. View node-cron Execution Telemetry Logs
router.get(
  '/job-logs',
  authorizeRoles(USER_ROLES.ADMIN),
  listSchedulerLogs
);

export default router;
