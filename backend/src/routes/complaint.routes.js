import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { authorizeRoles } from '../middleware/role.middleware.js';
import { validateRequest } from '../middleware/validate.middleware.js';
import { USER_ROLES } from '../models/user.model.js';
import {
  createComplaintSchema,
  complaintIdParamSchema,
  customerReplySchema,
} from '../validators/complaint.validator.js';
import {
  createCustomerComplaint,
  listCustomerComplaints,
  getCustomerComplaintDetails,
  replyCustomerComplaint,
  closeCustomerComplaint,
} from '../controllers/complaint.controller.js';

const router = Router();

// All customer complaint endpoints require valid customer authentication
router.use(authenticate, authorizeRoles(USER_ROLES.CUSTOMER));

// 1. Create a new complaint against an order
router.post('/', validateRequest(createComplaintSchema), createCustomerComplaint);

// 2. List all complaints filed by the customer
router.get('/', listCustomerComplaints);

// 3. View details of a specific complaint (sanitized for customer)
router.get('/:complaintId', validateRequest(complaintIdParamSchema), getCustomerComplaintDetails);

// 4. Send reply / communication in the complaint thread
router.post('/:complaintId/messages', validateRequest(customerReplySchema), replyCustomerComplaint);

// 5. Customer acknowledges resolution and closes complaint
router.patch('/:complaintId/close', validateRequest(complaintIdParamSchema), closeCustomerComplaint);

export default router;

