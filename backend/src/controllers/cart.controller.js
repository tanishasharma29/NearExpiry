import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import {
  getCartSummaryService,
  addItemToCartService,
  updateCartItemQuantityService,
  removeCartItemService,
  clearCartService,
  validateCartForCheckoutService,
  syncOrPruneCartService,
  reserveCartStockService,
} from '../services/cart.service.js';

/**
 * @desc    Retrieve Customer Cart with Live FEFO Pricing, Subtotal & Discounts
 * @route   GET /api/v1/cart
 * @access  Private (CUSTOMER)
 */
export const getCart = asyncHandler(async (req, res) => {
  const summary = await getCartSummaryService(req.user._id);
  return res.status(200).json(
    new ApiResponse(200, 'Cart retrieved successfully', summary)
  );
});

/**
 * @desc    Add Item to Cart (validates product, store, expiry & stock)
 * @route   POST /api/v1/cart/items
 * @access  Private (CUSTOMER)
 */
export const addItemToCart = asyncHandler(async (req, res) => {
  const summary = await addItemToCartService(req.user._id, req.body);
  return res.status(200).json(
    new ApiResponse(200, 'Item added to cart', summary)
  );
});

/**
 * @desc    Update Item Quantity in Cart
 * @route   PUT /api/v1/cart/items/:productId
 * @access  Private (CUSTOMER)
 */
export const updateCartItemQuantity = asyncHandler(async (req, res) => {
  const summary = await updateCartItemQuantityService(
    req.user._id,
    req.params.productId,
    req.body.quantity
  );
  return res.status(200).json(
    new ApiResponse(200, 'Cart item quantity updated', summary)
  );
});

/**
 * @desc    Remove Item from Cart
 * @route   DELETE /api/v1/cart/items/:productId
 * @access  Private (CUSTOMER)
 */
export const removeCartItem = asyncHandler(async (req, res) => {
  const summary = await removeCartItemService(req.user._id, req.params.productId);
  return res.status(200).json(
    new ApiResponse(200, 'Item removed from cart', summary)
  );
});

/**
 * @desc    Clear All Items from Cart
 * @route   DELETE /api/v1/cart
 * @access  Private (CUSTOMER)
 */
export const clearCart = asyncHandler(async (req, res) => {
  const summary = await clearCartService(req.user._id);
  return res.status(200).json(
    new ApiResponse(200, 'Cart cleared successfully', summary)
  );
});

/**
 * @desc    Strict Checkout Pre-flight Validation (never trust frontend prices)
 * @route   POST /api/v1/cart/checkout-validate
 * @access  Private (CUSTOMER)
 */
export const checkoutValidate = asyncHandler(async (req, res) => {
  const result = await validateCartForCheckoutService(req.user._id, req.body || {});
  return res.status(200).json(
    new ApiResponse(200, 'Cart validated successfully for checkout', result)
  );
});

/**
 * @desc    Sync & Prune Cart (auto-clean expired or out-of-stock items)
 * @route   POST /api/v1/cart/sync
 * @access  Private (CUSTOMER)
 */
export const syncCart = asyncHandler(async (req, res) => {
  const result = await syncOrPruneCartService(req.user._id);
  return res.status(200).json(
    new ApiResponse(200, 'Cart synchronized with live inventory', result)
  );
});

/**
 * @desc    Atomic Stock Reservation for Checkout
 * @route   POST /api/v1/cart/reserve
 * @access  Private (CUSTOMER)
 */
export const reserveCartStock = asyncHandler(async (req, res) => {
  const result = await reserveCartStockService(req.user._id, req.user);
  return res.status(200).json(
    new ApiResponse(200, 'Cart inventory reserved successfully', result)
  );
});
