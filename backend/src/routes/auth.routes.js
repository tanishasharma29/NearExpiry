import { Router } from 'express';
import {
  registerCustomer,
  registerSeller,
  registerAdmin,
  login,
  getMe,
  logout,
} from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validateRequest } from '../middleware/validate.middleware.js';
import {
  registerCustomerSchema,
  registerSellerSchema,
  registerAdminSchema,
  loginSchema,
} from '../validators/auth.validator.js';

const router = Router();

router.post('/register/customer', validateRequest(registerCustomerSchema), registerCustomer);
router.post('/register/seller', validateRequest(registerSellerSchema), registerSeller);
router.post('/register/admin', validateRequest(registerAdminSchema), registerAdmin);
router.post('/login', validateRequest(loginSchema), login);

router.get('/me', authenticate, getMe);
router.post('/logout', authenticate, logout);

export default router;
