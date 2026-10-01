import { ensureSellerStore } from './store.service.js';
import { applyDynamicPricingToBatchService } from './pricing.service.js';
import { ensureDefaultPriceRulesSeeded } from './priceRule.service.js';
import { PRICE_CHANGE_TRIGGERS } from '../models/priceAudit.model.js';
import mongoose from 'mongoose';
import { Batch, BATCH_STATUS } from '../models/batch.model.js';
import { InventoryAudit, INVENTORY_ACTION_TYPES } from '../models/inventory.model.js';
import { Product } from '../models/product.model.js';
import { Store } from '../models/store.model.js';
import { USER_ROLES } from '../models/user.model.js';
import { Wishlist } from '../models/wishlist.model.js';
import { notifyCustomerWishlistAvailability } from './notification.service.js';
import { ApiError } from '../utils/ApiError.js';
import {
  calculateRemainingDays,
  computeBatchStatus,
  isBatchPurchasable,
} from '../utils/shelfLife.js';

/**
 * Helper: Recomputes remainingDays, status, and isPurchasable on a Batch instance.
 */
export const syncBatchDynamicState = (batchDoc, referenceDate = new Date()) => {
  const remainingDays = calculateRemainingDays(batchDoc.expiryDate, referenceDate);
  const status = computeBatchStatus(remainingDays, batchDoc.quantity);
  const purchasable = isBatchPurchasable(remainingDays, batchDoc.quantity, status);

  batchDoc.remainingDays = remainingDays;
  batchDoc.status = status;
  batchDoc.isPurchasable = purchasable;
  return batchDoc;
};

/**
 * Helper: Enforces that a SELLER can only access/modify their own batch/inventory,
 * while ADMIN can access/monitor all batches.
 */
const assertBatchOwnershipOrAdmin = (batch, requesterUser) => {
  if (!requesterUser) {
    throw new ApiError(401, 'Authentication required.', 'UNAUTHORIZED');
  }

  if (requesterUser.role === USER_ROLES.ADMIN) {
    return true;
  }

  const batchSellerId = batch.sellerId?._id
    ? batch.sellerId._id.toString()
    : batch.sellerId.toString();

  if (
    requesterUser.role === USER_ROLES.SELLER &&
    batchSellerId === requesterUser._id.toString()
  ) {
    return true;
  }

  throw new ApiError(
    403,
    'Forbidden: Sellers can only access and modify their own batch inventory.',
    'FORBIDDEN_BATCH_ACCESS'
  );
};

/**
 * 1. Create a new Batch for a Product (Seller only) & record INITIAL_STOCK in InventoryAudit.
 */
