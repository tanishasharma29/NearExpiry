import mongoose from 'mongoose';
import { Category, CATEGORY_STATUS } from '../models/category.model.js';
import { Product } from '../models/product.model.js';
import { USER_ROLES } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import {
  remember,
  buildCacheKey,
  invalidateCategoryCache,
  CACHE_TTL,
} from '../utils/cache.util.js';

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

  // Invalidate public category lists & affected product lists
  await invalidateCategoryCache(category._id);

  return category;
};

export const DEFAULT_CURATED_CATEGORIES = [
  { name: 'Dairy & Eggs', description: 'Fresh milk, curd, paneer, yogurts, cheeses, and farm eggs with short shelf-life deals.' },
  { name: 'Bakery & Bread', description: 'Fresh bread, pav, buns, cakes, cookies, croissants, and daily artisanal bakes.' },
  { name: 'Fruits & Vegetables', description: 'Farm fresh fruits, seasonal green veggies, salads, and ripe produce at markdown prices.' },
  { name: 'Snacks & Munchies', description: 'Chips, crisps, namkeen, roasted nuts, biscuits, and savory evening snacks.' },
  { name: 'Beverages & Juices', description: 'Cold-pressed juices, milkshakes, soft drinks, artisan tea, and brewed coffees.' },
  { name: 'Meat, Seafood & Poultry', description: 'High-protein fresh chicken, mutton cuts, farm eggs, and fresh fish.' },
  { name: 'Pantry & Staples', description: 'Grains, organic flours, rice, pulses, cooking oils, ghee, and everyday spices.' },
  { name: 'Packaged & Instant Foods', description: 'Noodles, pasta, gourmet sauces, breakfast cereals, spreads, and ready meals.' },
  { name: 'Chocolates & Sweets', description: 'Premium chocolates, Indian sweets, confectionery, and dessert treats.' },
  { name: 'Personal Care & Household', description: 'Bath soaps, shampoos, skincare essentials, sanitizers, and cleaning supplies.' },
  { name: 'Medicine', description: 'Prescription OTC healthcare, first-aid, wellness supplements, and medical essentials.' },
];

export const seedCuratedCategoriesIfEmpty = async () => {
  const count = await Category.countDocuments();
  if (count === 0) {
    for (const cat of DEFAULT_CURATED_CATEGORIES) {
      await Category.create({ ...cat, status: CATEGORY_STATUS.ACTIVE });
    }
  }
};

/**
 * List Categories with Pagination, Sorting, and Filtering.
 * - Customers / Public see only ACTIVE categories by default.
 * - Admin can view both ACTIVE and INACTIVE categories.
 */
export const listCategoriesService = async (query = {}, requesterUser = null) => {
  const count = await Category.countDocuments();
  if (count === 0) {
    await seedCuratedCategoriesIfEmpty();
  }

  const page = Math.max(parseInt(query.page || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(query.limit || '100', 10), 1), 100);
  const skip = (page - 1) * limit;

  const isAdmin = requesterUser && requesterUser.role === USER_ROLES.ADMIN;

  // Privileged admin requests bypass shared public cache
  if (isAdmin) {
    const filter = {};
    if (query.status) {
      filter.status = query.status;
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
  }

  // Public/Customer requests: Cache-Aside with 1-hour TTL
  const cacheKey = buildCacheKey('categories', 'list', {
    page,
    limit,
    sortBy: query.sortBy || 'name',
    sortOrder: query.sortOrder || 'asc',
    search: query.search ? query.search.trim() : '',
  });

  const { data } = await remember(cacheKey, CACHE_TTL.CATEGORIES_LIST, async () => {
    const filter = { status: CATEGORY_STATUS.ACTIVE };
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
        .limit(limit)
        .lean(),
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
  });

  return data;
};

/**
 * Get a single Category by ID.
 */
export const getCategoryByIdService = async (categoryId, requesterUser = null) => {
  if (!mongoose.Types.ObjectId.isValid(categoryId)) {
    throw new ApiError(400, 'Invalid category ID.', 'INVALID_CATEGORY_ID');
  }

  const isAdmin = requesterUser && requesterUser.role === USER_ROLES.ADMIN;

  if (isAdmin) {
    const category = await Category.findById(categoryId);
    if (!category) {
      throw new ApiError(404, 'Category not found.', 'CATEGORY_NOT_FOUND');
    }
    return category;
  }

  // Public/Customer request: Cache-Aside
  const cacheKey = buildCacheKey('categories', `detail:${categoryId}`);
  const { data } = await remember(cacheKey, CACHE_TTL.CATEGORY_DETAIL, async () => {
    const category = await Category.findById(categoryId).lean();
    if (!category) {
      throw new ApiError(404, 'Category not found.', 'CATEGORY_NOT_FOUND');
    }
    if (category.status !== CATEGORY_STATUS.ACTIVE) {
      throw new ApiError(404, 'Category is inactive or unavailable.', 'CATEGORY_INACTIVE');
    }
    return category;
  });

  return data;
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

  // Invalidate affected category and product caches
  await invalidateCategoryCache(categoryId);

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
  let result;

  if (linkedProductsCount > 0) {
    category.status = CATEGORY_STATUS.INACTIVE;
    await category.save();
    result = {
      category,
      deleted: false,
      deactivated: true,
      message: `Category is linked to ${linkedProductsCount} product(s) and was marked INACTIVE instead of hard-deleted.`,
    };
  } else {
    await category.deleteOne();
    result = {
      deleted: true,
      deactivated: false,
      message: 'Category permanently deleted.',
    };
  }

  // Invalidate affected category and product caches
  await invalidateCategoryCache(categoryId);

  return result;
};
