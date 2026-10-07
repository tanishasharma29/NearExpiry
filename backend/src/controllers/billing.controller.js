import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import {
  getBillReceiptByOrderIdService,
  getSellerBillReceiptsService,
  getCustomerBillReceiptsService,
} from '../services/billing.service.js';

/**
 * @desc    Get Bill Receipt by Order ID
 * @route   GET /api/v1/billing/order/:orderId
 * @access  Private (CUSTOMER, SELLER, ADMIN)
 */
export const getBillReceiptByOrderId = asyncHandler(async (req, res) => {
  const receipt = await getBillReceiptByOrderIdService(req.params.orderId, req.user);
  return res.status(200).json(
    new ApiResponse(200, 'Bill receipt retrieved successfully', receipt)
  );
});

/**
 * @desc    Get Store's Billing Receipts for Seller Dashboard
 * @route   GET /api/v1/billing/seller
 * @access  Private (SELLER, ADMIN)
 */
export const getSellerBillReceipts = asyncHandler(async (req, res) => {
  const result = await getSellerBillReceiptsService(req.user, req.query);
  return res.status(200).json(
    new ApiResponse(200, 'Seller billing receipts retrieved', result)
  );
});

/**
 * @desc    Get Customer's Personal Billing Receipts
 * @route   GET /api/v1/billing/customer
 * @access  Private (CUSTOMER)
 */
export const getCustomerBillReceipts = asyncHandler(async (req, res) => {
  const result = await getCustomerBillReceiptsService(req.user._id, req.query);
  return res.status(200).json(
    new ApiResponse(200, 'Customer billing receipts retrieved', result)
  );
});

