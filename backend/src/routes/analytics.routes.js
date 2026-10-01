import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { authorizeRoles } from '../middleware/role.middleware.js';
import { validateRequest } from '../middleware/validate.middleware.js';
import { USER_ROLES } from '../models/user.model.js';
import { analyticsQuerySchema } from '../validators/analytics.validator.js';
import {
  getSellerAnalytics,
  getAdminAnalytics,
} from '../controllers/analytics.controller.js';

const router = Router();

router.use(authenticate);

// 1. Seller Analytics (Requires SELLER role)
router.get(
  '/seller',
  authorizeRoles(USER_ROLES.SELLER),
  validateRequest(analyticsQuerySchema),
  getSellerAnalytics
);

// 2. Admin Analytics (Requires ADMIN role)
router.get(
  '/admin',
  authorizeRoles(USER_ROLES.ADMIN),
  validateRequest(analyticsQuerySchema),
  getAdminAnalytics
);

export default router;
