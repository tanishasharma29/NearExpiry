import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { authorizeRoles } from '../middleware/role.middleware.js';
import { validateRequest } from '../middleware/validate.middleware.js';
import { USER_ROLES } from '../models/user.model.js';
import {
  sellerApprovalSchema,
  userStatusSchema,
  storeStatusSchema,
  productModerationSchema,
  idParamSchema,
} from '../validators/admin.validator.js';
import {
  complaintIdParamSchema,
  adminStatusUpdateSchema,
  adminPriorityUpdateSchema,
  adminAssignSchema,
  adminMessageSchema,
  adminInternalNoteSchema,
  adminResolveComplaintSchema,
} from '../validators/complaint.validator.js';
import {
  getDashboardMetrics,
  listSellers,
  reviewSellerApproval,
  listUsers,
  getUserDetails,
  updateUserStatus,
  listStores,
  getStoreDetails,
  updateStoreStatus,
  listProducts,
  moderateProduct,
  listCategories,
  listPricingRules,
  resetPricingRules,
  triggerManualSweep,
  getInventoryMonitoring,
  getExpiryMonitoring,
  listOrders,
  getOrderDetails,
  getReports,
  getAuditLogs,
} from '../controllers/admin.controller.js';
import {
  listAdminComplaints,
  getAdminComplaintDossier,
  updateAdminComplaintStatus,
  updateAdminComplaintPriority,
  assignAdminComplaint,
  sendAdminMessage,
  addAdminInternalNote,
  resolveAdminComplaint,
} from '../controllers/complaint.controller.js';

const router = Router();

// All Admin routes require valid authentication and ADMIN role
router.use(authenticate, authorizeRoles(USER_ROLES.ADMIN));

// 1. Dashboard
router.get('/dashboard', getDashboardMetrics);

// 2. Seller Approval / Rejection
router.get('/sellers', listSellers);
router.patch('/sellers/:id/approval', validateRequest(sellerApprovalSchema), reviewSellerApproval);

// 3. User Management
router.get('/users', listUsers);
router.get('/users/:id', validateRequest(idParamSchema), getUserDetails);
router.patch('/users/:id/status', validateRequest(userStatusSchema), updateUserStatus);

// 4. Store Management
router.get('/stores', listStores);
router.get('/stores/:id', validateRequest(idParamSchema), getStoreDetails);
router.patch('/stores/:id/status', validateRequest(storeStatusSchema), updateStoreStatus);

// 5. Product Moderation
router.get('/products', listProducts);
router.patch('/products/:id/moderation', validateRequest(productModerationSchema), moderateProduct);

// 6. Category Management
router.get('/categories', listCategories);

// 7. Pricing Rules
router.get('/pricing-rules', listPricingRules);
router.post('/pricing-rules/reset-defaults', resetPricingRules);
router.post('/pricing-rules/trigger-sweep', triggerManualSweep);

// 8. Inventory Monitoring
router.get('/inventory', getInventoryMonitoring);

// 9. Expiry Monitoring
router.get('/expiry', getExpiryMonitoring);

// 10. Order Monitoring
router.get('/orders', listOrders);
router.get('/orders/:id', validateRequest(idParamSchema), getOrderDetails);

// 11. Reports
router.get('/reports', getReports);

// 12. Audit Logs
router.get('/audit-logs', getAuditLogs);

// 13. Support & Dispute Resolution Console
router.get('/complaints', listAdminComplaints);
router.get('/complaints/:complaintId', validateRequest(complaintIdParamSchema), getAdminComplaintDossier);
router.patch('/complaints/:complaintId/status', validateRequest(adminStatusUpdateSchema), updateAdminComplaintStatus);
router.patch('/complaints/:complaintId/priority', validateRequest(adminPriorityUpdateSchema), updateAdminComplaintPriority);
router.patch('/complaints/:complaintId/assign', validateRequest(adminAssignSchema), assignAdminComplaint);
router.post('/complaints/:complaintId/messages', validateRequest(adminMessageSchema), sendAdminMessage);
router.post('/complaints/:complaintId/notes', validateRequest(adminInternalNoteSchema), addAdminInternalNote);
router.post('/complaints/:complaintId/resolve', validateRequest(adminResolveComplaintSchema), resolveAdminComplaint);

export default router;
