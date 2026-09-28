import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import {
  createStoreService,
  getMyStoreService,
  updateStoreService,
  updateMyStoreService,
  listApprovedStoresService,
  getStoreByIdService,
  listAllStoresForAdminService,
  verifyStoreByAdminService,
} from '../services/store.service.js';

/**
 * @desc    Create Store (Seller)
 * @route   POST /api/v1/stores
 * @access  Private (SELLER)
 */
export const createStore = asyncHandler(async (req, res) => {
  const store = await createStoreService(req.user, req.body);
  return res.status(201).json(new ApiResponse(201, 'Store created successfully', { store }));
});

/**
 * @desc    Get Seller's own store
 * @route   GET /api/v1/stores/my-store
 * @access  Private (SELLER)
 */
export const getMyStore = asyncHandler(async (req, res) => {
  const store = await getMyStoreService(req.user._id);
  return res.status(200).json(new ApiResponse(200, 'Your store fetched successfully', { store }));
});

/**
 * @desc    Update Seller's own store via /my-store
 * @route   PUT /api/v1/stores/my-store
 * @route   PATCH /api/v1/stores/my-store
 * @access  Private (SELLER)
 */
export const updateMyStore = asyncHandler(async (req, res) => {
  const store = await updateMyStoreService(req.user, req.body);
  return res.status(200).json(new ApiResponse(200, 'Your store updated successfully', { store }));
});

/**
 * @desc    Update Store by ID (Seller can only update own store; Admin can update any store)
 * @route   PUT /api/v1/stores/:id
 * @route   PATCH /api/v1/stores/:id
 * @access  Private (SELLER, ADMIN)
 */
export const updateStoreById = asyncHandler(async (req, res) => {
  const store = await updateStoreService(req.params.id, req.user, req.body);
  return res.status(200).json(new ApiResponse(200, 'Store updated successfully', { store }));
});

/**
 * @desc    Update Store operational status (OPEN, CLOSED, MAINTENANCE, INACTIVE)
 * @route   PATCH /api/v1/stores/:id/status
 * @access  Private (SELLER for own store, ADMIN for any store)
 */
export const updateStoreStatus = asyncHandler(async (req, res) => {
  const store = await updateStoreService(req.params.id, req.user, req.body);
  return res.status(200).json(new ApiResponse(200, 'Store operational status updated', { store }));
});

/**
 * @desc    List Approved Stores (Customers & Public)
 * @route   GET /api/v1/stores
 * @access  Public / Customer
 */
export const listApprovedStores = asyncHandler(async (req, res) => {
  const stores = await listApprovedStoresService(req.query);
  return res.status(200).json(
    new ApiResponse(200, 'Approved stores fetched successfully', {
      count: stores.length,
      stores,
    })
  );
});

/**
 * @desc    Get Store by ID (Customers see APPROVED only; Seller sees own store only; Admin sees all)
 * @route   GET /api/v1/stores/:id
 * @access  Public / Role-Scoped
 */
export const getStoreById = asyncHandler(async (req, res) => {
  const store = await getStoreByIdService(req.params.id, req.user);
  return res.status(200).json(new ApiResponse(200, 'Store details fetched successfully', { store }));
});

/**
 * @desc    Admin: List all stores (PENDING, APPROVED, REJECTED, SUSPENDED)
 * @route   GET /api/v1/stores/admin/all
 * @access  Private (ADMIN)
 */
export const listAllStoresForAdmin = asyncHandler(async (req, res) => {
  const stores = await listAllStoresForAdminService(req.query);
  return res.status(200).json(
    new ApiResponse(200, 'All stores retrieved for Admin', {
      count: stores.length,
      stores,
    })
  );
});

/**
 * @desc    Admin: Approve / Reject / Suspend a store & seller
 * @route   PATCH /api/v1/stores/:id/verification
 * @access  Private (ADMIN)
 */
export const verifyStoreByAdmin = asyncHandler(async (req, res) => {
  const store = await verifyStoreByAdminService(req.params.id, req.user, req.body);
  return res.status(200).json(
    new ApiResponse(
      200,
      `Store verification status updated to [${store.verificationStatus}]`,
      { store }
    )
  );
});
