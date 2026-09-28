import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import {
  createCategoryService,
  listCategoriesService,
  getCategoryByIdService,
  updateCategoryService,
  deleteCategoryService,
} from '../services/category.service.js';

/**
 * @desc    Create a new Category (Admin only)
 * @route   POST /api/v1/categories
 * @access  Private (ADMIN)
 */
export const createCategory = asyncHandler(async (req, res) => {
  const category = await createCategoryService(req.user._id, req.body);
  return res
    .status(201)
    .json(new ApiResponse(201, 'Category created successfully', { category }));
});

/**
 * @desc    List Categories (Customers see ACTIVE; Admin sees all / filtered)
 * @route   GET /api/v1/categories
 * @access  Public / Role-Aware
 */
export const listCategories = asyncHandler(async (req, res) => {
  const result = await listCategoriesService(req.query, req.user);
  return res
    .status(200)
    .json(new ApiResponse(200, 'Categories fetched successfully', result));
});

/**
 * @desc    Get single Category by ID
 * @route   GET /api/v1/categories/:id
 * @access  Public / Role-Aware
 */
export const getCategoryById = asyncHandler(async (req, res) => {
  const category = await getCategoryByIdService(req.params.id, req.user);
  return res
    .status(200)
    .json(new ApiResponse(200, 'Category fetched successfully', { category }));
});

/**
 * @desc    Update Category (Admin only)
 * @route   PUT /api/v1/categories/:id
 * @route   PATCH /api/v1/categories/:id
 * @access  Private (ADMIN)
 */
export const updateCategory = asyncHandler(async (req, res) => {
  const category = await updateCategoryService(req.params.id, req.body);
  return res
    .status(200)
    .json(new ApiResponse(200, 'Category updated successfully', { category }));
});

/**
 * @desc    Delete / Deactivate Category (Admin only)
 * @route   DELETE /api/v1/categories/:id
 * @access  Private (ADMIN)
 */
export const deleteCategory = asyncHandler(async (req, res) => {
  const result = await deleteCategoryService(req.params.id);
  return res.status(200).json(new ApiResponse(200, result.message, result));
});