export const createBatchService = async (sellerUser, payload) => {
  // Verify Seller's Store
  let store = await Store.findOne({ ownerId: sellerUser._id });
  if (!store) {
    store = await ensureSellerStore(sellerUser);
  }
  if (!store) {
    throw new ApiError(
      400,
      'You must create a Store before adding product batches.',
      'STORE_REQUIRED'
    );
  }

  // Verify Product exists and belongs to this Seller's Store
  const product = await Product.findById(payload.productId);
  if (!product) {
    throw new ApiError(404, 'Product not found.', 'PRODUCT_NOT_FOUND');
  }

  if (product.storeId.toString() !== store._id.toString()) {
    throw new ApiError(
      403,
      'Forbidden: You can only create batches for products belonging to your own store.',
      'FORBIDDEN_PRODUCT_OWNERSHIP'
    );
  }

  // Check duplicate batchNumber within business scope (storeId + productId + batchNumber)
  const normalizedBatchNum = payload.batchNumber.trim().toUpperCase();
  const duplicateBatch = await Batch.findOne({
    storeId: store._id,
    productId: product._id,
    batchNumber: normalizedBatchNum,
  });

  if (duplicateBatch) {
    throw new ApiError(
      409,
      `Batch number [${normalizedBatchNum}] already exists for product [${product.name}] in your store.`,
      'DUPLICATE_BATCH_NUMBER',
      [{ field: 'batchNumber', message: 'Batch number must be unique per product in your store' }]
    );
  }

  const remainingDays = calculateRemainingDays(payload.expiryDate);
  if (remainingDays < 0) {
    throw new ApiError(
      400,
      'Cannot create an already expired batch.',
      'EXPIRED_BATCH_CREATION_BLOCKED'
    );
  }

  const status = computeBatchStatus(remainingDays, payload.quantity);
  const currentPrice = payload.currentPrice ?? payload.originalPrice;

  const batch = await Batch.create({
    productId: product._id,
    storeId: store._id,
    sellerId: sellerUser._id,
    batchNumber: normalizedBatchNum,
    manufacturingDate: payload.manufacturingDate,
    expiryDate: payload.expiryDate,
    remainingDays,
    initialQuantity: payload.quantity,
    quantity: payload.quantity,
    reservedQuantity: 0,
    soldQuantity: 0,
    originalPrice: payload.originalPrice,
    currentPrice,
    status,
    isPurchasable: isBatchPurchasable(remainingDays, payload.quantity, status),
  });

  // Ensure DB PriceRules are seeded and apply Dynamic Pricing automatically
  await ensureDefaultPriceRulesSeeded();
  await applyDynamicPricingToBatchService(batch, {
    triggerSource: PRICE_CHANGE_TRIGGERS.BATCH_CREATED,
    triggeredBy: sellerUser._id,
  });

  // Write Immutable Audit Entry
  await InventoryAudit.create({
    batchId: batch._id,
    productId: product._id,
    storeId: store._id,
    batchNumber: batch.batchNumber,
    actionType: INVENTORY_ACTION_TYPES.INITIAL_STOCK,
    quantityChange: payload.quantity,
    previousQuantity: 0,
    newQuantity: payload.quantity,
    previousReserved: 0,
    newReserved: 0,
    batchStatusAfter: batch.status,
    reason: 'Initial batch creation by Seller',
    performedBy: sellerUser._id,
    performedByRole: sellerUser.role,
  });

  // Notify customers who bookmarked this product on their wishlist
  if (payload.quantity > 0) {
    Wishlist.find({ productId: product._id })
      .lean()
      .then((wishlists) => {
        for (const w of wishlists) {
          notifyCustomerWishlistAvailability({
            customerId: w.userId,
            product,
            batch,
            store,
          }).catch((err) => console.error('[Notification] Wishlist availability notify error:', err));
        }
      })
      .catch((err) => console.error('[Notification] Wishlist availability query error:', err));
  }

  return batch.populate([
    { path: 'productId', select: 'name brand unit category image' },
    { path: 'storeId', select: 'storeName slug verificationStatus' },
  ]);
};

/**
 * 2. List Batches with Pagination, Sorting (FEFO by default), and Filtering.
 * - Customers / Public: see only purchasable non-expired batches (status in NORMAL, APPROACHING_EXPIRY, CRITICAL & quantity > 0).
 * - Seller: when querying /my-batches, sees all batches belonging to their store (including EXPIRED & OUT_OF_STOCK).
 * - Admin: can monitor all batches across all stores and statuses.
 */
