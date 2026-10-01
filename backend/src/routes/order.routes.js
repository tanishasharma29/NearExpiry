import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { authorizeRoles } from '../middleware/role.middleware.js';
import { validateRequest } from '../middleware/validate.middleware.js';
import {
  createOrderSchema,
  updateOrderStatusSchema,
  cancelOrderSchema,
  getOrderByIdSchema,
  listOrdersQuerySchema,
} from '../validators/order.validator.js';
import {
  createOrder,
  getCustomerOrders,
  getSellerOrders,
  getOrderById,
  trackOrder,
  updateOrderStatus,
  cancelOrder,
} from '../controllers/order.controller.js';

const router = Router();

router.use(authenticate);

// 1. Customer Order Placement & History
router.post(
  '/',
  authorizeRoles('CUSTOMER'),
  validateRequest(createOrderSchema),
  createOrder
);

router.get(
  '/',
  authorizeRoles('CUSTOMER'),
  validateRequest(listOrdersQuerySchema),
  getCustomerOrders
);

// 2. Seller Store Orders
router.get(
  '/seller',
  authorizeRoles('SELLER'),
  validateRequest(listOrdersQuerySchema),
  getSellerOrders
);

// 3. Tracking & Order Details
router.get(
  '/:orderId/track',
  validateRequest(getOrderByIdSchema),
  trackOrder
);

router.get(
  '/:orderId',
  validateRequest(getOrderByIdSchema),
  getOrderById
);

// 4. Status Update (SELLER / ADMIN)
router.patch(
  '/:orderId/status',
  authorizeRoles('SELLER', 'ADMIN'),
  validateRequest(updateOrderStatusSchema),
  updateOrderStatus
);

// 5. Cancellation (CUSTOMER / SELLER / ADMIN)
router.post(
  '/:orderId/cancel',
  validateRequest(cancelOrderSchema),
  cancelOrder
);

export default router;
