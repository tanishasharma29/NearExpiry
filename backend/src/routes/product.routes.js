import { Router } from 'express';
import {
  createProduct,
  listProducts,
  listSellerOwnProducts,
  getProductById,
  updateProduct,
  deleteProduct,
} from '../controllers/product.controller.js';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware.js';
import { authorizeRoles } from '../middleware/role.middleware.js';
import { validateRequest } from '../middleware/validate.middleware.js';
import { USER_ROLES } from '../models/user.model.js';
import {
  createProductSchema,
  updateProductSchema,
} from '../validators/product.validator.js';

const router = Router();

// 1. Seller's Own Products Listing
router.get(
  '/my-products',
  authenticate,
  authorizeRoles(USER_ROLES.SELLER),
  listSellerOwnProducts
);

router.get(
  '/seller/my-products',
  authenticate,
  authorizeRoles(USER_ROLES.SELLER),
  listSellerOwnProducts
);

// 2. Seller Creates Product
router.post(
  '/',
  authenticate,
  authorizeRoles(USER_ROLES.SELLER),
  validateRequest(createProductSchema),
  createProduct
);

// 3. Public / Customer Discovery (Pagination, Sorting, Filtering — shows ACTIVE products)
router.get('/', optionalAuthenticate, listProducts);

// 4. View Single Product by ID
router.get('/:id', optionalAuthenticate, getProductById);

// 5. Seller Manages Own Product (or Admin manages any Product)
router.put(
  '/:id',
  authenticate,
  authorizeRoles(USER_ROLES.SELLER, USER_ROLES.ADMIN),
  validateRequest(updateProductSchema),
  updateProduct
);

router.patch(
  '/:id',
  authenticate,
  authorizeRoles(USER_ROLES.SELLER, USER_ROLES.ADMIN),
  validateRequest(updateProductSchema),
  updateProduct
);

router.delete(
  '/:id',
  authenticate,
  authorizeRoles(USER_ROLES.SELLER, USER_ROLES.ADMIN),
  deleteProduct
);

export default router;
