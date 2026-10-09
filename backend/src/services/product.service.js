import { ensureSellerStore } from './store.service.js';
import mongoose from 'mongoose';
import { Product, PRODUCT_STATUS } from '../models/product.model.js';
import { Category, CATEGORY_STATUS } from '../models/category.model.js';
import { Store } from '../models/store.model.js';
import { Order, ORDER_STATUS } from '../models/order.model.js';
import { USER_ROLES } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import {
  remember,
  buildCacheKey,
  invalidateProductCache,
  CACHE_TTL,
} from '../utils/cache.util.js';

/**
 * Enforces that a SELLER can only manage products belonging to their own store/account.
 */
const assertProductOwnershipOrAdmin = (product, requesterUser) => {
  if (!requesterUser) {
    throw new ApiError(401, 'Authentication required.', 'UNAUTHORIZED');
  }

  if (requesterUser.role === USER_ROLES.ADMIN) {
    return true;
  }

  const productSellerId = product.sellerId._id
    ? product.sellerId._id.toString()
    : product.sellerId.toString();

  if (
    requesterUser.role === USER_ROLES.SELLER &&
    productSellerId === requesterUser._id.toString()
  ) {
    return true;
  }

  throw new ApiError(
    403,
    'Forbidden: Sellers can only access and manage their own products.',
    'FORBIDDEN_PRODUCT_ACCESS'
  );
};

/**
 * Seller creates a new Product under an ACTIVE Category.
 */
export const createProductService = async (sellerUser, payload) => {
  // 1. Ensure Seller has created a Store (auto-provision if needed)
  let store = await Store.findOne({ ownerId: sellerUser._id });
  if (!store) {
    store = await ensureSellerStore(sellerUser);
  }
  if (!store) {
    throw new ApiError(
      400,
      'You must create your Store before creating products.',
      'STORE_REQUIRED_FOR_PRODUCT'
    );
  }

  // Enforce store approval status
  if (sellerUser.role === USER_ROLES.SELLER) {
    if (store.verificationStatus === 'REJECTED' || sellerUser.verificationStatus === 'REJECTED') {
      throw new ApiError(
        403,
        'Your store application was rejected. Cannot create products.',
        'STORE_REJECTED'
      );
    }
    const isApproved =
      store.verificationStatus === 'APPROVED' || sellerUser.verificationStatus === 'APPROVED';
    if (!isApproved) {
      throw new ApiError(
        403,
        'Your store application is pending admin approval. Cannot create products.',
        'SELLER_NOT_APPROVED'
      );
    }
  }

  // 2. Verify target Category exists and is ACTIVE
  const categoryDoc = await Category.findById(payload.category);
  if (!categoryDoc) {
    throw new ApiError(404, 'Selected category does not exist.', 'CATEGORY_NOT_FOUND');
  }
  if (categoryDoc.status !== CATEGORY_STATUS.ACTIVE) {
    throw new ApiError(
      400,
      `Category [${categoryDoc.name}] is currently INACTIVE and cannot accept new products.`,
      'CATEGORY_INACTIVE'
    );
  }

  const product = await Product.create({
    sellerId: sellerUser._id,
    storeId: store._id,
    category: categoryDoc._id,
    name: payload.name,
    description: payload.description,
    brand: payload.brand,
    image: payload.image,
    unit: payload.unit,
    status: payload.status || PRODUCT_STATUS.ACTIVE,
  });

  await product.populate([
    { path: 'category', select: 'name slug status' },
    { path: 'storeId', select: 'storeName slug address verificationStatus' },
  ]);

  // Invalidate public product listings & marketplace deals
  await invalidateProductCache(product._id, product.category);

  return product;
};

/**
 * List Products with Pagination, Sorting, and Multi-Field Filtering.
 * - Customers / Public see ONLY products with status === 'ACTIVE' (and active Category).
 * - Admin can filter by any status.
 */
