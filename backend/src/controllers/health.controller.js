import { asyncHandler } from '../utils/asyncHandler.js';
import { getSystemHealthStatus } from '../services/health.service.js';

export const checkHealth = asyncHandler(async (req, res) => {
  getSystemHealthStatus();

  return res.status(200).json({
    success: true,
    message: 'NearExpiry API is running',
  });
});
