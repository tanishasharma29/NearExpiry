import { Router } from 'express';
import {
  listSellerBatches,
  listAdminAllBatches,
  adjustBatchStock,
  reserveBatchStock,
  releaseBatchStock,
  listInventoryAuditLogs,
  refreshAllBatchStatuses,
} from '../controllers/batchInventory.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { authorizeRoles, requireApprovedSeller } from '../middleware/role.middleware.js';
import { validateRequest } from '../middleware/validate.middleware.js';
import { USER_ROLES } from '../models/user.model.js';
import {
  stockAdjustmentSchema,
  stockReservationSchema,
} from '../validators/batchInventory.validator.js';

const router = Router();

// All /api/v1/inventory routes require authentication
router.use(authenticate);

// 1. Seller & Admin Inventory Dashboards
router.get('/my-inventory', authorizeRoles(USER_ROLES.SELLER), listSellerBatches);
router.get('/admin/all', authorizeRoles(USER_ROLES.ADMIN), listAdminAllBatches);

// 2. Immutable Inventory Audit Logs
router.get('/logs', authorizeRoles(USER_ROLES.SELLER, USER_ROLES.ADMIN), listInventoryAuditLogs);

// 3. Stock Adjustment (Seller for own batch; Admin for any)
router.post(
  '/adjust',
  authorizeRoles(USER_ROLES.SELLER, USER_ROLES.ADMIN),
  requireApprovedSeller,
  validateRequest(stockAdjustmentSchema),
  adjustBatchStock
);

// 4. Stock Reservation & Release
router.post('/reserve', validateRequest(stockReservationSchema), reserveBatchStock);
router.post('/release', validateRequest(stockReservationSchema), releaseBatchStock);

// 5. Recalculate remainingDays & Batch Statuses
router.post(
  '/refresh-statuses',
  authorizeRoles(USER_ROLES.SELLER, USER_ROLES.ADMIN),
  requireApprovedSeller,
  refreshAllBatchStatuses
);

export default router;
