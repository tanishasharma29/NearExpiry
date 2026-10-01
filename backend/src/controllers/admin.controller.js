import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import {
  getAdminDashboardMetricsService,
  listSellersService,
  reviewSellerApprovalService,
  listUsersService,
  getUserDetailsService,
  updateUserStatusService,
  listStoresAdminService,
  getStoreDetailsAdminService,
  updateStoreStatusAdminService,
  listProductsAdminService,
  moderateProductAdminService,
  listCategoriesAdminService,
  listPricingRulesAdminService,
  resetPricingRulesAdminService,
  triggerManualSweepAdminService,
  getInventoryMonitoringService,
  getExpiryMonitoringService,
  listOrdersAdminService,
  getOrderDetailsAdminService,
  getAdminReportsService,
  getAdminAuditLogsService,
} from '../services/admin.service.js';

export const getDashboardMetrics = asyncHandler(async (req, res) => {
  const result = await getAdminDashboardMetricsService();
  return res.status(200).json(
    new ApiResponse(200, 'Admin dashboard metrics retrieved successfully', result)
  );
});

export const listSellers = asyncHandler(async (req, res) => {
  const result = await listSellersService(req.query);
  return res.status(200).json(
    new ApiResponse(200, 'Sellers list retrieved successfully', result)
  );
});

export const reviewSellerApproval = asyncHandler(async (req, res) => {
  const result = await reviewSellerApprovalService(req.params.id, req.body, req.user);
  return res.status(200).json(
    new ApiResponse(200, 'Seller approval review completed', result)
  );
});

export const listUsers = asyncHandler(async (req, res) => {
  const result = await listUsersService(req.query);
  return res.status(200).json(
    new ApiResponse(200, 'Users list retrieved successfully', result)
  );
});

export const getUserDetails = asyncHandler(async (req, res) => {
  const result = await getUserDetailsService(req.params.id);
  return res.status(200).json(
    new ApiResponse(200, 'User details retrieved successfully', result)
  );
});

export const updateUserStatus = asyncHandler(async (req, res) => {
  const result = await updateUserStatusService(req.params.id, req.body, req.user);
  return res.status(200).json(
    new ApiResponse(200, 'User status updated successfully', result)
  );
});

export const listStores = asyncHandler(async (req, res) => {
  const result = await listStoresAdminService(req.query);
  return res.status(200).json(
    new ApiResponse(200, 'Stores list retrieved successfully', result)
  );
});

export const getStoreDetails = asyncHandler(async (req, res) => {
  const result = await getStoreDetailsAdminService(req.params.id);
  return res.status(200).json(
    new ApiResponse(200, 'Store details retrieved successfully', result)
  );
});

export const updateStoreStatus = asyncHandler(async (req, res) => {
  const result = await updateStoreStatusAdminService(req.params.id, req.body);
  return res.status(200).json(
    new ApiResponse(200, 'Store status updated successfully', result)
  );
});

export const listProducts = asyncHandler(async (req, res) => {
  const result = await listProductsAdminService(req.query);
  return res.status(200).json(
    new ApiResponse(200, 'Products list retrieved successfully', result)
  );
});

export const moderateProduct = asyncHandler(async (req, res) => {
  const result = await moderateProductAdminService(req.params.id, req.body);
  return res.status(200).json(
    new ApiResponse(200, 'Product moderation status updated successfully', result)
  );
});

export const listCategories = asyncHandler(async (req, res) => {
  const result = await listCategoriesAdminService();
  return res.status(200).json(
    new ApiResponse(200, 'Categories with product stats retrieved', result)
  );
});

export const listPricingRules = asyncHandler(async (req, res) => {
  const result = await listPricingRulesAdminService();
  return res.status(200).json(
    new ApiResponse(200, 'Pricing rules retrieved successfully', result)
  );
});

export const resetPricingRules = asyncHandler(async (req, res) => {
  const result = await resetPricingRulesAdminService(req.user);
  return res.status(200).json(
    new ApiResponse(200, 'Pricing rules reset to system defaults', result)
  );
});

export const triggerManualSweep = asyncHandler(async (req, res) => {
  const result = await triggerManualSweepAdminService(req.user);
  return res.status(200).json(
    new ApiResponse(200, 'Manual dynamic pricing & expiry sweep triggered', result)
  );
});

export const getInventoryMonitoring = asyncHandler(async (req, res) => {
  const result = await getInventoryMonitoringService(req.query);
  return res.status(200).json(
    new ApiResponse(200, 'Inventory monitoring report retrieved', result)
  );
});

export const getExpiryMonitoring = asyncHandler(async (req, res) => {
  const result = await getExpiryMonitoringService();
  return res.status(200).json(
    new ApiResponse(200, 'Expiry radar and monitoring data retrieved', result)
  );
});

export const listOrders = asyncHandler(async (req, res) => {
  const result = await listOrdersAdminService(req.query);
  return res.status(200).json(
    new ApiResponse(200, 'Orders list retrieved successfully', result)
  );
});

export const getOrderDetails = asyncHandler(async (req, res) => {
  const result = await getOrderDetailsAdminService(req.params.id);
  return res.status(200).json(
    new ApiResponse(200, 'Order details retrieved successfully', result)
  );
});

export const getReports = asyncHandler(async (req, res) => {
  const result = await getAdminReportsService(req.query);
  return res.status(200).json(
    new ApiResponse(200, 'Admin report generated successfully', result)
  );
});

export const getAuditLogs = asyncHandler(async (req, res) => {
  const result = await getAdminAuditLogsService(req.query);
  return res.status(200).json(
    new ApiResponse(200, 'Audit logs retrieved successfully', result)
  );
});
