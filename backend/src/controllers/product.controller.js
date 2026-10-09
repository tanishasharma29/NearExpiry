import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import {
  createProductService,
  listProductsService,
  listSellerOwnProductsService,
  getProductByIdService,
  getPopularProductsService,
  updateProductService,
  deleteProductService,
} from '../services/product.service.js';

/**
 * @desc    Create a new Product (Seller only — no batch expiry fields allowed)
 * @route   POST /api/v1/products
 * @access  Private (SELLER)
 */
export const createProduct = asyncHandler(async (req, res) => {
  const product = await createProductService(req.user, req.body);
  return res
    .status(201)
    .json(new ApiResponse(201, 'Product created successfully', { product }));
});

/**
 * @desc    List Active Products with Pagination, Sorting & Filtering (Customer / Public)
 * @route   GET /api/v1/products
 * @access  Public
 */
export const listProducts = asyncHandler(async (req, res) => {
  const result = await listProductsService(req.query, req.user);
  return res
    .status(200)
    .json(new ApiResponse(200, 'Products fetched successfully', result));
});

/**
 * @desc    List Authenticated Seller's Own Products
 * @route   GET /api/v1/products/my-products
 * @route   GET /api/v1/products/seller/my-products
 * @access  Private (SELLER)
 */
export const listSellerOwnProducts = asyncHandler(async (req, res) => {
  const result = await listSellerOwnProductsService(req.user._id, req.query);
  return res
    .status(200)
    .json(new ApiResponse(200, 'Seller products fetched successfully', result));
});

/**
 * @desc    Get Top-Selling / Popular Products with Caching (Public)
 * @route   GET /api/v1/products/popular
 * @access  Public
 */
export const getPopularProducts = asyncHandler(async (req, res) => {
  const limit = req.query.limit || 10;
  const products = await getPopularProductsService(limit);
  return res
    .status(200)
    .json(new ApiResponse(200, 'Popular products fetched successfully', { products }));
});

/**
 * @desc    Get single Product by ID
 * @route   GET /api/v1/products/:id
 * @access  Public (ACTIVE only) / Seller (Own) / Admin (All)
 */
export const getProductById = asyncHandler(async (req, res) => {
  const product = await getProductByIdService(req.params.id, req.user);
  return res
    .status(200)
    .json(new ApiResponse(200, 'Product details fetched successfully', { product }));
});

/**
 * @desc    Update Product (Seller can update ONLY their own products; Admin can update any)
 * @route   PUT /api/v1/products/:id
 * @route   PATCH /api/v1/products/:id
 * @access  Private (SELLER, ADMIN)
 */
export const updateProduct = asyncHandler(async (req, res) => {
  const product = await updateProductService(req.params.id, req.user, req.body);
  return res
    .status(200)
    .json(new ApiResponse(200, 'Product updated successfully', { product }));
});

/**
 * @desc    Delete Product (Seller can delete ONLY their own products; Admin can delete any)
 * @route   DELETE /api/v1/products/:id
 * @access  Private (SELLER, ADMIN)
 */
export const deleteProduct = asyncHandler(async (req, res) => {
  const result = await deleteProductService(req.params.id, req.user);
  return res
    .status(200)
    .json(new ApiResponse(200, 'Product deleted successfully', result));
});
