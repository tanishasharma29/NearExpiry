import mongoose from 'mongoose';
import { User, USER_ROLES, VERIFICATION_STATUS } from '../models/user.model.js';
import { Store } from '../models/store.model.js';
import { Product, PRODUCT_STATUS } from '../models/product.model.js';
import { Category } from '../models/category.model.js';
import { Batch, BATCH_STATUS } from '../models/batch.model.js';
import { Order, ORDER_STATUS } from '../models/order.model.js';
import { InventoryAudit } from '../models/inventory.model.js';
import { PriceRule } from '../models/priceRule.model.js';
import { PriceAuditLog } from '../models/priceAudit.model.js';
import { ExpiryAlert } from '../models/expiryAlert.model.js';
import { ApiError } from '../utils/ApiError.js';
import { toCalendarDayEpochUTC } from '../utils/shelfLife.js';
import { resetDefaultPriceRulesService } from './priceRule.service.js';
import { runExpiryProcessingJob } from './expiryScheduler.service.js';
import {
  notifySellerStoreApproved,
  notifySellerStoreRejected,
} from './notification.service.js';
import { invalidateProductCache } from '../utils/cache.util.js';
import { emitToAdmin } from '../config/socket.js';
import { SOCKET_EVENTS } from '../constants/socketEvents.js';

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/**
 * 1. Admin Dashboard Metrics.
 * Computes high-performance live aggregates across the entire platform.
 */
export const getAdminDashboardMetricsService = async () => {
  const [
    totalCustomers,
    totalSellers,
    activeStores,
    totalStores,
    productCounts,
    batchStats,
    orderStats,
  ] = await Promise.all([
    User.countDocuments({ role: USER_ROLES.CUSTOMER }),
    User.countDocuments({ role: USER_ROLES.SELLER }),
    Store.countDocuments({ isActive: true, verificationStatus: VERIFICATION_STATUS.APPROVED }),
    Store.countDocuments(),
    Product.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]),
    Batch.aggregate([
      {
        $group: {
          _id: '$status',
          totalUnits: { $sum: '$quantity' },
          totalLots: { $sum: 1 },
          totalSoldUnits: { $sum: '$soldQuantity' },
        },
      },
    ]),
    Order.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalRevenue: { $sum: '$pricingSummary.finalTotal' },
          totalSavings: { $sum: '$pricingSummary.totalSavings' },
        },
      },
    ]),
  ]);

  // Products Breakdown
  const products = {
    total: 0,
    active: 0,
    inactive: 0,
    draft: 0,
    archived: 0,
  };
  for (const p of productCounts) {
    products.total += p.count;
    if (p._id === 'ACTIVE') products.active = p.count;
    if (p._id === 'INACTIVE') products.inactive = p.count;
    if (p._id === 'DRAFT') products.draft = p.count;
    if (p._id === 'ARCHIVED') products.archived = p.count;
  }

  // Inventory Breakdown
  const inventoryByStatus = {};
  let totalSoldUnits = 0;
  for (const b of batchStats) {
    inventoryByStatus[b._id] = {
      units: b.totalUnits,
      lots: b.totalLots,
    };
    totalSoldUnits += b.totalSoldUnits || 0;
  }

  const nearExpiryInventory = inventoryByStatus[BATCH_STATUS.APPROACHING_EXPIRY] || { units: 0, lots: 0 };
  const criticalInventory = inventoryByStatus[BATCH_STATUS.CRITICAL] || { units: 0, lots: 0 };
  const expiredInventory = inventoryByStatus[BATCH_STATUS.EXPIRED] || { units: 0, lots: 0 };

  // Orders & Financials
  const orders = {
    total: 0,
    byStatus: {},
  };
  let totalRevenue = 0;
  let totalCustomerSavings = 0;

  for (const o of orderStats) {
    orders.total += o.count;
    orders.byStatus[o._id] = o.count;
    if (o._id !== ORDER_STATUS.CANCELLED) {
      totalRevenue += o.totalRevenue;
      totalCustomerSavings += o.totalSavings;
    }
  }

  // Environmental Impact & Food Rescue
  const inventoryRescued = {
    totalRescuedUnits: totalSoldUnits,
    rescuedOrdersCount:
      (orders.byStatus[ORDER_STATUS.DELIVERED] || 0) +
      (orders.byStatus[ORDER_STATUS.CONFIRMED] || 0) +
      (orders.byStatus[ORDER_STATUS.PACKED] || 0) +
      (orders.byStatus[ORDER_STATUS.READY_FOR_PICKUP] || 0) +
      (orders.byStatus[ORDER_STATUS.OUT_FOR_DELIVERY] || 0) +
      (orders.byStatus[ORDER_STATUS.PLACED] || 0),
  };

  const wastePrevented = {
    totalRescuedUnits: totalSoldUnits,
    estimatedKgSaved: round2(totalSoldUnits * 0.45), // ~0.45kg average grocery unit weight
    customerSavingsAmount: round2(totalCustomerSavings),
  };

  return {
    totalCustomers,
    totalSellers,
    activeStores,
    totalStores,
    products,
    nearExpiryInventory,
    criticalInventory,
    expiredInventory,
    orders,
    revenue: round2(totalRevenue),
    inventoryRescued,
    wastePrevented,
    generatedAt: new Date(),
  };
};

