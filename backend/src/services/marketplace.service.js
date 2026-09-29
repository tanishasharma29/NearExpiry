import mongoose from 'mongoose';
import { Batch, BATCH_STATUS } from '../models/batch.model.js';
import { Product, PRODUCT_STATUS } from '../models/product.model.js';
import { Store } from '../models/store.model.js';
import { VERIFICATION_STATUS } from '../models/user.model.js';
import { EXPIRY_WINDOW_PRESETS } from '../validators/marketplace.validator.js';
import { ApiError } from '../utils/ApiError.js';
import { toCalendarDayEpochUTC } from '../utils/shelfLife.js';

/**
 * Computes exact spherical Haversine distance (in km) between two [lng, lat] points.
 */
const computeHaversineDistanceKm = (lat1, lon1, lat2, lon2) => {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
};

/**
 * Customer Marketplace Discovery Service.
 *
 * Supports:
 * - Browse & Full-text/Regex Search (product name, brand, description, store name)
 * - Filter by Category, Price range, Discount %, Expiry Window, Store, and Nearby Radius (lat/lng/radiusKm)
 * - Sort by Price, Discount, Expiry (FEFO urgency), Distance, or Name
 * - Strictly guarantees: Expired or zero-stock batches/products NEVER appear as purchasable.
 */
