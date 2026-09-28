import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import {
  getSellerProfileService,
  updateSellerProfileService,
  getSellerVerificationStatusService,
} from '../services/seller.service.js';

/**
 * @desc    Get authenticated Seller profile and store summary
 * @route   GET /api/v1/sellers/profile
 * @access  Private (SELLER)
 */
export const getSellerProfile = asyncHandler(async (req, res) => {
  const data = await getSellerProfileService(req.user._id);
  return res.status(200).json(new ApiResponse(200, 'Seller profile fetched successfully', data));
});

/**
 * @desc    Update authenticated Seller profile
 * @route   PUT /api/v1/sellers/profile
 * @route   PATCH /api/v1/sellers/profile
 * @access  Private (SELLER)
 */
export const updateSellerProfile = asyncHandler(async (req, res) => {
  const data = await updateSellerProfileService(req.user._id, req.body);
  return res.status(200).json(new ApiResponse(200, 'Seller profile updated successfully', data));
});

/**
 * @desc    Check Seller verification status & admin review audit
 * @route   GET /api/v1/sellers/verification-status
 * @access  Private (SELLER)
 */
export const getSellerVerificationStatus = asyncHandler(async (req, res) => {
  const statusData = await getSellerVerificationStatusService(req.user._id);
  return res
    .status(200)
    .json(new ApiResponse(200, 'Seller verification status retrieved', statusData));
});
