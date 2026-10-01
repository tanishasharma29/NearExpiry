import { ensureSellerStore } from './store.service.js';
import mongoose from 'mongoose';
import { Product, PRODUCT_STATUS } from '../models/product.model.js';
import { Category, CATEGORY_STATUS } from '../models/category.model.js';
import { Store } from '../models/store.model.js';
import { USER_ROLES } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';

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

  return product.populate([
    { path: 'category', select: 'name slug status' },
    { path: 'storeId', select: 'storeName slug address verificationStatus' },
  ]);
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

  const product = await Product.findById(productId)
    .populate('category', 'name slug description status')
    .populate('storeId', 'storeName slug address latitude longitude verificationStatus');

  if (!product) {
    throw new ApiError(404, 'Product not found.', 'PRODUCT_NOT_FOUND');
  }

  if (requesterUser && requesterUser.role === USER_ROLES.ADMIN) {
    return product;
  }

  if (requesterUser && requesterUser.role === USER_ROLES.SELLER) {
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

  // Customer / Guest check
  if (product.status !== PRODUCT_STATUS.ACTIVE) {
    throw new ApiError(404, 'Product is currently inactive or unavailable.', 'PRODUCT_INACTIVE');
  }

  return product;
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

  await product.deleteOne();
  return { deletedProductId: productId };
};