export const listProductsService = async (query = {}, requesterUser = null) => {
  const page = Math.max(parseInt(query.page || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(query.limit || '12', 10), 1), 100);
  const skip = (page - 1) * limit;

  const isAdmin = requesterUser && requesterUser.role === USER_ROLES.ADMIN;

  const filter = {};

  // Status Rule: Customers always see ACTIVE products only
  if (isAdmin && query.status) {
    filter.status = query.status;
  } else if (!isAdmin) {
    filter.status = PRODUCT_STATUS.ACTIVE;
  }

  if (query.category && mongoose.Types.ObjectId.isValid(query.category)) {
    filter.category = query.category;
  }

  if (query.storeId && mongoose.Types.ObjectId.isValid(query.storeId)) {
    filter.storeId = query.storeId;
  }

  if (query.brand) {
    filter.brand = { $regex: query.brand.trim(), $options: 'i' };
  }

  if (query.unit) {
    filter.unit = query.unit;
  }

  if (query.search) {
    const regex = new RegExp(query.search.trim(), 'i');
    filter.$or = [{ name: regex }, { brand: regex }, { description: regex }];
  }

  const allowedSortFields = ['createdAt', 'name', 'brand', 'updatedAt'];
  const sortBy = allowedSortFields.includes(query.sortBy) ? query.sortBy : 'createdAt';
  const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

  // Privileged admin requests bypass shared public cache
  if (isAdmin) {
    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate('category', 'name slug status')
        .populate('storeId', 'storeName slug address latitude longitude status verificationStatus')
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit),
      Product.countDocuments(filter),
    ]);

    return {
      products,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  // Public/Customer requests: Cache-Aside with 5-minute TTL
  const cacheKey = buildCacheKey('products', 'list', {
    page,
    limit,
    sortBy,
    sortOrder,
    category: query.category || '',
    storeId: query.storeId || '',
    brand: query.brand ? query.brand.trim() : '',
    unit: query.unit || '',
    search: query.search ? query.search.trim() : '',
  });

  const { data } = await remember(cacheKey, CACHE_TTL.PRODUCTS_LIST, async () => {
    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate('category', 'name slug status')
        .populate('storeId', 'storeName slug address latitude longitude status verificationStatus')
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(filter),
    ]);

    return {
      products,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  });

  return data;
};

/**
 * Seller: List only their own products with Pagination, Sorting, and Filtering.
 */
