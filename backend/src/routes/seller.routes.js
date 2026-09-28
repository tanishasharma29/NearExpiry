import { Router } from 'express';
import {
  getSellerProfile,
  updateSellerProfile,
  getSellerVerificationStatus,
} from '../controllers/seller.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { authorizeRoles } from '../middleware/role.middleware.js';
import { validateRequest } from '../middleware/validate.middleware.js';
import { USER_ROLES } from '../models/user.model.js';
import { updateSellerProfileSchema } from '../validators/sellerStore.validator.js';

const router = Router();

// All seller routes require authentication and SELLER role
router.use(authenticate, authorizeRoles(USER_ROLES.SELLER));

router.get('/profile', getSellerProfile);
router.put('/profile', validateRequest(updateSellerProfileSchema), updateSellerProfile);
router.patch('/profile', validateRequest(updateSellerProfileSchema), updateSellerProfile);
router.get('/verification-status', getSellerVerificationStatus);

export default router;
