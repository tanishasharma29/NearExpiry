import { Router } from 'express';
import {
  getMyBranches,
  getStoreBranches,
  getActiveBranches,
  createBranch,
  updateBranch,
  toggleBranchStatus,
  setPrimaryBranch,
  getBranchInventory,
} from '../controllers/branch.controller.js';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware.js';
import { authorizeRoles } from '../middleware/role.middleware.js';
import { validateRequest } from '../middleware/validate.middleware.js';
import { USER_ROLES } from '../models/user.model.js';
import {
  createBranchSchema,
  updateBranchSchema,
  updateBranchStatusSchema,
} from '../validators/branch.validator.js';

const router = Router();

// 1. Seller Own-Store Branches
router.get(
  '/my-branches',
  authenticate,
  authorizeRoles(USER_ROLES.SELLER),
  getMyBranches
);

// 2. Public / Customer Discovery of Active Store Branches
router.get(
  '/store/:storeId',
  optionalAuthenticate,
  getStoreBranches
);

// 2.1 Public / Customer Discovery of All Active Branches for Location Selection
router.get(
  '/active',
  getActiveBranches
);

// 3. Create Branch (Seller Only)
router.post(
  '/',
  authenticate,
  authorizeRoles(USER_ROLES.SELLER),
  validateRequest(createBranchSchema),
  createBranch
);

// 4. Branch Inventory Telemetry (Seller or Admin)
router.get(
  '/:id/inventory',
  authenticate,
  authorizeRoles(USER_ROLES.SELLER, USER_ROLES.ADMIN),
  getBranchInventory
);

// 5. Update Branch (Seller or Admin)
router.put(
  '/:id',
  authenticate,
  authorizeRoles(USER_ROLES.SELLER, USER_ROLES.ADMIN),
  validateRequest(updateBranchSchema),
  updateBranch
);

router.patch(
  '/:id',
  authenticate,
  authorizeRoles(USER_ROLES.SELLER, USER_ROLES.ADMIN),
  validateRequest(updateBranchSchema),
  updateBranch
);

// 6. Toggle Branch Active / Inactive Status
router.patch(
  '/:id/status',
  authenticate,
  authorizeRoles(USER_ROLES.SELLER, USER_ROLES.ADMIN),
  validateRequest(updateBranchStatusSchema),
  toggleBranchStatus
);

// 7. Set Primary Branch (Seller Only)
router.patch(
  '/:id/primary',
  authenticate,
  authorizeRoles(USER_ROLES.SELLER),
  setPrimaryBranch
);

export default router;

