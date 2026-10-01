import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { authorizeRoles } from '../middleware/role.middleware.js';
import { validateRequest } from '../middleware/validate.middleware.js';
import {
  verifyQrSchema,
  batchIdParamSchema,
  revokeQrSchema,
} from '../validators/qr.validator.js';
import {
  generateBatchQr,
  verifyBatchQr,
  revokeBatchQr,
  getBatchQrAuditLogs,
} from '../controllers/qr.controller.js';

const router = Router();

// 1. Public Verification Endpoint (GET or POST)
router.get('/verify', validateRequest(verifyQrSchema), verifyBatchQr);
router.post('/verify', validateRequest(verifyQrSchema), verifyBatchQr);

// 2. Protected Seller & Admin Management Endpoints
router.use(authenticate);

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

export default router;
