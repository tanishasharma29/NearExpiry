import mongoose from 'mongoose';
import { User, USER_ROLES } from '../models/user.model.js';
import { Store } from '../models/store.model.js';
import { Product } from '../models/product.model.js';
import { Batch, BATCH_STATUS } from '../models/batch.model.js';
import { Order, ORDER_STATUS } from '../models/order.model.js';
import { ApiError } from '../utils/ApiError.js';

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/**
 * Calculate beginning Date based on period string.
 */
const getStartDateFromPeriod = (period = '30d') => {
  const now = new Date();
  if (period === '7d') {
    now.setDate(now.getDate() - 7);
    return now;
  }
  if (period === '90d') {
    now.setDate(now.getDate() - 90);
    return now;
  }
  if (period === 'all') {
    return new Date(0); // Epoch
  }
  // Default: 30d
  now.setDate(now.getDate() - 30);
  return now;
};

/**
 * Ordered standard buckets for expiry distribution Recharts visualizer
 */
const STANDARD_EXPIRY_BUCKETS = [
  '0-2 Days (Critical)',
  '3-7 Days (Urgent)',
  '8-15 Days (Approaching)',
  '16-30 Days (Moderate)',
  '31+ Days (Safe)',
  'Expired',
];

/**
 * 1. SELLER ANALYTICS PIPELINES
 * Scoped strictly to the authenticated Seller's store lot and orders.
 * Executes fully within MongoDB aggregation engine (zero Node.js memory loading).
 */
