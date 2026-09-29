import { Router } from 'express';
import {
  createBatch,
  listPublicBatches,
  listSellerBatches,
  listAdminAllBatches,
  getBatchById,
  updateBatch,
  adjustBatchStock,
  reserveBatchStock,
  releaseBatchStock,
  listInventoryAuditLogs,
} from '../controllers/batchInventory.controller.js';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware.js';
import { authorizeRoles } from '../middleware/role.middleware.js';
import { validateRequest } from '../middleware/validate.middleware.js';
import { USER_ROLES } from '../models/user.model.js';
import {
  createBatchSchema,
  updateBatchSchema,
  stockAdjustmentSchema,
  stockReservationSchema,
} from '../validators/batchInventory.validator.js';

const router = Router();

// 1. Admin: Monitor all batches across the platform
router.get(
  '/admin/all',
  authenticate,
  authorizeRoles(USER_ROLES.ADMIN),
  listAdminAllBatches
);

// 2. Seller: View own store batches
router.get(
  '/my-batches',
  authenticate,
  authorizeRoles(USER_ROLES.SELLER),
  listSellerBatches
);

// 3. Public / Customer: List active batches (or batches for a specific product in FEFO order)
router.get('/product/:productId', optionalAuthenticate, listPublicBatches);
router.get('/', optionalAuthenticate, listPublicBatches);

// 4. Seller: Create a new Batch
router.post(
  '/',
  authenticate,
  authorizeRoles(USER_ROLES.SELLER),
  validateRequest(createBatchSchema),
  createBatch
);

// 5. View single Batch & Batch Audit Logs
router.get(
  '/:id/audit-logs',
  authenticate,
  authorizeRoles(USER_ROLES.SELLER, USER_ROLES.ADMIN),
  listInventoryAuditLogs
);
router.get('/:id', optionalAuthenticate, getBatchById);

// 6. Update Batch Metadata (Seller for own batch; Admin for any)
router.put(
  '/:id',
  authenticate,
  authorizeRoles(USER_ROLES.SELLER, USER_ROLES.ADMIN),
  validateRequest(updateBatchSchema),
  updateBatch
);
router.patch(
  '/:id',
  authenticate,
  authorizeRoles(USER_ROLES.SELLER, USER_ROLES.ADMIN),
  validateRequest(updateBatchSchema),
  updateBatch
);

// 7. Stock Adjustment, Reservation, and Release on /:id
router.patch(
  '/:id/adjust-stock',
  authenticate,
  authorizeRoles(USER_ROLES.SELLER, USER_ROLES.ADMIN),
  validateRequest(stockAdjustmentSchema),
  adjustBatchStock
);

router.post(
  '/:id/reserve',
  authenticate,
  validateRequest(stockReservationSchema),
  reserveBatchStock
);

router.post(
  '/:id/release',
  authenticate,
  validateRequest(stockReservationSchema),
  releaseBatchStock
);

export default router;