export const listSellerOwnProductsService = async (sellerUserId, query = {}) => {
  const page = Math.max(parseInt(query.page || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(query.limit || '12', 10), 1), 100);
  const skip = (page - 1) * limit;

  const filter = {
    sellerId: sellerUserId,
  };

  if (query.status) {
    filter.status = query.status;
  }

  if (query.category && mongoose.Types.ObjectId.isValid(query.category)) {
    filter.category = query.category;
  }

  if (query.brand) {
    filter.brand = { $regex: query.brand.trim(), $options: 'i' };
  }

  if (query.search) {
    const regex = new RegExp(query.search.trim(), 'i');
    filter.$or = [{ name: regex }, { brand: regex }, { description: regex }];
  }

  const allowedSortFields = ['createdAt', 'name', 'brand', 'status', 'updatedAt'];
  const sortBy = allowedSortFields.includes(query.sortBy) ? query.sortBy : 'createdAt';
  const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate('category', 'name slug status')
      .populate('storeId', 'storeName slug verificationStatus')
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit),
    Product.countDocuments(filter),
  ]);

  return {
    products,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * Get single Product by ID.
 * - Customers / Public see the product ONLY if status === 'ACTIVE'.
 * - Seller can view their own product regardless of status (403 if viewing another seller's INACTIVE product).
 * - Admin can view any product.
 */
export const getProductByIdService = async (productId, requesterUser = null) => {
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw new ApiError(400, 'Invalid product ID format.', 'INVALID_PRODUCT_ID');
  }

  // Privileged admin requests bypass cache
  if (requesterUser && requesterUser.role === USER_ROLES.ADMIN) {
    const product = await Product.findById(productId)
      .populate('category', 'name slug description status')
      .populate('storeId', 'storeName slug address latitude longitude verificationStatus');
    if (!product) {
      throw new ApiError(404, 'Product not found.', 'PRODUCT_NOT_FOUND');
    }
    return product;
  }

  // Seller requests bypass cache to guarantee fresh own-product management state
  if (requesterUser && requesterUser.role === USER_ROLES.SELLER) {
    const product = await Product.findById(productId)
      .populate('category', 'name slug description status')
      .populate('storeId', 'storeName slug address latitude longitude verificationStatus');
    if (!product) {
      throw new ApiError(404, 'Product not found.', 'PRODUCT_NOT_FOUND');
    }
    if (product.sellerId.toString() === requesterUser._id.toString()) {
      return product;
    }
    if (product.status !== PRODUCT_STATUS.ACTIVE) {
      throw new ApiError(
        403,
        'Forbidden: Sellers can only access their own non-active products.',
        'FORBIDDEN_PRODUCT_ACCESS'
      );
    }
    return product;
  }

  // Customer / Guest check: Cache-Aside with 15-minute TTL
  const cacheKey = buildCacheKey('products', `detail:${productId}`);
  const { data } = await remember(cacheKey, CACHE_TTL.PRODUCT_DETAIL, async () => {
    const product = await Product.findById(productId)
      .populate('category', 'name slug description status')
      .populate('storeId', 'storeName slug address latitude longitude verificationStatus')
      .lean();

    if (!product) {
      throw new ApiError(404, 'Product not found.', 'PRODUCT_NOT_FOUND');
    }

    if (product.status !== PRODUCT_STATUS.ACTIVE) {
      throw new ApiError(404, 'Product is currently inactive or unavailable.', 'PRODUCT_INACTIVE');
    }

    return product;
  });

  return data;
};

/**
 * Public: Get Top-Selling / Popular Products with Cache-Aside.
 */
export const getPopularProductsService = async (limit = 10) => {
  const boundedLimit = Math.min(Math.max(parseInt(limit || '10', 10), 1), 50);
  const cacheKey = buildCacheKey('products', `popular:${boundedLimit}`);

  const { data } = await remember(cacheKey, CACHE_TTL.POPULAR_PRODUCTS, async () => {
    // 1. Aggregate non-cancelled orders to identify most-purchased product IDs
    const topSales = await Order.aggregate([
      {
        $match: {
          status: { $ne: ORDER_STATUS.CANCELLED },
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // Last 30 days
        },
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productId',
          unitsSold: { $sum: '$items.requestedQuantity' },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { unitsSold: -1 } },
      { $limit: boundedLimit },
    ]);

    const topProductIds = topSales.map((item) => item._id);
    const unitsSoldMap = new Map(topSales.map((item) => [item._id.toString(), item.unitsSold]));

    let products = [];
    if (topProductIds.length > 0) {
      products = await Product.find({
        _id: { $in: topProductIds },
        status: PRODUCT_STATUS.ACTIVE,
      })
        .populate('category', 'name slug status')
        .populate('storeId', 'storeName slug address latitude longitude status verificationStatus')
        .lean();
    }

    // Attach unitsSold and sort by popularity
    products = products
      .map((p) => ({
        ...p,
        unitsSold: unitsSoldMap.get(p._id.toString()) || 0,
      }))
      .sort((a, b) => b.unitsSold - a.unitsSold);

    // If fewer than limit, supplement with newest active products
    if (products.length < boundedLimit) {
      const existingIds = products.map((p) => p._id);
      const remainingLimit = boundedLimit - products.length;
      const supplemental = await Product.find({
        _id: { $nin: existingIds },
        status: PRODUCT_STATUS.ACTIVE,
      })
        .populate('category', 'name slug status')
        .populate('storeId', 'storeName slug address latitude longitude status verificationStatus')
        .sort({ createdAt: -1 })
        .limit(remainingLimit)
        .lean();

      products = products.concat(
        supplemental.map((p) => ({ ...p, unitsSold: 0 }))
      );
    }

    return products;
  });

  return data;
};

/**
 * Seller updates their own Product (or Admin updates any Product).
 */
export const updateProductService = async (productId, requesterUser, payload) => {
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw new ApiError(400, 'Invalid product ID format.', 'INVALID_PRODUCT_ID');
  }

  const product = await Product.findById(productId);
  if (!product) {
    throw new ApiError(404, 'Product not found.', 'PRODUCT_NOT_FOUND');
  }

  assertProductOwnershipOrAdmin(product, requesterUser);

  if (payload.category) {
    const categoryDoc = await Category.findById(payload.category);
    if (!categoryDoc || categoryDoc.status !== CATEGORY_STATUS.ACTIVE) {
      throw new ApiError(400, 'Target category must exist and be ACTIVE.', 'INVALID_CATEGORY');
    }
    product.category = categoryDoc._id;
  }

  if (payload.name !== undefined) product.name = payload.name;
  if (payload.description !== undefined) product.description = payload.description;
  if (payload.brand !== undefined) product.brand = payload.brand;
  if (payload.image !== undefined) product.image = payload.image;
  if (payload.unit !== undefined) product.unit = payload.unit;
  if (payload.status !== undefined) product.status = payload.status;

  await product.save();

  // Invalidate affected product, category, and popular caches
  await invalidateProductCache(product._id, product.category);

  return product.populate([
    { path: 'category', select: 'name slug status' },
    { path: 'storeId', select: 'storeName slug verificationStatus' },
  ]);
};

/**
 * Seller deletes their own Product (or Admin deletes any Product).
 */
export const deleteProductService = async (productId, requesterUser) => {
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw new ApiError(400, 'Invalid product ID format.', 'INVALID_PRODUCT_ID');
  }

  const product = await Product.findById(productId);
  if (!product) {
    throw new ApiError(404, 'Product not found.', 'PRODUCT_NOT_FOUND');
  }

  assertProductOwnershipOrAdmin(product, requesterUser);

  const categoryId = product.category;
  await product.deleteOne();

  // Invalidate affected product, category, and popular caches
  await invalidateProductCache(productId, categoryId);

  return { deletedProductId: productId };
};
