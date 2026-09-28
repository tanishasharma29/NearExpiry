import { Router } from 'express';
import {
  createStore,
  getMyStore,
  updateMyStore,
  updateStoreById,
  updateStoreStatus,
  listApprovedStores,
  getStoreById,
  listAllStoresForAdmin,
  verifyStoreByAdmin,
} from '../controllers/store.controller.js';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware.js';
import { authorizeRoles } from '../middleware/role.middleware.js';
import { validateRequest } from '../middleware/validate.middleware.js';
import { USER_ROLES } from '../models/user.model.js';
import {
  createStoreSchema,
  updateStoreSchema,
  updateStoreStatusSchema,
  verifyStoreSchema,
} from '../validators/sellerStore.validator.js';

const router = Router();

// 1. Admin Store Management Routes
router.get(
  '/admin/all',
  authenticate,
  authorizeRoles(USER_ROLES.ADMIN),
  listAllStoresForAdmin
);

router.patch(
  '/:id/verification',
  authenticate,
  authorizeRoles(USER_ROLES.ADMIN),
  validateRequest(verifyStoreSchema),
  verifyStoreByAdmin
);

// 2. Seller Own-Store Shortcuts (/api/v1/stores/my-store)
router.get(
  '/my-store',
  authenticate,
  authorizeRoles(USER_ROLES.SELLER),
  getMyStore
);

router.put(
  '/my-store',
  authenticate,
  authorizeRoles(USER_ROLES.SELLER),
  validateRequest(updateStoreSchema),
  updateMyStore
);

router.patch(
  '/my-store',
  authenticate,
  authorizeRoles(USER_ROLES.SELLER),
  validateRequest(updateStoreSchema),
  updateMyStore
);

// 3. Create Store (Seller)
router.post(
  '/',
  authenticate,
  authorizeRoles(USER_ROLES.SELLER),
  validateRequest(createStoreSchema),
  createStore
);

// 4. Customer / Public Discovery of Approved Stores
router.get('/', listApprovedStores);

// 5. View Single Store by ID (Role-aware visibility via optionalAuthenticate)
router.get('/:id', optionalAuthenticate, getStoreById);

// 6. Update Store & Status by ID (Seller can only update own store; Admin can update any store)
router.put(
  '/:id',
  authenticate,
  authorizeRoles(USER_ROLES.SELLER, USER_ROLES.ADMIN),
  validateRequest(updateStoreSchema),
  updateStoreById
);

router.patch(
  '/:id',
  authenticate,
  authorizeRoles(USER_ROLES.SELLER, USER_ROLES.ADMIN),
  validateRequest(updateStoreSchema),
  updateStoreById
);

router.patch(
  '/:id/status',
  authenticate,
  authorizeRoles(USER_ROLES.SELLER, USER_ROLES.ADMIN),
  validateRequest(updateStoreStatusSchema),
  updateStoreStatus
);

export default router;
