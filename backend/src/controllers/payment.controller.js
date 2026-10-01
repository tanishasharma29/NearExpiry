import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import {
  processPaymentService,
  confirmCodPaymentService,
  refundPaymentService,
  getPaymentByOrderIdService,
  getPaymentByIdService,
} from '../services/payment.service.js';

/**
 * @desc    Process Payment for Order (with Idempotency)
 * @route   POST /api/v1/payments/process
 * @access  Private (CUSTOMER)
 */
export const processPayment = asyncHandler(async (req, res) => {
  const result = await processPaymentService(req.user._id, req.body, req.user);
  return res.status(200).json(
    new ApiResponse(200, 'Payment processed successfully', result)
  );
});

/**
 * @desc    Confirm Cash on Delivery Collection
 * @route   POST /api/v1/payments/:paymentId/confirm-cod
 * @access  Private (SELLER / ADMIN)
 */
export const confirmCodPayment = asyncHandler(async (req, res) => {
  const payment = await confirmCodPaymentService(
    req.params.paymentId,
    req.user,
    req.body?.notes
  );
  return res.status(200).json(
    new ApiResponse(200, 'Cash on delivery payment confirmed', payment)
  );
});

/**
 * @desc    Issue Refund for Payment
 * @route   POST /api/v1/payments/:paymentId/refund
 * @access  Private (SELLER / ADMIN)
 */
export const refundPayment = asyncHandler(async (req, res) => {
  const payment = await refundPaymentService(
    req.params.paymentId,
    req.user,
    req.body.reason,
    req.body.amount
  );
  return res.status(200).json(
    new ApiResponse(200, 'Payment refund processed', payment)
  );
});

/**
 * @desc    Get Payment for an Order
 * @route   GET /api/v1/payments/order/:orderId
 * @access  Private (CUSTOMER / SELLER / ADMIN)
 */
export const getPaymentByOrderId = asyncHandler(async (req, res) => {
  const payment = await getPaymentByOrderIdService(req.params.orderId, req.user);
  return res.status(200).json(
    new ApiResponse(200, 'Payment details retrieved', payment)
  );
});

/**
 * @desc    Get Payment by ID
 * @route   GET /api/v1/payments/:paymentId
 * @access  Private (CUSTOMER / SELLER / ADMIN)
 */
export const getPaymentById = asyncHandler(async (req, res) => {
  const payment = await getPaymentByIdService(req.params.paymentId, req.user);
  return res.status(200).json(
    new ApiResponse(200, 'Payment details retrieved', payment)
  );
});
