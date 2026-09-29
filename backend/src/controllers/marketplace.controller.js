import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import {
  browseMarketplaceProductsService,
  getMarketplaceProductDetailsService,
} from '../services/marketplace.service.js';
import {
  addToWishlistService,
  getCustomerWishlistService,
  removeFromWishlistService,
} from '../services/wishlist.service.js';

/**
 * @desc    Browse, Search, Filter (Category, Price, Discount, Expiry Window, Store, Nearby) & Sort Marketplace
 * @route   GET /api/v1/marketplace/products
 * @route   GET /api/v1/marketplace/nearby
 * @access  Public / Customer
 */
export const browseMarketplace = asyncHandler(async (req, res) => {
  const result = await browseMarketplaceProductsService(req.query);
  return res
    .status(200)
    .json(new ApiResponse(200, 'Marketplace products fetched successfully', result));
});

/**
 * @desc    View Product Details & Available Non-Expired Batches in FEFO Order
 * @route   GET /api/v1/marketplace/products/:productId
 * @access  Public / Customer
 */
export const getMarketplaceProductDetails = asyncHandler(async (req, res) => {
  const result = await getMarketplaceProductDetailsService(req.params.productId, req.query);
  return res
    .status(200)
    .json(new ApiResponse(200, 'Marketplace product details and batches fetched', result));
});

/**
 * @desc    View Only Available Non-Expired Batches for a Product
 * @route   GET /api/v1/marketplace/products/:productId/batches
 * @access  Public / Customer
 */
export const getMarketplaceProductBatches = asyncHandler(async (req, res) => {
  const result = await getMarketplaceProductDetailsService(req.params.productId, req.query);
  return res.status(200).json(
    new ApiResponse(200, 'Available purchasable batches fetched in FEFO order', {
      productId: result.product._id,
      productName: result.product.name,
      isPurchasable: result.isPurchasable,
      fefoSummary: result.fefoSummary,
      availableBatches: result.availableBatches,
    })
  );
});

/**
 * @desc    Add Product to Customer Wishlist
 * @route   POST /api/v1/wishlist
 * @route   POST /api/v1/marketplace/wishlist
 * @access  Private (CUSTOMER)
 */
export const addToWishlist = asyncHandler(async (req, res) => {
  const item = await addToWishlistService(req.user._id, req.body);
  return res
    .status(201)
    .json(new ApiResponse(201, 'Product added to wishlist', { wishlistItem: item }));
});

/**
 * @desc    Get Customer Wishlist with Live Batch Pricing & Availability
 * @route   GET /api/v1/wishlist
 * @route   GET /api/v1/marketplace/wishlist
 * @access  Private (CUSTOMER)
 */
export const getWishlist = asyncHandler(async (req, res) => {
  const wishlist = await getCustomerWishlistService(req.user._id);
  return res.status(200).json(
    new ApiResponse(200, 'Customer wishlist fetched successfully', {
      count: wishlist.length,
      wishlist,
    })
  );
});

/**
 * @desc    Remove Product from Customer Wishlist
 * @route   DELETE /api/v1/wishlist/:productId
 * @route   DELETE /api/v1/marketplace/wishlist/:productId
 * @access  Private (CUSTOMER)
 */
export const removeFromWishlist = asyncHandler(async (req, res) => {
  const result = await removeFromWishlistService(req.user._id, req.params.productId);
  return res
    .status(200)
    .json(new ApiResponse(200, 'Product removed from wishlist', result));
});