export const getSellerAnalyticsService = async (sellerUser, queryParams = {}) => {
  const store = await Store.findOne({ ownerId: sellerUser._id }).lean();
  if (!store) {
    throw new ApiError(404, 'Store not found for this seller.', 'STORE_NOT_FOUND');
  }

  const period = queryParams.period || '30d';
  const startDate = getStartDateFromPeriod(period);
  const storeObjectId = store._id;

  // -------------------------------------------------------------
  // Pipeline 1: Inventory Health & Expiry Distribution (Batch)
  // -------------------------------------------------------------
  const [batchMetrics] = await Batch.aggregate([
    { $match: { storeId: storeObjectId } },
    {
      $facet: {
        kpis: [
          {
            $group: {
              _id: null,
              totalInventoryUnits: { $sum: '$quantity' },
              totalLots: { $sum: 1 },
              expiringUnits: {
                $sum: {
                  $cond: [{ $eq: ['$status', BATCH_STATUS.APPROACHING_EXPIRY] }, '$quantity', 0],
                },
              },
              criticalUnits: {
                $sum: {
                  $cond: [{ $eq: ['$status', BATCH_STATUS.CRITICAL] }, '$quantity', 0],
                },
              },
              expiredUnits: {
                $sum: {
                  $cond: [{ $eq: ['$status', BATCH_STATUS.EXPIRED] }, '$quantity', 0],
                },
              },
              totalInventoryValuation: {
                $sum: { $multiply: ['$quantity', '$currentPrice'] },
              },
            },
          },
        ],
        expiryDistribution: [
          {
            $project: {
              quantity: 1,
              status: 1,
              remainingDays: 1,
              bucket: {
                $switch: {
                  branches: [
                    { case: { $lte: ['$remainingDays', 0] }, then: 'Expired' },
                    { case: { $lte: ['$remainingDays', 2] }, then: '0-2 Days (Critical)' },
                    { case: { $lte: ['$remainingDays', 7] }, then: '3-7 Days (Urgent)' },
                    { case: { $lte: ['$remainingDays', 15] }, then: '8-15 Days (Approaching)' },
                    { case: { $lte: ['$remainingDays', 30] }, then: '16-30 Days (Moderate)' },
                  ],
                  default: '31+ Days (Safe)',
                },
              },
            },
          },
          {
            $group: {
              _id: '$bucket',
              units: { $sum: '$quantity' },
              lotCount: { $sum: 1 },
            },
          },
        ],
      },
    },
  ]);

  const kpis = batchMetrics?.kpis[0] || {
    totalInventoryUnits: 0,
    totalLots: 0,
    expiringUnits: 0,
    criticalUnits: 0,
    expiredUnits: 0,
    totalInventoryValuation: 0,
  };

  // Recharts-friendly Expiry Distribution (ensuring all standard buckets exist)
  const distributionMap = new Map(
    (batchMetrics?.expiryDistribution || []).map((d) => [d._id, d])
  );
  const expiryDistribution = STANDARD_EXPIRY_BUCKETS.map((bucket) => {
    const existing = distributionMap.get(bucket);
    return {
      bucket,
      units: existing?.units || 0,
      lotCount: existing?.lotCount || 0,
    };
  });

  // -------------------------------------------------------------
  // Pipeline 2: Order KPIs & Sales Over Time Series (Order)
  // -------------------------------------------------------------
  const [orderMetrics] = await Order.aggregate([
    {
      $match: {
        storeId: storeObjectId,
        status: { $ne: ORDER_STATUS.CANCELLED },
        createdAt: { $gte: startDate },
      },
    },
    {
      $facet: {
        salesKpis: [
          {
            $group: {
              _id: null,
              revenue: { $sum: '$pricingSummary.finalTotal' },
              gmv: { $sum: '$pricingSummary.subtotal' },
              discountAmount: { $sum: '$pricingSummary.discounts' },
              unitsSold: { $sum: '$pricingSummary.totalUnits' },
              ordersCount: { $sum: 1 },
            },
          },
        ],
        salesOverTime: [
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              revenue: { $sum: '$pricingSummary.finalTotal' },
              discountAmount: { $sum: '$pricingSummary.discounts' },
              unitsSold: { $sum: '$pricingSummary.totalUnits' },
              orderCount: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
          {
            $project: {
              _id: 0,
              date: '$_id',
              revenue: { $round: ['$revenue', 2] },
              discountAmount: { $round: ['$discountAmount', 2] },
              unitsSold: 1,
              orderCount: 1,
            },
          },
        ],
      },
    },
  ]);

  const sales = orderMetrics?.salesKpis[0] || {
    revenue: 0,
    gmv: 0,
    discountAmount: 0,
    unitsSold: 0,
    ordersCount: 0,
  };

  const salesOverTime = orderMetrics?.salesOverTime || [];

  // -------------------------------------------------------------
  // Pipeline 3: Category Performance Breakdown (Order -> Items)
  // -------------------------------------------------------------
  const categoryPerformance = await Order.aggregate([
    {
      $match: {
        storeId: storeObjectId,
        status: { $ne: ORDER_STATUS.CANCELLED },
      },
    },
    { $unwind: '$items' },
    {
      $lookup: {
        from: 'products',
        localField: 'items.productId',
        foreignField: '_id',
        as: 'product',
      },
    },
    { $unwind: '$product' },
    {
      $lookup: {
        from: 'categories',
        localField: 'product.category',
        foreignField: '_id',
        as: 'category',
      },
    },
    { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: { $ifNull: ['$category.name', 'Uncategorized'] },
        revenue: { $sum: '$items.lineDiscountedAmount' },
        unitsSold: { $sum: '$items.requestedQuantity' },
        discountAmount: { $sum: '$items.lineSavingsAmount' },
        itemCount: { $sum: 1 },
      },
    },
    { $sort: { revenue: -1 } },
    {
      $project: {
        _id: 0,
        name: '$_id',
        revenue: { $round: ['$revenue', 2] },
        unitsSold: 1,
        discountAmount: { $round: ['$discountAmount', 2] },
      },
    },
  ]);

  // Waste Prevented Metrics
  const wastePrevented = {
    unitsRescued: sales.unitsSold,
    estimatedKgSaved: round2(sales.unitsSold * 0.45),
    customerSavingsAmount: round2(sales.discountAmount),
    co2EquivalentKg: round2(sales.unitsSold * 0.45 * 1.9),
  };

  return {
    period,
    store: {
      _id: store._id,
      storeName: store.storeName,
    },
    kpis: {
      totalInventory: kpis.totalInventoryUnits,
      expiringInventory: kpis.expiringUnits,
      criticalInventory: kpis.criticalUnits,
      expiredInventory: kpis.expiredUnits,
      unitsSold: sales.unitsSold,
      revenue: round2(sales.revenue),
      gmv: round2(sales.gmv),
      discountAmount: round2(sales.discountAmount),
      ordersCount: sales.ordersCount,
      inventoryValuation: round2(kpis.totalInventoryValuation),
      wastePrevented,
    },
    charts: {
      salesOverTime, // Line / Area chart series
      categoryPerformance, // Bar / Pie chart series
      expiryDistribution, // Histogram / Bar chart series
    },
    generatedAt: new Date(),
  };
};

