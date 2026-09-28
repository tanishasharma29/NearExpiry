import { Router } from 'express';
import {
  createCategory,
  listCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
} from '../controllers/category.controller.js';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware.js';
import { authorizeRoles } from '../middleware/role.middleware.js';
import { validateRequest } from '../middleware/validate.middleware.js';
import { USER_ROLES } from '../models/user.model.js';
import {
  createCategorySchema,
  updateCategorySchema,
} from '../validators/category.validator.js';

const router = Router();

// Public / Customer read routes (optionalAuthenticate lets Admin see INACTIVE categories too)
router.get('/', optionalAuthenticate, listCategories);
router.get('/:id', optionalAuthenticate, getCategoryById);

// Admin-only Category management routes
router.post(
  '/',
  authenticate,
  authorizeRoles(USER_ROLES.ADMIN),
  validateRequest(createCategorySchema),
  createCategory
);

router.put(
  '/:id',
  authenticate,
  authorizeRoles(USER_ROLES.ADMIN),
  validateRequest(updateCategorySchema),
  updateCategory
);

router.patch(
  '/:id',
  authenticate,
  authorizeRoles(USER_ROLES.ADMIN),
  validateRequest(updateCategorySchema),
  updateCategory
);

router.delete(
  '/:id',
  authenticate,
  authorizeRoles(USER_ROLES.ADMIN),
  deleteCategory
);

export default router;
