import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import {
  createOrderService,
  getCustomerOrdersService,
  getSellerOrdersService,
  getOrderByIdService,
  trackOrderService,
  updateOrderStatusService,
  cancelOrderService,
} from '../services/order.service.js';

/**
 * @desc    Create Order from Active Cart (Atomic FEFO inventory deduction)
 * @route   POST /api/v1/orders
 * @access  Private (CUSTOMER)
 */
export const createOrder = asyncHandler(async (req, res) => {
  const order = await createOrderService(req.user._id, req.body || {}, req.user);
  return res.status(201).json(
    new ApiResponse(201, 'Order placed successfully', order)
  );
});

/**
 * @desc    Get Customer Order History
 * @route   GET /api/v1/orders
 * @access  Private (CUSTOMER)
 */
export const getCustomerOrders = asyncHandler(async (req, res) => {
  const result = await getCustomerOrdersService(req.user._id, req.query);
  return res.status(200).json(
    new ApiResponse(200, 'Customer orders retrieved', result)
  );
});

/**
 * @desc    Get Seller's Store Orders
 * @route   GET /api/v1/orders/seller
 * @access  Private (SELLER)
 */
export const getSellerOrders = asyncHandler(async (req, res) => {
  const result = await getSellerOrdersService(req.user, req.query);
  return res.status(200).json(
    new ApiResponse(200, 'Seller store orders retrieved', result)
  );
});

/**
 * @desc    Get Detailed Order by ID
 * @route   GET /api/v1/orders/:orderId
 * @access  Private (CUSTOMER / SELLER / ADMIN)
 */
export const getOrderById = asyncHandler(async (req, res) => {
  const order = await getOrderByIdService(req.params.orderId, req.user);
  return res.status(200).json(
    new ApiResponse(200, 'Order details retrieved', order)
  );
});

/**
 * @desc    Order Tracking Timeline
 * @route   GET /api/v1/orders/:orderId/track
 * @access  Private (CUSTOMER / SELLER / ADMIN)
 */
export const trackOrder = asyncHandler(async (req, res) => {
  const tracking = await trackOrderService(req.params.orderId, req.user);
  return res.status(200).json(
    new ApiResponse(200, 'Order tracking details retrieved', tracking)
  );
});

/**
 * @desc    Update Order Status (SELLER / ADMIN)
 * @route   PATCH /api/v1/orders/:orderId/status
 * @access  Private (SELLER / ADMIN)
 */
export const updateOrderStatus = asyncHandler(async (req, res) => {
  const order = await updateOrderStatusService(
    req.params.orderId,
    req.body.status,
    req.user,
    req.body.note
  );
  return res.status(200).json(
    new ApiResponse(200, 'Order status updated successfully', order)
  );
});

/**
 * @desc    Cancel Order (Customer / Seller / Admin with BR-05 Restock)
 * @route   POST /api/v1/orders/:orderId/cancel
 * @access  Private (CUSTOMER / SELLER / ADMIN)
 */
export const cancelOrder = asyncHandler(async (req, res) => {
  const order = await cancelOrderService(req.params.orderId, req.user, req.body.reason);
  return res.status(200).json(
    new ApiResponse(200, 'Order cancelled successfully', order)
  );
});