/**
 * 2. Seller Approval / Rejection.
 */
export const listSellersService = async (queryParams = {}) => {
  const page = Math.max(1, parseInt(queryParams.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(queryParams.limit || '20', 10)));
  const skip = (page - 1) * limit;

  const filter = { role: USER_ROLES.SELLER };
  if (queryParams.verificationStatus) {
    filter.verificationStatus = queryParams.verificationStatus;
  }
  if (queryParams.search) {
    filter.$or = [
      { name: { $regex: queryParams.search, $options: 'i' } },
      { email: { $regex: queryParams.search, $options: 'i' } },
      { 'sellerProfile.storeName': { $regex: queryParams.search, $options: 'i' } },
    ];
  }

  const [sellers, total] = await Promise.all([
    User.find(filter).select('-password').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);

  // Attach associated store documents
  const sellerIds = sellers.map((s) => s._id);
  const stores = await Store.find({ ownerId: { $in: sellerIds } }).lean();
  const storeMap = new Map(stores.map((st) => [st.ownerId.toString(), st]));

  const enrichedSellers = sellers.map((s) => ({
    ...s,
    store: storeMap.get(s._id.toString()) || null,
  }));

  return {
    sellers: enrichedSellers,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

export const reviewSellerApprovalService = async (sellerId, payload, adminUser) => {
  if (!mongoose.Types.ObjectId.isValid(sellerId)) {
    throw new ApiError(400, 'Invalid seller ID format.', 'INVALID_SELLER_ID');
  }

  const seller = await User.findOne({ _id: sellerId, role: USER_ROLES.SELLER });
  if (!seller) {
    throw new ApiError(404, 'Seller not found.', 'SELLER_NOT_FOUND');
  }

  const { status, rejectionReason } = payload;
  const now = new Date();

  seller.verificationStatus = status;
  if (!seller.sellerProfile) {
    seller.sellerProfile = { storeName: 'Store' };
  }
  seller.sellerProfile.reviewedAt = now;
  seller.sellerProfile.reviewedBy = adminUser._id;
  seller.sellerProfile.rejectionReason = rejectionReason || null;
  await seller.save();

  // Synchronize Seller's Store
  const store = await Store.findOne({ ownerId: seller._id });
  if (store) {
    store.verificationStatus = status;
    store.isActive = status === VERIFICATION_STATUS.APPROVED;
    store.verificationAudit = {
      reviewedBy: adminUser._id,
      reviewedAt: now,
      rejectionReason: status === VERIFICATION_STATUS.REJECTED ? rejectionReason || null : null,
    };
    await store.save();
  }

  // Generate real in-app notification for the seller after successful persistence
  const storeName = store?.storeName || seller.sellerProfile?.storeName || 'Your Store';
  if (status === VERIFICATION_STATUS.APPROVED) {
    await notifySellerStoreApproved({
      sellerId: seller._id,
      storeName,
    }).catch((err) => {
      console.error('[AdminService] Store approval notification failed:', err.message);
    });
  } else if (status === VERIFICATION_STATUS.REJECTED) {
    await notifySellerStoreRejected({
      sellerId: seller._id,
      storeName,
      rejectionReason,
    }).catch((err) => {
      console.error('[AdminService] Store rejection notification failed:', err.message);
    });
  }

  // Real-Time Socket.IO Alert to Admins
  try {
    emitToAdmin(SOCKET_EVENTS.ADMIN_ALERT, {
      alertType: 'SELLER_VERIFICATION_REVIEWED',
      title: `Seller ${status}`,
      message: `Seller [${seller.name}] store application reviewed: ${status}.`,
      severity: status === VERIFICATION_STATUS.APPROVED ? 'SUCCESS' : 'WARNING',
      entityId: seller._id,
      timestamp: new Date().toISOString(),
    });
  } catch (sockErr) {
    console.error('[Socket.IO] Error emitting seller review admin alert:', sockErr);
  }

  return {
    seller: {
      _id: seller._id,
      name: seller.name,
      email: seller.email,
      verificationStatus: seller.verificationStatus,
      sellerProfile: seller.sellerProfile,
    },
    store: store
      ? {
          _id: store._id,
          storeName: store.storeName,
          verificationStatus: store.verificationStatus,
          isActive: store.isActive,
        }
      : null,
    reviewedAt: now,
  };
};

/**
 * 3. User Management.
 */
export const listUsersService = async (queryParams = {}) => {
  const page = Math.max(1, parseInt(queryParams.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(queryParams.limit || '20', 10)));
  const skip = (page - 1) * limit;

  const filter = {};
  if (queryParams.role) {
    filter.role = queryParams.role;
  }
  if (queryParams.isActive !== undefined) {
    filter.isActive = queryParams.isActive === 'true' || queryParams.isActive === true;
  }
  if (queryParams.search) {
    filter.$or = [
      { name: { $regex: queryParams.search, $options: 'i' } },
      { email: { $regex: queryParams.search, $options: 'i' } },
      { phone: { $regex: queryParams.search, $options: 'i' } },
    ];
  }

  const [users, total] = await Promise.all([
    User.find(filter).select('-password').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);

  return {
    users,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

export const getUserDetailsService = async (userId) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(400, 'Invalid user ID format.', 'INVALID_USER_ID');
  }

  const user = await User.findById(userId).select('-password').lean();
  if (!user) {
    throw new ApiError(404, 'User not found.', 'USER_NOT_FOUND');
  }

  const [ordersCount, store] = await Promise.all([
    Order.countDocuments({ customerId: user._id }),
    user.role === USER_ROLES.SELLER ? Store.findOne({ ownerId: user._id }).lean() : null,
  ]);

  return {
    user,
    ordersCount,
    store,
  };
};

export const updateUserStatusService = async (userId, payload, adminUser) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(400, 'Invalid user ID format.', 'INVALID_USER_ID');
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'User not found.', 'USER_NOT_FOUND');
  }

  if (user.role === USER_ROLES.ADMIN && user._id.toString() === adminUser._id.toString()) {
    throw new ApiError(400, 'Admins cannot deactivate their own account.', 'CANNOT_SELF_DEACTIVATE');
  }

  user.isActive = payload.isActive;
  await user.save();

  // If user is a seller, toggle store status accordingly
  if (user.role === USER_ROLES.SELLER) {
    await Store.findOneAndUpdate(
      { ownerId: user._id },
      { $set: { isActive: payload.isActive } }
    );
  }

  return {
    userId: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    updatedAt: new Date(),
  };
};

/**
 * 4. Store Management.
 */
export const listStoresAdminService = async (queryParams = {}) => {
  const page = Math.max(1, parseInt(queryParams.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(queryParams.limit || '20', 10)));
  const skip = (page - 1) * limit;

  const filter = {};
  if (queryParams.verificationStatus) {
    filter.verificationStatus = queryParams.verificationStatus;
  }
  if (queryParams.isActive !== undefined) {
    filter.isActive = queryParams.isActive === 'true' || queryParams.isActive === true;
  }
  if (queryParams.city) {
    filter['address.city'] = { $regex: queryParams.city, $options: 'i' };
  }
  if (queryParams.search) {
    filter.$or = [
      { storeName: { $regex: queryParams.search, $options: 'i' } },
      { contactPhone: { $regex: queryParams.search, $options: 'i' } },
    ];
  }

  const [stores, total] = await Promise.all([
    Store.find(filter)
      .populate('ownerId', 'name email phone verificationStatus')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Store.countDocuments(filter),
  ]);

  return {
    stores,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

export const getStoreDetailsAdminService = async (storeId) => {
  if (!mongoose.Types.ObjectId.isValid(storeId)) {
    throw new ApiError(400, 'Invalid store ID format.', 'INVALID_STORE_ID');
  }

  const store = await Store.findById(storeId)
    .populate('ownerId', 'name email phone verificationStatus')
    .lean();
  if (!store) {
    throw new ApiError(404, 'Store not found.', 'STORE_NOT_FOUND');
  }

  const [productCount, batchStats, orderStats] = await Promise.all([
    Product.countDocuments({ storeId: store._id }),
    Batch.aggregate([
      { $match: { storeId: store._id } },
      { $group: { _id: '$status', totalUnits: { $sum: '$quantity' }, totalLots: { $sum: 1 } } },
    ]),
    Order.aggregate([
      { $match: { storeId: store._id, status: { $ne: ORDER_STATUS.CANCELLED } } },
      { $group: { _id: null, totalRevenue: { $sum: '$pricingSummary.finalTotal' }, totalOrders: { $sum: 1 } } },
    ]),
  ]);

  return {
    store,
    productCount,
    batchStats,
    revenue: orderStats[0]?.totalRevenue || 0,
    totalOrders: orderStats[0]?.totalOrders || 0,
  };
};

export const updateStoreStatusAdminService = async (storeId, payload) => {
  if (!mongoose.Types.ObjectId.isValid(storeId)) {
    throw new ApiError(400, 'Invalid store ID format.', 'INVALID_STORE_ID');
  }

  const store = await Store.findById(storeId);
  if (!store) {
    throw new ApiError(404, 'Store not found.', 'STORE_NOT_FOUND');
  }

  if (payload.isActive !== undefined) {
    store.isActive = payload.isActive;
  }
  if (payload.verificationStatus) {
    store.verificationStatus = payload.verificationStatus;
  }

  await store.save();
  return store;
};

/**
 * 5. Product Moderation.
 */
export const listProductsAdminService = async (queryParams = {}) => {
  const page = Math.max(1, parseInt(queryParams.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(queryParams.limit || '20', 10)));
  const skip = (page - 1) * limit;

  const filter = {};
  if (queryParams.status) {
    filter.status = queryParams.status;
  }
  if (queryParams.category && mongoose.Types.ObjectId.isValid(queryParams.category)) {
    filter.category = queryParams.category;
  }
  if (queryParams.storeId && mongoose.Types.ObjectId.isValid(queryParams.storeId)) {
    filter.storeId = queryParams.storeId;
  }
  if (queryParams.search) {
    filter.$or = [
      { name: { $regex: queryParams.search, $options: 'i' } },
      { brand: { $regex: queryParams.search, $options: 'i' } },
    ];
  }

  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate('category', 'name')
      .populate('storeId', 'storeName slug verificationStatus')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Product.countDocuments(filter),
  ]);

  return {
    products,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

export const moderateProductAdminService = async (productId, payload) => {
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw new ApiError(400, 'Invalid product ID format.', 'INVALID_PRODUCT_ID');
  }

  const product = await Product.findById(productId);
  if (!product) {
    throw new ApiError(404, 'Product not found.', 'PRODUCT_NOT_FOUND');
  }

  product.status = payload.status;
  await product.save();

  // Invalidate affected product, marketplace deals, and category listings
  await invalidateProductCache(product._id, product.category);

  return product;
};

/**
 * 6. Category Management.
 */
export const listCategoriesAdminService = async () => {
  const categories = await Category.find().sort({ name: 1 }).lean();

  const categoryStats = await Product.aggregate([
    {
      $group: {
        _id: '$category',
        productCount: { $sum: 1 },
      },
    },
  ]);
  const statsMap = new Map(categoryStats.map((c) => [c._id?.toString(), c.productCount]));

  return categories.map((cat) => ({
    ...cat,
    productCount: statsMap.get(cat._id.toString()) || 0,
  }));
};

/**
 * 7. Pricing Rules.
 */
export const listPricingRulesAdminService = async () => {
  const rules = await PriceRule.find().sort({ priority: 1, remainingDaysMin: 1 }).lean();
  return { rules };
};

export const resetPricingRulesAdminService = async (adminUser) => {
  const result = await resetDefaultPriceRulesService(adminUser._id);
  return { ...result, resetAt: new Date() };
};

export const triggerManualSweepAdminService = async (adminUser) => {
  const result = await runExpiryProcessingJob({
    triggerType: 'ADMIN_MANUAL',
    triggeredBy: adminUser._id,
  });
  return result;
};

/**
 * 8. Inventory Monitoring.
 */
export const getInventoryMonitoringService = async (queryParams = {}) => {
  const page = Math.max(1, parseInt(queryParams.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(queryParams.limit || '20', 10)));
  const skip = (page - 1) * limit;

  const filter = {};
  if (queryParams.status) {
    filter.status = queryParams.status;
  }
  if (queryParams.storeId && mongoose.Types.ObjectId.isValid(queryParams.storeId)) {
    filter.storeId = queryParams.storeId;
  }

  const [batches, total, summaryAgg] = await Promise.all([
    Batch.find(filter)
      .populate('productId', 'name brand unit')
      .populate('storeId', 'storeName slug')
      .sort({ remainingDays: 1, quantity: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Batch.countDocuments(filter),
    Batch.aggregate([
      {
        $group: {
          _id: null,
          totalUnits: { $sum: '$quantity' },
          totalOriginalValuation: { $sum: { $multiply: ['$quantity', '$originalPrice'] } },
          totalCurrentValuation: { $sum: { $multiply: ['$quantity', '$currentPrice'] } },
          totalLots: { $sum: 1 },
          lowStockLots: {
            $sum: {
              $cond: [{ $and: [{ $lte: ['$quantity', 5] }, { $gt: ['$quantity', 0] }] }, 1, 0],
            },
          },
          outOfStockLots: {
            $sum: { $cond: [{ $eq: ['$quantity', 0] }, 1, 0] },
          },
        },
      },
    ]),
  ]);

  const summary = summaryAgg[0] || {
    totalUnits: 0,
    totalOriginalValuation: 0,
    totalCurrentValuation: 0,
    totalLots: 0,
    lowStockLots: 0,
    outOfStockLots: 0,
  };

  return {
    summary: {
      ...summary,
      totalOriginalValuation: round2(summary.totalOriginalValuation),
      totalCurrentValuation: round2(summary.totalCurrentValuation),
    },
    batches,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * 9. Expiry Monitoring.
 */
export const getExpiryMonitoringService = async () => {
  const [expiryStats, activeAlerts, upcomingLots] = await Promise.all([
    Batch.aggregate([
      {
        $group: {
          _id: '$status',
          lotCount: { $sum: 1 },
          unitCount: { $sum: '$quantity' },
        },
      },
    ]),
    ExpiryAlert.countDocuments({ isAcknowledged: false }),
    Batch.find({
      status: { $in: [BATCH_STATUS.CRITICAL, BATCH_STATUS.APPROACHING_EXPIRY] },
      quantity: { $gt: 0 },
    })
      .populate('productId', 'name brand')
      .populate('storeId', 'storeName')
      .sort({ remainingDays: 1 })
      .limit(20)
      .lean(),
  ]);

  const statusMap = {};
  for (const s of expiryStats) {
    statusMap[s._id] = s;
  }

  return {
    criticalLots: statusMap[BATCH_STATUS.CRITICAL] || { lotCount: 0, unitCount: 0 },
    approachingLots: statusMap[BATCH_STATUS.APPROACHING_EXPIRY] || { lotCount: 0, unitCount: 0 },
    expiredLots: statusMap[BATCH_STATUS.EXPIRED] || { lotCount: 0, unitCount: 0 },
    activeUnacknowledgedAlerts: activeAlerts,
    urgentClearanceLots: upcomingLots,
  };
};

/**
 * 10. Order Monitoring.
 */
export const listOrdersAdminService = async (queryParams = {}) => {
  const page = Math.max(1, parseInt(queryParams.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(queryParams.limit || '20', 10)));
  const skip = (page - 1) * limit;

  const filter = {};
  if (queryParams.status) {
    filter.status = queryParams.status;
  }
  if (queryParams.paymentStatus) {
    filter.paymentStatus = queryParams.paymentStatus;
  }
  if (queryParams.fulfillmentType) {
    filter.fulfillmentType = queryParams.fulfillmentType;
  }
  if (queryParams.storeId && mongoose.Types.ObjectId.isValid(queryParams.storeId)) {
    filter.storeId = queryParams.storeId;
  }

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate('customerId', 'name email phone')
      .populate('storeId', 'storeName slug address')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Order.countDocuments(filter),
  ]);

  return {
    orders,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

export const getOrderDetailsAdminService = async (orderId) => {
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    throw new ApiError(400, 'Invalid order ID format.', 'INVALID_ORDER_ID');
  }

  const order = await Order.findById(orderId)
    .populate('customerId', 'name email phone')
    .populate('storeId', 'storeName slug address contactPhone ownerId')
    .lean();

  if (!order) {
    throw new ApiError(404, 'Order not found.', 'ORDER_NOT_FOUND');
  }

  return order;
};

/**
 * 11. Reports.
 */
export const getAdminReportsService = async (queryParams = {}) => {
  const type = queryParams.type || 'overview';

  if (type === 'store-leaderboard') {
    const leaderboard = await Order.aggregate([
      { $match: { status: { $ne: ORDER_STATUS.CANCELLED } } },
      {
        $group: {
          _id: '$storeId',
          totalRevenue: { $sum: '$pricingSummary.finalTotal' },
          orderCount: { $sum: 1 },
          totalSavingsGiven: { $sum: '$pricingSummary.totalSavings' },
        },
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'stores',
          localField: '_id',
          foreignField: '_id',
          as: 'store',
        },
      },
      { $unwind: '$store' },
      {
        $project: {
          _id: 1,
          storeName: '$store.storeName',
          slug: '$store.slug',
          totalRevenue: 1,
          orderCount: 1,
          totalSavingsGiven: 1,
        },
      },
    ]);

    return { type, leaderboard };
  }

  if (type === 'waste-prevention') {
    const aggregate = await Order.aggregate([
      { $match: { status: { $ne: ORDER_STATUS.CANCELLED } } },
      {
        $unwind: '$items',
      },
      {
        $group: {
          _id: null,
          totalItemsRescued: { $sum: '$items.requestedQuantity' },
          totalSavings: { $sum: '$items.lineSavingsAmount' },
        },
      },
    ]);

    const res = aggregate[0] || { totalItemsRescued: 0, totalSavings: 0 };
    return {
      type,
      totalItemsRescued: res.totalItemsRescued,
      estimatedKgSaved: round2(res.totalItemsRescued * 0.45),
      totalSavingsAmount: round2(res.totalSavings),
      carbonOffsetEquivalentKg: round2(res.totalItemsRescued * 0.45 * 1.9), // ~1.9kg CO2e per kg food saved
    };
  }

  // Default: Overview Report
  const dashboard = await getAdminDashboardMetricsService();
  return {
    type: 'overview',
    metrics: dashboard,
  };
};

/**
 * 12. Audit Logs.
 */
export const getAdminAuditLogsService = async (queryParams = {}) => {
  const page = Math.max(1, parseInt(queryParams.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(queryParams.limit || '20', 10)));
  const skip = (page - 1) * limit;

  const logType = queryParams.logType || 'inventory'; // 'inventory' | 'price'

  if (logType === 'price') {
    const filter = {};
    if (queryParams.batchId && mongoose.Types.ObjectId.isValid(queryParams.batchId)) {
      filter.batchId = queryParams.batchId;
    }

    const [logs, total] = await Promise.all([
      PriceAuditLog.find(filter)
        .populate('batchId', 'batchNumber remainingDays')
        .populate('productId', 'name')
        .populate('storeId', 'storeName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PriceAuditLog.countDocuments(filter),
    ]);

    return {
      logType: 'price',
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  // Default: Inventory Audit Logs
  const filter = {};
  if (queryParams.actionType) {
    filter.actionType = queryParams.actionType;
  }
  if (queryParams.batchId && mongoose.Types.ObjectId.isValid(queryParams.batchId)) {
    filter.batchId = queryParams.batchId;
  }
  if (queryParams.storeId && mongoose.Types.ObjectId.isValid(queryParams.storeId)) {
    filter.storeId = queryParams.storeId;
  }

  const [logs, total] = await Promise.all([
    InventoryAudit.find(filter)
      .populate('batchId', 'batchNumber expiryDate remainingDays')
      .populate('productId', 'name unit')
      .populate('storeId', 'storeName')
      .populate('performedBy', 'name email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    InventoryAudit.countDocuments(filter),
  ]);

  return {
    logType: 'inventory',
    logs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};
