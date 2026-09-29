import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import {
  createBatchService,
  listBatchesService,
  getBatchByIdService,
  updateBatchService,
  adjustBatchStockService,
  reserveBatchStockService,
  releaseBatchStockService,
  listInventoryAuditLogsService,
  refreshAllBatchStatusesService,
} from '../services/batchInventory.service.js';

/**
 * @desc    Seller creates a new Batch for a Product
 * @route   POST /api/v1/batches
 * @access  Private (SELLER)
 */
export const createBatch = asyncHandler(async (req, res) => {
  const batch = await createBatchService(req.user, req.body);
  return res.status(201).json(new ApiResponse(201, 'Batch created successfully', { batch }));
});

/**
 * @desc    Public / Customer: List active, non-expired batches in FEFO order
 * @route   GET /api/v1/batches
 * @route   GET /api/v1/batches/product/:productId
 * @access  Public
 */
export const listPublicBatches = asyncHandler(async (req, res) => {
  const query = { ...req.query, ...(req.params.productId && { productId: req.params.productId }) };
  const result = await listBatchesService(query, req.user, 'PUBLIC');
  return res.status(200).json(new ApiResponse(200, 'Batches fetched successfully', result));
});

/**
 * @desc    Seller: List all batches belonging to Seller's store (all statuses)
 * @route   GET /api/v1/batches/my-batches
 * @route   GET /api/v1/inventory/my-inventory
 * @access  Private (SELLER)
 */
export const listSellerBatches = asyncHandler(async (req, res) => {
  const result = await listBatchesService(req.query, req.user, 'SELLER_OWN');
  return res
    .status(200)
    .json(new ApiResponse(200, 'Seller batch inventory fetched successfully', result));
});

/**
 * @desc    Admin: Monitor all batches and inventory across the entire platform
 * @route   GET /api/v1/batches/admin/all
 * @route   GET /api/v1/inventory/admin/all
 * @access  Private (ADMIN)
 */
export const listAdminAllBatches = asyncHandler(async (req, res) => {
  const result = await listBatchesService(req.query, req.user, 'ADMIN_ALL');
  return res
    .status(200)
    .json(new ApiResponse(200, 'Platform-wide batch inventory retrieved for Admin', result));
});

/**
 * @desc    Get single Batch by ID (with live remainingDays & status calculation)
 * @route   GET /api/v1/batches/:id
 * @access  Public / Role-Scoped
 */
export const getBatchById = asyncHandler(async (req, res) => {
  const batch = await getBatchByIdService(req.params.id, req.user);
  return res.status(200).json(new ApiResponse(200, 'Batch details fetched successfully', { batch }));
});

/**
 * @desc    Update Batch metadata (Seller for own batch, Admin for any)
 * @route   PUT /api/v1/batches/:id
 * @route   PATCH /api/v1/batches/:id
 * @access  Private (SELLER, ADMIN)
 */
export const updateBatch = asyncHandler(async (req, res) => {
  const batch = await updateBatchService(req.params.id, req.user, req.body);
  return res.status(200).json(new ApiResponse(200, 'Batch updated successfully', { batch }));
});

/**
 * @desc    Adjust Batch Stock (Seller for own batch, Admin for any — Auditable)
 * @route   PATCH /api/v1/batches/:id/adjust-stock
 * @route   POST /api/v1/inventory/adjust
 * @access  Private (SELLER, ADMIN)
 */
export const adjustBatchStock = asyncHandler(async (req, res) => {
  const batchId = req.params.id || req.body.batchId;
  const result = await adjustBatchStockService(batchId, req.user, req.body);
  return res
    .status(200)
    .json(new ApiResponse(200, 'Batch stock adjusted and logged to audit ledger', result));
});

/**
 * @desc    Reserve Stock on a Batch (Blocks expired or insufficient stock)
 * @route   POST /api/v1/batches/:id/reserve
 * @route   POST /api/v1/inventory/reserve
 * @access  Private (CUSTOMER, SELLER, ADMIN)
 */
export const reserveBatchStock = asyncHandler(async (req, res) => {
  const batchId = req.params.id || req.body.batchId;
  const result = await reserveBatchStockService(batchId, req.user, req.body);
  return res
    .status(200)
    .json(new ApiResponse(200, 'Stock reserved successfully', result));
});

/**
 * @desc    Release Reserved Stock back to Batch Inventory
 * @route   POST /api/v1/batches/:id/release
 * @route   POST /api/v1/inventory/release
 * @access  Private (CUSTOMER, SELLER, ADMIN)
 */
export const releaseBatchStock = asyncHandler(async (req, res) => {
  const batchId = req.params.id || req.body.batchId;
  const result = await releaseBatchStockService(batchId, req.user, req.body);
  return res
    .status(200)
    .json(new ApiResponse(200, 'Reserved stock released successfully', result));
});

/**
 * @desc    List Immutable Inventory Audit Logs
 * @route   GET /api/v1/inventory/logs
 * @route   GET /api/v1/batches/:id/audit-logs
 * @access  Private (SELLER for own store, ADMIN for all stores)
 */
export const listInventoryAuditLogs = asyncHandler(async (req, res) => {
  const query = { ...req.query, ...(req.params.id && { batchId: req.params.id }) };
  const result = await listInventoryAuditLogsService(query, req.user);
  return res
    .status(200)
    .json(new ApiResponse(200, 'Inventory audit logs fetched successfully', result));
});

/**
 * @desc    Refresh remainingDays & statuses across batches
 * @route   POST /api/v1/inventory/refresh-statuses
 * @access  Private (SELLER, ADMIN)
 */
export const refreshAllBatchStatuses = asyncHandler(async (req, res) => {
  const summary = await refreshAllBatchStatusesService(req.user);
  return res
    .status(200)
    .json(new ApiResponse(200, 'Batch shelf-life statuses recalculated', summary));
});