export const browseMarketplaceProductsService = async (query = {}) => {
  const page = Math.max(parseInt(query.page || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(query.limit || '12', 10), 1), 100);
  const skip = (page - 1) * limit;

  const todayUtcDate = new Date(toCalendarDayEpochUTC(new Date()));

  // -------------------------------------------------------------------------
  // STAGE 1: Strict Non-Expired, Positive-Stock Batch Match Predicate
  // -------------------------------------------------------------------------
  const batchMatch = {
    isPurchasable: true,
    quantity: { $gt: 0 },
    remainingDays: { $gte: 0 },
    expiryDate: { $gte: todayUtcDate },
    status: {
      $in: [BATCH_STATUS.NORMAL, BATCH_STATUS.APPROACHING_EXPIRY, BATCH_STATUS.CRITICAL],
    },
  };

  // Store filter
  if (query.storeId && mongoose.Types.ObjectId.isValid(query.storeId)) {
    batchMatch.storeId = new mongoose.Types.ObjectId(query.storeId);
  }

  // Price filter (matches batch currentPrice)
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    batchMatch.currentPrice = {};
    if (query.minPrice !== undefined) batchMatch.currentPrice.$gte = Number(query.minPrice);
    if (query.maxPrice !== undefined) batchMatch.currentPrice.$lte = Number(query.maxPrice);
  }

  // Discount filter (matches batch discountPercentage)
  if (query.minDiscount !== undefined || query.maxDiscount !== undefined) {
    batchMatch.discountPercentage = {};
    if (query.minDiscount !== undefined) {
      batchMatch.discountPercentage.$gte = Number(query.minDiscount);
    }
    if (query.maxDiscount !== undefined) {
      batchMatch.discountPercentage.$lte = Number(query.maxDiscount);
    }
  }

  // Expiry Window preset or explicit minRemainingDays/maxRemainingDays filter
  let minDays = query.minRemainingDays !== undefined ? Number(query.minRemainingDays) : 0;
  let maxDays = query.maxRemainingDays !== undefined ? Number(query.maxRemainingDays) : null;

  if (query.expiryWindow && EXPIRY_WINDOW_PRESETS[query.expiryWindow]) {
    const preset = EXPIRY_WINDOW_PRESETS[query.expiryWindow];
    minDays = Math.max(minDays, preset.min);
    maxDays = maxDays !== null ? Math.min(maxDays, preset.max) : preset.max;
  }

  batchMatch.remainingDays = {
    $gte: Math.max(0, minDays),
    ...(maxDays !== null && { $lte: maxDays }),
  };

  // -------------------------------------------------------------------------
  // STAGE 2: Geospatial Store Pre-Filter (if latitude & longitude provided)
  // -------------------------------------------------------------------------
  const hasGeoCoordinates =
    query.latitude !== undefined &&
    query.longitude !== undefined &&
    !Number.isNaN(Number(query.latitude)) &&
    !Number.isNaN(Number(query.longitude));

  let nearbyStoreMap = null;
  if (hasGeoCoordinates) {
    const userLat = Number(query.latitude);
    const userLng = Number(query.longitude);
    const radiusKm = Number(query.radiusKm || 25);

    const nearbyStores = await Store.aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [userLng, userLat] },
          distanceField: 'distanceMeters',
          maxDistance: radiusKm * 1000,
          query: {
            verificationStatus: VERIFICATION_STATUS.APPROVED,
            isActive: true,
          },
          spherical: true,
        },
      },
      {
        $project: {
          _id: 1,
          storeName: 1,
          slug: 1,
          address: 1,
          latitude: 1,
          longitude: 1,
          status: 1,
          verificationStatus: 1,
          distanceKm: { $round: [{ $divide: ['$distanceMeters', 1000] }, 2] },
        },
      },
    ]);

    if (nearbyStores.length === 0) {
      return {
        products: [],
        pagination: { total: 0, page, limit, totalPages: 1 },
        appliedFilters: query,
      };
    }

    nearbyStoreMap = new Map(nearbyStores.map((s) => [s._id.toString(), s]));
    const allowedStoreIds = nearbyStores.map((s) => s._id);

    if (batchMatch.storeId) {
      const isWithinRadius = allowedStoreIds.some(
        (id) => id.toString() === batchMatch.storeId.toString()
      );
      if (!isWithinRadius) {
        return {
          products: [],
          pagination: { total: 0, page, limit, totalPages: 1 },
          appliedFilters: query,
        };
      }
    } else {
      batchMatch.storeId = { $in: allowedStoreIds };
    }
  }

  // -------------------------------------------------------------------------
  // STAGE 3: MongoDB Aggregation Pipeline (FEFO Batch Grouping -> Product & Store Join)
  // -------------------------------------------------------------------------
  const categoryFilterId = query.category || query.categoryId;

  const productMatchStage = {
    'product.status': PRODUCT_STATUS.ACTIVE,
    ...(categoryFilterId &&
      mongoose.Types.ObjectId.isValid(categoryFilterId) && {
        'product.category': new mongoose.Types.ObjectId(categoryFilterId),
      }),
    ...(query.brand && {
      'product.brand': { $regex: query.brand.trim(), $options: 'i' },
    }),
  };

  if (query.search) {
    const searchRegex = new RegExp(query.search.trim(), 'i');
    productMatchStage.$or = [
      { 'product.name': searchRegex },
      { 'product.brand': searchRegex },
      { 'product.description': searchRegex },
      { 'store.storeName': searchRegex },
    ];
  }

  const pipeline = [
    // 1. Filter only valid, non-expired, positive-quantity batches
    { $match: batchMatch },
    // 2. Sort batches in strict FEFO order (earliest expiryDate first)
    { $sort: { expiryDate: 1, createdAt: 1 } },
    // 3. Group by Product to build live FEFO marketplace summary & available batches list
    {
      $group: {
        _id: '$productId',
        storeId: { $first: '$storeId' },
        leadBatch: {
          $first: {
            batchId: '$_id',
            batchNumber: '$batchNumber',
            manufacturingDate: '$manufacturingDate',
            expiryDate: '$expiryDate',
            remainingDays: '$remainingDays',
            quantity: '$quantity',
            originalPrice: '$originalPrice',
            currentPrice: '$currentPrice',
            discountPercentage: '$discountPercentage',
            status: '$status',
            isPurchasable: '$isPurchasable',
          },
        },
        lowestPrice: { $min: '$currentPrice' },
        highestOriginalPrice: { $max: '$originalPrice' },
        highestDiscountPercentage: { $max: '$discountPercentage' },
        earliestExpiryDate: { $min: '$expiryDate' },
        minRemainingDays: { $min: '$remainingDays' },
        totalAvailableQuantity: { $sum: '$quantity' },
        activeBatchCount: { $sum: 1 },
        availableBatches: {
          $push: {
            _id: '$_id',
            batchNumber: '$batchNumber',
            manufacturingDate: '$manufacturingDate',
            expiryDate: '$expiryDate',
            remainingDays: '$remainingDays',
            quantity: '$quantity',
            originalPrice: '$originalPrice',
            currentPrice: '$currentPrice',
            discountPercentage: '$discountPercentage',
            status: '$status',
            isPurchasable: '$isPurchasable',
          },
        },
      },
    },
    // 4. Join Product
    {
      $lookup: {
        from: 'products',
        localField: '_id',
        foreignField: '_id',
        as: 'product',
      },
    },
    { $unwind: '$product' },
    // 5. Join Store (and enforce Store is APPROVED & active)
    {
      $lookup: {
        from: 'stores',
        localField: 'storeId',
        foreignField: '_id',
        as: 'store',
      },
    },
    { $unwind: '$store' },
    {
      $match: {
        'store.verificationStatus': VERIFICATION_STATUS.APPROVED,
        'store.isActive': true,
        ...productMatchStage,
      },
    },
    // 6. Join Category
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
      $match: {
        'category.status': 'ACTIVE',
      },
    },
  ];

  const aggregatedItems = await Batch.aggregate(pipeline);

  // Enrich with exact distanceKm (from nearbyStoreMap or Haversine if lat/lng provided)
  const enrichedItems = aggregatedItems.map((item) => {
    let distanceKm = null;
    if (hasGeoCoordinates) {
      const precomputed = nearbyStoreMap?.get(item.store._id.toString());
      distanceKm =
        precomputed?.distanceKm ??
        computeHaversineDistanceKm(
          Number(query.latitude),
          Number(query.longitude),
          item.store.latitude,
          item.store.longitude
        );
    }

    return {
      productId: item.product._id,
      name: item.product.name,
      slug: item.product.slug,
      description: item.product.description,
      brand: item.product.brand,
      image: item.product.image,
      unit: item.product.unit,
      status: item.product.status,
      isPurchasable: true,
      category: item.category
        ? {
            _id: item.category._id,
            name: item.category.name,
            slug: item.category.slug,
          }
        : null,
      store: {
        _id: item.store._id,
        storeName: item.store.storeName,
        slug: item.store.slug,
        address: item.store.address,
        latitude: item.store.latitude,
        longitude: item.store.longitude,
        status: item.store.status,
        distanceKm,
      },
      pricingAndInventory: {
        fefoPrice: item.leadBatch.currentPrice,
        lowestPrice: item.lowestPrice,
        originalPrice: item.leadBatch.originalPrice,
        fefoDiscountPercentage: item.leadBatch.discountPercentage,
        highestDiscountPercentage: item.highestDiscountPercentage,
        earliestExpiryDate: item.earliestExpiryDate,
        minRemainingDays: item.minRemainingDays,
        expiryStatus: item.leadBatch.status,
        totalAvailableQuantity: item.totalAvailableQuantity,
        activeBatchCount: item.activeBatchCount,
      },
      leadBatch: item.leadBatch,
      availableBatches: item.availableBatches,
      createdAt: item.product.createdAt,
    };
  });

  // -------------------------------------------------------------------------
  // STAGE 4: Deterministic Sorting (price, discount, expiry, distance, name)
  // -------------------------------------------------------------------------
  const sortBy = query.sortBy || 'expiry';
  const defaultOrder = sortBy === 'discount' ? 'desc' : 'asc';
  const sortOrder = query.sortOrder || defaultOrder;
  const dir = sortOrder === 'desc' ? -1 : 1;

  enrichedItems.sort((a, b) => {
    if (sortBy === 'price') {
      return (a.pricingAndInventory.lowestPrice - b.pricingAndInventory.lowestPrice) * dir;
    }
    if (sortBy === 'discount') {
      return (
        (a.pricingAndInventory.highestDiscountPercentage -
          b.pricingAndInventory.highestDiscountPercentage) *
        dir
      );
    }
    if (sortBy === 'distance') {
      const dA = a.store.distanceKm ?? Number.MAX_SAFE_INTEGER;
      const dB = b.store.distanceKm ?? Number.MAX_SAFE_INTEGER;
      return (dA - dB) * dir;
    }
    if (sortBy === 'name') {
      return a.name.localeCompare(b.name) * dir;
    }
    // Default: 'expiry' (FEFO urgency — earliest expiring first)
    return (
      (new Date(a.pricingAndInventory.earliestExpiryDate) -
        new Date(b.pricingAndInventory.earliestExpiryDate)) *
      dir
    );
  });

  const total = enrichedItems.length;
  const paginatedProducts = enrichedItems.slice(skip, skip + limit);

  return {
    products: paginatedProducts,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * Customer View Product Details + All Available Non-Expired Batches in FEFO Order.
 * Explicitly excludes EXPIRED and OUT_OF_STOCK batches from purchasable batches list.
 */
export const getMarketplaceProductDetailsService = async (productId, query = {}) => {
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw new ApiError(400, 'Invalid product ID format.', 'INVALID_PRODUCT_ID');
  }

  const product = await Product.findById(productId)
    .populate('category', 'name slug description status')
    .populate('storeId', 'storeName slug description address latitude longitude status verificationStatus isActive');

  if (!product || product.status !== PRODUCT_STATUS.ACTIVE) {
    throw new ApiError(404, 'Product not found or currently unavailable.', 'PRODUCT_NOT_FOUND');
  }

  const store = product.storeId;
  if (!store || store.verificationStatus !== VERIFICATION_STATUS.APPROVED || !store.isActive) {
    throw new ApiError(404, 'Store for this product is not currently active.', 'STORE_UNAVAILABLE');
  }

  const todayUtcDate = new Date(toCalendarDayEpochUTC(new Date()));

  // Fetch ONLY active, non-expired, positive-quantity batches sorted in FEFO order
  const availableBatches = await Batch.find({
    productId: product._id,
    isPurchasable: true,
    quantity: { $gt: 0 },
    remainingDays: { $gte: 0 },
    expiryDate: { $gte: todayUtcDate },
    status: {
      $in: [BATCH_STATUS.NORMAL, BATCH_STATUS.APPROACHING_EXPIRY, BATCH_STATUS.CRITICAL],
    },
  }).sort({ expiryDate: 1, createdAt: 1 });

  let distanceKm = null;
  if (
    query.latitude !== undefined &&
    query.longitude !== undefined &&
    !Number.isNaN(Number(query.latitude)) &&
    !Number.isNaN(Number(query.longitude))
  ) {
    distanceKm = computeHaversineDistanceKm(
      Number(query.latitude),
      Number(query.longitude),
      store.latitude,
      store.longitude
    );
  }

  const totalAvailableQuantity = availableBatches.reduce((sum, b) => sum + b.quantity, 0);
  const leadBatch = availableBatches[0] || null;

  return {
    product: {
      _id: product._id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      brand: product.brand,
      image: product.image,
      unit: product.unit,
      status: product.status,
      category: product.category,
    },
    store: {
      _id: store._id,
      storeName: store.storeName,
      slug: store.slug,
      address: store.address,
      latitude: store.latitude,
      longitude: store.longitude,
      distanceKm,
    },
    isPurchasable: availableBatches.length > 0 && totalAvailableQuantity > 0,
    fefoSummary: leadBatch
      ? {
          leadBatchId: leadBatch._id,
          leadBatchNumber: leadBatch.batchNumber,
          currentPrice: leadBatch.currentPrice,
          originalPrice: leadBatch.originalPrice,
          discountPercentage: leadBatch.discountPercentage,
          earliestExpiryDate: leadBatch.expiryDate,
          remainingDays: leadBatch.remainingDays,
          status: leadBatch.status,
          totalAvailableQuantity,
          activeBatchCount: availableBatches.length,
        }
      : null,
    availableBatches,
  };
};
