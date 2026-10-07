import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { authorizeRoles } from '../middleware/role.middleware.js';
import {
  getBillReceiptByOrderId,
  getSellerBillReceipts,
  getCustomerBillReceipts,
} from '../controllers/billing.controller.js';

const router = Router();

router.use(authenticate);

// View receipt for an order (Customer owning the order, Store Seller, or Admin)
router.get('/order/:orderId', getBillReceiptByOrderId);

// Seller dashboard: View all billing receipts for seller's store
router.get('/seller', authorizeRoles('SELLER', 'ADMIN'), getSellerBillReceipts);

// Customer portal: View all billing receipts for logged-in customer
router.get('/customer', authorizeRoles('CUSTOMER'), getCustomerBillReceipts);

export default router;

