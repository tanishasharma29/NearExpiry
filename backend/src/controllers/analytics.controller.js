import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import {
  getSellerAnalyticsService,
  getAdminAnalyticsService,
} from '../services/analytics.service.js';

/**
 * @desc    Get Seller Analytics & Recharts Series
 * @route   GET /api/v1/analytics/seller
 * @access  Private (SELLER)
 */
export const getSellerAnalytics = asyncHandler(async (req, res) => {
  const result = await getSellerAnalyticsService(req.user, req.query);
  return res.status(200).json(
    new ApiResponse(200, 'Seller analytics retrieved successfully', result)
  );
});

/**
 * @desc    Get Platform-Wide Admin Analytics & Recharts Series
 * @route   GET /api/v1/analytics/admin
 * @access  Private (ADMIN)
 */
export const getAdminAnalytics = asyncHandler(async (req, res) => {
  const result = await getAdminAnalyticsService(req.query);
  return res.status(200).json(
    new ApiResponse(200, 'Admin analytics retrieved successfully', result)
  );
});