/**
 * 2. ADMIN ANALYTICS PIPELINES
 * Platform-wide multi-collection aggregation pipelines.
 * Computes GMV, rescued units, waste prevented, user growth, expiry health, and category revenue.
 */
export const getAdminAnalyticsService = async (queryParams = {}) => {
  const period = queryParams.period || '30d';
  const startDate = getStartDateFromPeriod(period);

  const [
    userSummary,
    storeSummary,
    orderAggregates,
    expiryHealthAggregates,
    categoryPerformance,
  ] = await Promise.all([
    // Pipeline 1: User & Seller Population
    User.aggregate([
      {
        $group: {
          _id: '$role',
          total: { $sum: 1 },
          active: { $sum: { $cond: ['$isActive', 1, 0] } },
          pendingSellers: {
            $sum: { $cond: [{ $eq: ['$verificationStatus', 'PENDING'] }, 1, 0] },
          },
        },
      },
    ]),

    // Pipeline 2: Store Verification State
    Store.aggregate([
      {
        $group: {
          _id: '$verificationStatus',
          count: { $sum: 1 },
          activeCount: { $sum: { $cond: ['$isActive', 1, 0] } },
        },
      },
    ]),

    // Pipeline 3: Global Orders, GMV, Revenue & Time Series
    Order.aggregate([
      {
        $match: {
          status: { $ne: ORDER_STATUS.CANCELLED },
          createdAt: { $gte: startDate },
        },
      },
      {
        $facet: {
          kpis: [
            {
              $group: {
                _id: null,
                totalOrders: { $sum: 1 },
                gmv: { $sum: '$pricingSummary.subtotal' },
                revenue: { $sum: '$pricingSummary.finalTotal' },
                discounts: { $sum: '$pricingSummary.discounts' },
                rescuedUnits: { $sum: '$pricingSummary.totalUnits' },
              },
            },
          ],
          salesOverTime: [
            {
              $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                gmv: { $sum: '$pricingSummary.subtotal' },
                revenue: { $sum: '$pricingSummary.finalTotal' },
                discounts: { $sum: '$pricingSummary.discounts' },
                rescuedUnits: { $sum: '$pricingSummary.totalUnits' },
                orderCount: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
            {
              $project: {
                _id: 0,
                date: '$_id',
                gmv: { $round: ['$gmv', 2] },
                revenue: { $round: ['$revenue', 2] },
                discounts: { $round: ['$discounts', 2] },
                rescuedUnits: 1,
                orderCount: 1,
              },
            },
          ],
        },
      },
    ]),

    // Pipeline 4: Expiry Trends & Shelf-Life Distribution
    Batch.aggregate([
      {
        $facet: {
          byStatus: [
            {
              $group: {
                _id: '$status',
                lots: { $sum: 1 },
                units: { $sum: '$quantity' },
                valuation: { $sum: { $multiply: ['$quantity', '$currentPrice'] } },
              },
            },
            {
              $project: {
                _id: 0,
                status: '$_id',
                lots: 1,
                units: 1,
                valuation: { $round: ['$valuation', 2] },
              },
            },
          ],
          byUrgencyBuckets: [
            {
              $project: {
                quantity: 1,
                currentPrice: 1,
                tier: {
                  $switch: {
                    branches: [
                      { case: { $lte: ['$remainingDays', 0] }, then: 'Expired' },
                      { case: { $lte: ['$remainingDays', 2] }, then: '0-2 Days (Critical)' },
                      { case: { $lte: ['$remainingDays', 7] }, then: '3-7 Days (Urgent)' },
                      { case: { $lte: ['$remainingDays', 15] }, then: '8-15 Days (Approaching)' },
                      { case: { $lte: ['$remainingDays', 30] }, then: '16-30 Days (Moderate)' },
                    ],
                    default: '31+ Days (Safe)',
                  },
                },
              },
            },
            {
              $group: {
                _id: '$tier',
                units: { $sum: '$quantity' },
                lotCount: { $sum: 1 },
              },
            },
          ],
        },
      },
    ]),

    // Pipeline 5: Platform Category Performance
    Order.aggregate([
      { $match: { status: { $ne: ORDER_STATUS.CANCELLED } } },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'products',
          localField: 'items.productId',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: '$product' },
      {
        $lookup: {
          from: 'categories',
          localField: 'product.category',
          foreignField: '_id',
          as: 'category',
        },
      },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { $ifNull: ['$category.name', 'Uncategorized'] },
          revenue: { $sum: '$items.lineDiscountedAmount' },
          gmv: { $sum: '$items.lineOriginalAmount' },
          unitsRescued: { $sum: '$items.requestedQuantity' },
          discountSavings: { $sum: '$items.lineSavingsAmount' },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { revenue: -1 } },
      {
        $project: {
          _id: 0,
          category: '$_id',
          name: '$_id',
          revenue: { $round: ['$revenue', 2] },
          gmv: { $round: ['$gmv', 2] },
          unitsRescued: 1,
          discountSavings: { $round: ['$discountSavings', 2] },
          orderCount: 1,
        },
      },
    ]),
  ]);

  // Transform User Stats
  const users = {
    totalCustomers: 0,
    activeCustomers: 0,
    totalSellers: 0,
    activeSellers: 0,
    pendingSellers: 0,
  };
  for (const u of userSummary) {
    if (u._id === USER_ROLES.CUSTOMER) {
      users.totalCustomers = u.total;
      users.activeCustomers = u.active;
    } else if (u._id === USER_ROLES.SELLER) {
      users.totalSellers = u.total;
      users.activeSellers = u.active;
      users.pendingSellers = u.pendingSellers || 0;
    }
  }

  // Transform Store Stats
  const stores = {
    total: 0,
    approved: 0,
    pending: 0,
    rejected: 0,
    active: 0,
  };
  for (const s of storeSummary) {
    stores.total += s.count;
    if (s._id === 'APPROVED') {
      stores.approved = s.count;
      stores.active = s.activeCount;
    } else if (s._id === 'PENDING') {
      stores.pending = s.count;
    } else if (s._id === 'REJECTED') {
      stores.rejected = s.count;
    }
  }

  // Transform Order KPIs
  const orderKpis = orderAggregates[0]?.kpis[0] || {
    totalOrders: 0,
    gmv: 0,
    revenue: 0,
    discounts: 0,
    rescuedUnits: 0,
  };

  const salesOverTime = orderAggregates[0]?.salesOverTime || [];

  // Expiry Trends
  const expiryTrends = expiryHealthAggregates[0]?.byStatus || [];
  const urgencyMap = new Map(
    (expiryHealthAggregates[0]?.byUrgencyBuckets || []).map((u) => [u._id, u])
  );
  const expiryUrgencyDistribution = STANDARD_EXPIRY_BUCKETS.map((tier) => {
    const existing = urgencyMap.get(tier);
    return {
      tier,
      name: tier,
      units: existing?.units || 0,
      lotCount: existing?.lotCount || 0,
    };
  });

  // Waste Prevented
  const wastePrevented = {
    rescuedInventory: orderKpis.rescuedUnits,
    estimatedKgSaved: round2(orderKpis.rescuedUnits * 0.45),
    customerSavingsAmount: round2(orderKpis.discounts),
    carbonOffsetEquivalentKg: round2(orderKpis.rescuedUnits * 0.45 * 1.9),
  };

  return {
    period,
    kpis: {
      users,
      sellers: {
        total: users.totalSellers,
        active: users.activeSellers,
        pending: users.pendingSellers,
      },
      stores,
      orders: {
        total: orderKpis.totalOrders,
      },
      gmv: round2(orderKpis.gmv),
      revenue: round2(orderKpis.revenue),
      rescuedInventory: orderKpis.rescuedUnits,
      wastePrevented,
    },
    charts: {
      salesOverTime, // Area / Line chart series: { date, gmv, revenue, discounts, rescuedUnits }
      categoryPerformance, // Bar / Pie chart series: { name, revenue, gmv, unitsRescued }
      expiryUrgencyDistribution, // Bar / Pie chart series: { tier, units, lotCount }
      expiryTrends, // Status breakdown: { status, lots, units, valuation }
    },
    generatedAt: new Date(),
  };
};
