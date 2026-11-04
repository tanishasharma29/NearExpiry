import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { authorizeRoles } from '../middleware/role.middleware.js';
import { validateRequest } from '../middleware/validate.middleware.js';
import { USER_ROLES } from '../models/user.model.js';
import {
  createComplaintSchema,
  complaintIdParamSchema,
  customerReplySchema,
  sellerReplySchema,
  sellerResolveSchema,
} from '../validators/complaint.validator.js';
import {
  createCustomerComplaint,
  listCustomerComplaints,
  getCustomerComplaintDetails,
  replyCustomerComplaint,
  closeCustomerComplaint,
  uploadComplaintEvidence,
  listSellerComplaints,
  getSellerComplaintDetails,
  replySellerComplaint,
  resolveSellerComplaint,
} from '../controllers/complaint.controller.js';

const router = Router();

// -------------------------------------------------------------------------
// EVIDENCE UPLOAD (Customers & Sellers)
// -------------------------------------------------------------------------
router.post(
  '/upload-evidence',
  authenticate,
  authorizeRoles(USER_ROLES.CUSTOMER, USER_ROLES.SELLER),
  uploadComplaintEvidence
);

// -------------------------------------------------------------------------
// SELLER DISPUTE MANAGEMENT
// -------------------------------------------------------------------------
router.get(
  '/seller',
  authenticate,
  authorizeRoles(USER_ROLES.SELLER),
  listSellerComplaints
);

router.get(
  '/seller/:complaintId',
  authenticate,
  authorizeRoles(USER_ROLES.SELLER),
  validateRequest(complaintIdParamSchema),
  getSellerComplaintDetails
);

router.post(
  '/seller/:complaintId/messages',
  authenticate,
  authorizeRoles(USER_ROLES.SELLER),
  validateRequest(sellerReplySchema),
  replySellerComplaint
);

router.patch(
  '/seller/:complaintId/resolve',
  authenticate,
  authorizeRoles(USER_ROLES.SELLER),
  validateRequest(sellerResolveSchema),
  resolveSellerComplaint
);

// -------------------------------------------------------------------------
// CUSTOMER COMPLAINTS (Strict Customer Role)
// -------------------------------------------------------------------------
router.post(
  '/',
  authenticate,
  authorizeRoles(USER_ROLES.CUSTOMER),
  validateRequest(createComplaintSchema),
  createCustomerComplaint
);

router.get(
  '/',
  authenticate,
  authorizeRoles(USER_ROLES.CUSTOMER),
  listCustomerComplaints
);

router.get(
  '/:complaintId',
  authenticate,
  authorizeRoles(USER_ROLES.CUSTOMER),
  validateRequest(complaintIdParamSchema),
  getCustomerComplaintDetails
);

router.post(
  '/:complaintId/messages',
  authenticate,
  authorizeRoles(USER_ROLES.CUSTOMER),
  validateRequest(customerReplySchema),
  replyCustomerComplaint
);

router.patch(
  '/:complaintId/close',
  authenticate,
  authorizeRoles(USER_ROLES.CUSTOMER),
  validateRequest(complaintIdParamSchema),
  closeCustomerComplaint
);

export default router;
