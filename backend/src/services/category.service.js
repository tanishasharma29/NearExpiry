import mongoose from 'mongoose';
import { Category, CATEGORY_STATUS } from '../models/category.model.js';
import { Product } from '../models/product.model.js';
import { USER_ROLES } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Admin creates a new product Category.
 */
export const createCategoryService = async (adminUserId, payload) => {
  const existing = await Category.findOne({
    name: { $regex: `^${payload.name.trim()}$`, $options: 'i' },
  });

  if (existing) {
    throw new ApiError(
      409,
      `Category [${payload.name}] already exists.`,
      'DUPLICATE_CATEGORY',
      [{ field: 'name', message: 'Category name must be unique' }]
    );
  }

  const category = await Category.create({
    name: payload.name,
    description: payload.description || '',
    status: payload.status || CATEGORY_STATUS.ACTIVE,
    createdBy: adminUserId,
  });

  return category;
};

/**
 * List Categories with Pagination, Sorting, and Filtering.
 * - Customers / Public see only ACTIVE categories by default.
 * - Admin can view both ACTIVE and INACTIVE categories.
 */
export const listCategoriesService = async (query = {}, requesterUser = null) => {
  const page = Math.max(parseInt(query.page || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(query.limit || '20', 10), 1), 100);
  const skip = (page - 1) * limit;

  const isAdmin = requesterUser && requesterUser.role === USER_ROLES.ADMIN;

  const filter = {};
  if (isAdmin && query.status) {
    filter.status = query.status;
  } else if (!isAdmin) {
    filter.status = CATEGORY_STATUS.ACTIVE;
  }

  if (query.search) {
    filter.name = { $regex: query.search.trim(), $options: 'i' };
  }

  const allowedSortFields = ['name', 'createdAt', 'status'];
  const sortBy = allowedSortFields.includes(query.sortBy) ? query.sortBy : 'name';
  const sortOrder = query.sortOrder === 'desc' ? -1 : 1;

  const [categories, total] = await Promise.all([
    Category.find(filter)
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit),
    Category.countDocuments(filter),
  ]);

  return {
    categories,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * Get a single Category by ID.
 */
export const getCategoryByIdService = async (categoryId, requesterUser = null) => {
  if (!mongoose.Types.ObjectId.isValid(categoryId)) {
    throw new ApiError(400, 'Invalid category ID.', 'INVALID_CATEGORY_ID');
  }

  const category = await Category.findById(categoryId);
  if (!category) {
    throw new ApiError(404, 'Category not found.', 'CATEGORY_NOT_FOUND');
  }

  const isAdmin = requesterUser && requesterUser.role === USER_ROLES.ADMIN;
  if (!isAdmin && category.status !== CATEGORY_STATUS.ACTIVE) {
    throw new ApiError(404, 'Category is inactive or unavailable.', 'CATEGORY_INACTIVE');
  }

  return category;
};

/**
 * Admin updates an existing Category.
 */
export const updateCategoryService = async (categoryId, payload) => {
  if (!mongoose.Types.ObjectId.isValid(categoryId)) {
    throw new ApiError(400, 'Invalid category ID.', 'INVALID_CATEGORY_ID');
  }

  const category = await Category.findById(categoryId);
  if (!category) {
    throw new ApiError(404, 'Category not found.', 'CATEGORY_NOT_FOUND');
  }

  if (payload.name && payload.name.toLowerCase() !== category.name.toLowerCase()) {
    const duplicate = await Category.findOne({
      _id: { $ne: category._id },
      name: { $regex: `^${payload.name.trim()}$`, $options: 'i' },
    });
    if (duplicate) {
      throw new ApiError(409, `Category [${payload.name}] already exists.`, 'DUPLICATE_CATEGORY');
    }
    category.name = payload.name;
  }

  if (payload.description !== undefined) category.description = payload.description;
  if (payload.status !== undefined) category.status = payload.status;

  await category.save();
  return category;
};

/**
 * Admin deletes or deactivates a Category.
 */
export const deleteCategoryService = async (categoryId) => {
  if (!mongoose.Types.ObjectId.isValid(categoryId)) {
    throw new ApiError(400, 'Invalid category ID.', 'INVALID_CATEGORY_ID');
  }

  const category = await Category.findById(categoryId);
  if (!category) {
    throw new ApiError(404, 'Category not found.', 'CATEGORY_NOT_FOUND');
  }

  const linkedProductsCount = await Product.countDocuments({ category: category._id });
  if (linkedProductsCount > 0) {
    category.status = CATEGORY_STATUS.INACTIVE;
    await category.save();
    return {
      category,
      deleted: false,
      deactivated: true,
      message: `Category is linked to ${linkedProductsCount} product(s) and was marked INACTIVE instead of hard-deleted.`,
    };
  }

  await category.deleteOne();
  return {
    deleted: true,
    deactivated: false,
    message: 'Category permanently deleted.',
  };
};