export const listBatchesService = async (query = {}, requesterUser = null, scope = 'PUBLIC') => {
  const page = Math.max(parseInt(query.page || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(query.limit || '20', 10), 1), 100);
  const skip = (page - 1) * limit;

  const filter = {};

  if (scope === 'SELLER_OWN') {
    filter.sellerId = requesterUser._id;
    if (query.status) filter.status = query.status;
  } else if (scope === 'ADMIN_ALL') {
    if (query.status) filter.status = query.status;
    if (query.storeId && mongoose.Types.ObjectId.isValid(query.storeId)) {
      filter.storeId = query.storeId;
    }
    if (query.sellerId && mongoose.Types.ObjectId.isValid(query.sellerId)) {
      filter.sellerId = query.sellerId;
    }
  } else {
    // Public / Customer Discovery -> Never return EXPIRED or OUT_OF_STOCK inventory for purchase
    const now = new Date();
    const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    filter.expiryDate = { $gte: todayUtc };
    filter.quantity = { $gt: 0 };
    filter.status = query.status
      ? query.status
      : { $in: [BATCH_STATUS.NORMAL, BATCH_STATUS.APPROACHING_EXPIRY, BATCH_STATUS.CRITICAL] };
  }

  if (query.productId && mongoose.Types.ObjectId.isValid(query.productId)) {
    filter.productId = query.productId;
  }

  if (query.batchNumber) {
    filter.batchNumber = { $regex: query.batchNumber.trim(), $options: 'i' };
  }

  // Default sort is FEFO (expiryDate ASC, createdAt ASC)
  const allowedSorts = ['expiryDate', 'remainingDays', 'quantity', 'currentPrice', 'createdAt'];
  const sortBy = allowedSorts.includes(query.sortBy) ? query.sortBy : 'expiryDate';
  const sortOrder = query.sortOrder === 'desc' ? -1 : 1;

  const [batches, total] = await Promise.all([
    Batch.find(filter)
      .populate('productId', 'name brand unit category image status')
      .populate('storeId', 'storeName slug address verificationStatus')
      .sort({ [sortBy]: sortOrder, createdAt: 1 })
      .skip(skip)
      .limit(limit),
    Batch.countDocuments(filter),
  ]);

  const enrichedBatches = batches.map((b) => b.toObject());

  return {
    batches: enrichedBatches,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * 3. Get Single Batch by ID (with Role & Ownership Enforcement).
 */
export const getBatchByIdService = async (batchId, requesterUser = null) => {
  if (!mongoose.Types.ObjectId.isValid(batchId)) {
    throw new ApiError(400, 'Invalid batch ID format.', 'INVALID_BATCH_ID');
  }

  const batch = await Batch.findById(batchId)
    .populate('productId', 'name brand unit category image status')
    .populate('storeId', 'storeName slug address verificationStatus');

  if (!batch) {
    throw new ApiError(404, 'Batch not found.', 'BATCH_NOT_FOUND');
  }

  // Batch fields (remainingDays, status, currentPrice, discountPercentage, isPurchasable)
  // are maintained authoritatively in MongoDB by the Expiry Scheduler and Pricing Engine.

  if (requesterUser && requesterUser.role === USER_ROLES.ADMIN) {
    return batch;
  }

  if (requesterUser && requesterUser.role === USER_ROLES.SELLER) {
    if (batch.sellerId.toString() !== requesterUser._id.toString()) {
      throw new ApiError(
        403,
        'Forbidden: Sellers can only view or manage their own store batches.',
        'FORBIDDEN_BATCH_ACCESS'
      );
    }
    return batch;
  }

  return batch;
};

/**
 * 4. Update Batch Metadata (Seller for own batch, or Admin).
 */
export const updateBatchService = async (batchId, requesterUser, payload) => {
  if (!mongoose.Types.ObjectId.isValid(batchId)) {
    throw new ApiError(400, 'Invalid batch ID format.', 'INVALID_BATCH_ID');
  }

  const batch = await Batch.findById(batchId);
  if (!batch) {
    throw new ApiError(404, 'Batch not found.', 'BATCH_NOT_FOUND');
  }

  assertBatchOwnershipOrAdmin(batch, requesterUser);

  if (payload.batchNumber && payload.batchNumber !== batch.batchNumber) {
    const duplicate = await Batch.findOne({
      _id: { $ne: batch._id },
      storeId: batch.storeId,
      productId: batch.productId,
      batchNumber: payload.batchNumber,
    });
    if (duplicate) {
      throw new ApiError(
        409,
        `Batch number [${payload.batchNumber}] already exists for this product in your store.`,
        'DUPLICATE_BATCH_NUMBER'
      );
    }
    batch.batchNumber = payload.batchNumber;
  }

  if (payload.manufacturingDate !== undefined) {
    batch.manufacturingDate = payload.manufacturingDate;
  }
  if (payload.expiryDate !== undefined) {
    batch.expiryDate = payload.expiryDate;
  }
  if (batch.manufacturingDate >= batch.expiryDate) {
    throw new ApiError(
      400,
      'expiryDate must be strictly later than manufacturingDate.',
      'INVALID_BATCH_DATES'
    );
  }

  if (payload.originalPrice !== undefined) batch.originalPrice = payload.originalPrice;
  if (payload.currentPrice !== undefined) batch.currentPrice = payload.currentPrice;

  syncBatchDynamicState(batch);
  await batch.save();

  return batch;
};

/**
 * 5. Auditable Stock Adjustment (Seller for own batch, or Admin).
 * Prevents negative inventory (quantity < 0) and logs movement to InventoryAudit.
 */
export const adjustBatchStockService = async (batchId, requesterUser, payload) => {
  if (!mongoose.Types.ObjectId.isValid(batchId)) {
    throw new ApiError(400, 'Invalid batch ID format.', 'INVALID_BATCH_ID');
  }

  const batch = await Batch.findById(batchId);
  if (!batch) {
    throw new ApiError(404, 'Batch not found.', 'BATCH_NOT_FOUND');
  }

  assertBatchOwnershipOrAdmin(batch, requesterUser);

  const previousQuantity = batch.quantity;
  const previousReserved = batch.reservedQuantity;

  let targetQuantity;
  if (payload.newQuantity !== undefined) {
    targetQuantity = payload.newQuantity;
  } else {
    targetQuantity = previousQuantity + payload.quantityChange;
  }

  if (targetQuantity < 0) {
    throw new ApiError(
      400,
      `Stock adjustment rejected: resulting quantity (${targetQuantity}) cannot be negative. Current available stock is ${previousQuantity}.`,
      'NEGATIVE_INVENTORY_PREVENTED'
    );
  }

  const quantityDelta = targetQuantity - previousQuantity;
  batch.quantity = targetQuantity;
  if (quantityDelta > 0) {
    batch.initialQuantity = Math.max(batch.initialQuantity, targetQuantity + batch.soldQuantity + batch.reservedQuantity);
  }

  syncBatchDynamicState(batch);
  await batch.save();

  const auditRecord = await InventoryAudit.create({
    batchId: batch._id,
    productId: batch.productId,
    storeId: batch.storeId,
    batchNumber: batch.batchNumber,
    actionType: INVENTORY_ACTION_TYPES.STOCK_ADJUSTMENT,
    quantityChange: quantityDelta,
    previousQuantity,
    newQuantity: batch.quantity,
    previousReserved,
    newReserved: batch.reservedQuantity,
    batchStatusAfter: batch.status,
    reason: payload.reason,
    performedBy: requesterUser._id,
    performedByRole: requesterUser.role,
  });

  return {
    batch,
    auditLog: auditRecord,
  };
};

/**
 * 6. Stock Reservation (Locks sellable stock into reservedQuantity).
 * Strictly blocks expired batches (remainingDays < 0 or status === 'EXPIRED')
 * and prevents negative available quantity using atomic conditional MongoDB update.
 */
export const reserveBatchStockService = async (batchId, requesterUser, payload) => {
  if (!mongoose.Types.ObjectId.isValid(batchId)) {
    throw new ApiError(400, 'Invalid batch ID format.', 'INVALID_BATCH_ID');
  }

  const requestedQty = Number(payload.quantity);
  const batch = await Batch.findById(batchId);
  if (!batch) {
    throw new ApiError(404, 'Batch not found.', 'BATCH_NOT_FOUND');
  }

  // Refresh live expiry status before allowing any reservation/sale
  syncBatchDynamicState(batch);

  // Rule 6: Expired inventory can NEVER be sold or reserved
  if (batch.remainingDays < 0 || batch.status === BATCH_STATUS.EXPIRED) {
    await batch.save();
    throw new ApiError(
      400,
      `Batch [${batch.batchNumber}] has EXPIRED (expiryDate: ${batch.expiryDate.toISOString().slice(0, 10)}) and cannot be reserved or sold.`,
      'EXPIRED_INVENTORY_LOCKED'
    );
  }

  if (batch.quantity < requestedQty) {
    throw new ApiError(
      400,
      `Insufficient available stock in batch [${batch.batchNumber}]. Requested: ${requestedQty}, Available: ${batch.quantity}.`,
      'INSUFFICIENT_BATCH_STOCK'
    );
  }

  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  // Atomic conditional update preventing race conditions and negative inventory
  const previousQuantity = batch.quantity;
  const previousReserved = batch.reservedQuantity;
  const newAvailableQty = previousQuantity - requestedQty;
  const newStatus = computeBatchStatus(batch.remainingDays, newAvailableQty);
  const newPurchasable = isBatchPurchasable(batch.remainingDays, newAvailableQty, newStatus);

  const updatedBatch = await Batch.findOneAndUpdate(
    {
      _id: batch._id,
      expiryDate: { $gte: todayUtc },
      quantity: { $gte: requestedQty },
    },
    {
      $inc: {
        quantity: -requestedQty,
        reservedQuantity: requestedQty,
      },
      $set: {
        remainingDays: batch.remainingDays,
        status: newStatus,
        isPurchasable: newPurchasable,
      },
    },
    { new: true }
  );

  if (!updatedBatch) {
    throw new ApiError(
      409,
      'Concurrent stock change or expiry detected during reservation. Please retry.',
      'CONCURRENT_RESERVATION_CONFLICT'
    );
  }

  const auditRecord = await InventoryAudit.create({
    batchId: updatedBatch._id,
    productId: updatedBatch.productId,
    storeId: updatedBatch.storeId,
    batchNumber: updatedBatch.batchNumber,
    actionType: INVENTORY_ACTION_TYPES.STOCK_RESERVATION,
    quantityChange: -requestedQty,
    previousQuantity,
    newQuantity: updatedBatch.quantity,
    previousReserved,
    newReserved: updatedBatch.reservedQuantity,
    batchStatusAfter: updatedBatch.status,
    referenceId: payload.referenceId || null,
    reason: payload.reason || 'Stock reserved for customer checkout/order',
    performedBy: requesterUser._id,
    performedByRole: requesterUser.role,
  });

  return {
    batch: updatedBatch,
    reservedQuantity: requestedQty,
    auditLog: auditRecord,
  };
};

/**
 * 7. Stock Release (Releases reserved stock back to available sellable quantity,
 * or transitions to EXPIRED if the batch expired while reserved).
 */
export const releaseBatchStockService = async (batchId, requesterUser, payload) => {
  if (!mongoose.Types.ObjectId.isValid(batchId)) {
    throw new ApiError(400, 'Invalid batch ID format.', 'INVALID_BATCH_ID');
  }

  const releaseQty = Number(payload.quantity);
  const batch = await Batch.findById(batchId);
  if (!batch) {
    throw new ApiError(404, 'Batch not found.', 'BATCH_NOT_FOUND');
  }

  if (batch.reservedQuantity < releaseQty) {
    throw new ApiError(
      400,
      `Cannot release ${releaseQty} units; batch [${batch.batchNumber}] only has ${batch.reservedQuantity} reserved units.`,
      'INVALID_RELEASE_QUANTITY'
    );
  }

  const previousQuantity = batch.quantity;
  const previousReserved = batch.reservedQuantity;
  const remainingDays = calculateRemainingDays(batch.expiryDate);

  // If the batch expired while reserved, return stock to physical count but mark status = EXPIRED (not purchasable)
  const newAvailableQty = previousQuantity + releaseQty;
  const newStatus = computeBatchStatus(remainingDays, newAvailableQty);
  const newPurchasable = isBatchPurchasable(remainingDays, newAvailableQty, newStatus);

  const updatedBatch = await Batch.findOneAndUpdate(
    {
      _id: batch._id,
      reservedQuantity: { $gte: releaseQty },
    },
    {
      $inc: {
        quantity: releaseQty,
        reservedQuantity: -releaseQty,
      },
      $set: {
        remainingDays,
        status: newStatus,
        isPurchasable: newPurchasable,
      },
    },
    { new: true }
  );

  if (!updatedBatch) {
    throw new ApiError(409, 'Concurrent stock release conflict.', 'CONCURRENT_RELEASE_CONFLICT');
  }

  const auditRecord = await InventoryAudit.create({
    batchId: updatedBatch._id,
    productId: updatedBatch.productId,
    storeId: updatedBatch.storeId,
    batchNumber: updatedBatch.batchNumber,
    actionType: INVENTORY_ACTION_TYPES.STOCK_RELEASE,
    quantityChange: releaseQty,
    previousQuantity,
    newQuantity: updatedBatch.quantity,
    previousReserved,
    newReserved: updatedBatch.reservedQuantity,
    batchStatusAfter: updatedBatch.status,
    referenceId: payload.referenceId || null,
    reason: payload.reason || 'Reserved stock released back to batch inventory',
    performedBy: requesterUser._id,
    performedByRole: requesterUser.role,
  });

  return {
    batch: updatedBatch,
    releasedQuantity: releaseQty,
    auditLog: auditRecord,
  };
};

/**
 * 8. Get Inventory Audit Logs (Seller sees own store logs; Admin sees all platform logs).
 */
export const listInventoryAuditLogsService = async (query = {}, requesterUser) => {
  const page = Math.max(parseInt(query.page || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(query.limit || '25', 10), 1), 100);
  const skip = (page - 1) * limit;

  const filter = {};

  if (requesterUser.role === USER_ROLES.SELLER) {
    const store = await Store.findOne({ ownerId: requesterUser._id });
    if (!store) {
      return { logs: [], pagination: { total: 0, page, limit, totalPages: 1 } };
    }
    filter.storeId = store._id;
  } else if (requesterUser.role === USER_ROLES.ADMIN && query.storeId) {
    filter.storeId = query.storeId;
  }

  if (query.batchId && mongoose.Types.ObjectId.isValid(query.batchId)) {
    filter.batchId = query.batchId;
  }

  if (query.productId && mongoose.Types.ObjectId.isValid(query.productId)) {
    filter.productId = query.productId;
  }

  if (query.actionType) {
    filter.actionType = query.actionType;
  }

  const [logs, total] = await Promise.all([
    InventoryAudit.find(filter)
      .populate('productId', 'name brand unit')
      .populate('storeId', 'storeName slug')
      .populate('performedBy', 'name email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    InventoryAudit.countDocuments(filter),
  ]);

  return {
    logs,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * 9. Admin / Seller Inventory Summary & Status Sweep.
 * Recalculates remainingDays and status across all batches and returns summary counts by status.
 */
export const refreshAllBatchStatusesService = async (requesterUser) => {
  const filter = {};
  if (requesterUser.role === USER_ROLES.SELLER) {
    filter.sellerId = requesterUser._id;
  }

  const batches = await Batch.find(filter);
  let updatedCount = 0;

  const statusBreakdown = {
    [BATCH_STATUS.NORMAL]: 0,
    [BATCH_STATUS.APPROACHING_EXPIRY]: 0,
    [BATCH_STATUS.CRITICAL]: 0,
    [BATCH_STATUS.EXPIRED]: 0,
    [BATCH_STATUS.OUT_OF_STOCK]: 0,
  };

  for (const batch of batches) {
    const prevStatus = batch.status;
    const prevDays = batch.remainingDays;
    syncBatchDynamicState(batch);

    statusBreakdown[batch.status] = (statusBreakdown[batch.status] || 0) + 1;

    if (batch.status !== prevStatus || batch.remainingDays !== prevDays) {
      await batch.save();
      updatedCount += 1;
    }
  }

  return {
    totalBatchesScanned: batches.length,
    batchesUpdated: updatedCount,
    statusBreakdown,
  };
};
