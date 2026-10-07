import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { authorizeRoles } from '../middleware/role.middleware.js';
import { validateRequest } from '../middleware/validate.middleware.js';
import {
  verifyQrSchema,
  batchIdParamSchema,
  orderIdParamSchema,
  verifyPickupQrSchema,
  revokeQrSchema,
} from '../validators/qr.validator.js';
import {
  generateBatchQr,
  getBatchQr,
  verifyBatchQr,
  revokeBatchQr,
  getBatchQrAuditLogs,
  getPickupQr,
  generatePickupQr,
  verifyPickupQr,
} from '../controllers/qr.controller.js';

const router = Router();

// 1. Public Verification Endpoint (GET or POST)
router.get('/verify', validateRequest(verifyQrSchema), verifyBatchQr);
router.post('/verify', validateRequest(verifyQrSchema), verifyBatchQr);

// 2. Protected Endpoints (Requires Authentication)
router.use(authenticate);

// Batch QR Management (GET & POST for seller/admin)
router.get(
  '/batch/:batchId',
  authorizeRoles('SELLER', 'ADMIN'),
  validateRequest(batchIdParamSchema),
  getBatchQr
);

router.post(
  '/batch/:batchId',
  authorizeRoles('SELLER', 'ADMIN'),
  validateRequest(batchIdParamSchema),
  generateBatchQr
);

router.post(
  '/batch/:batchId/revoke',
  authorizeRoles('SELLER', 'ADMIN'),
  validateRequest(revokeQrSchema),
  revokeBatchQr
);

router.get(
  '/batch/:batchId/audit',
  authorizeRoles('SELLER', 'ADMIN'),
  validateRequest(batchIdParamSchema),
  getBatchQrAuditLogs
);

// Customer Pickup QR Endpoints (GET & POST generate)
router.get(
  '/pickup/:orderId',
  validateRequest(orderIdParamSchema),
  getPickupQr
);

router.post(
  '/pickup/:orderId/generate',
  validateRequest(orderIdParamSchema),
  generatePickupQr
);

// Seller Pickup Verification Endpoint (Counter Scan)
router.post(
  '/pickup/verify',
  authorizeRoles('SELLER', 'ADMIN'),
  validateRequest(verifyPickupQrSchema),
  verifyPickupQr
);

router.post(
  '/verify-pickup',
  authorizeRoles('SELLER', 'ADMIN'),
  validateRequest(verifyPickupQrSchema),
  verifyPickupQr
);

export default router;

