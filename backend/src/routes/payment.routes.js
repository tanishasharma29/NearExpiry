import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { authorizeRoles } from '../middleware/role.middleware.js';
import { validateRequest } from '../middleware/validate.middleware.js';
import {
  processPaymentSchema,
  confirmCodSchema,
  refundPaymentSchema,
  getPaymentByIdSchema,
  getPaymentByOrderIdSchema,
} from '../validators/payment.validator.js';
import {
  processPayment,
  confirmCodPayment,
  refundPayment,
  getPaymentByOrderId,
  getPaymentById,
} from '../controllers/payment.controller.js';

const router = Router();

router.use(authenticate);

// Customer processes payment with idempotency
router.post(
  '/process',
  authorizeRoles('CUSTOMER'),
  validateRequest(processPaymentSchema),
  processPayment
);

// Seller / Admin confirms COD payment
router.post(
  '/:paymentId/confirm-cod',
  authorizeRoles('SELLER', 'ADMIN'),
  validateRequest(confirmCodSchema),
  confirmCodPayment
);

// Seller / Admin issues refund
router.post(
  '/:paymentId/refund',
  authorizeRoles('SELLER', 'ADMIN'),
  validateRequest(refundPaymentSchema),
  refundPayment
);

// View payment by order ID or payment ID
router.get(
  '/order/:orderId',
  validateRequest(getPaymentByOrderIdSchema),
  getPaymentByOrderId
);

router.get(
  '/:paymentId',
  validateRequest(getPaymentByIdSchema),
  getPaymentById
);

export default router;
