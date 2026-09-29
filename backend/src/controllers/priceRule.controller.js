import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import {
  listPriceRulesService,
  createPriceRuleService,
  updatePriceRuleService,
  deletePriceRuleService,
  resetDefaultPriceRulesService,
} from '../services/priceRule.service.js';
import {
  calculatePricingFromDatabaseService,
  applyDynamicPricingToBatchService,
  recalculateAllBatchesPricingService,
  capturePurchaseTimePriceSnapshotService,
} from '../services/pricing.service.js';
import { PriceAuditLog } from '../models/priceAudit.model.js';

/**
 * @desc    Get all configurable PriceRules from MongoDB
 * @route   GET /api/v1/pricing/rules
 * @access  Public / Authenticated
 */
export const listPriceRules = asyncHandler(async (req, res) => {
  const rules = await listPriceRulesService(req.query);
  return res.status(200).json(
    new ApiResponse(200, 'Dynamic pricing rules fetched successfully', {
      count: rules.length,
      rules,
    })
  );
});

/**
 * @desc    Admin creates a new PriceRule
 * @route   POST /api/v1/pricing/rules
 * @access  Private (ADMIN)
 */
export const createPriceRule = asyncHandler(async (req, res) => {
  const result = await createPriceRuleService(req.user._id, req.body);
  return res
    .status(201)
    .json(new ApiResponse(201, 'Price rule created and batches recalculated', result));
});

/**
 * @desc    Admin updates an existing PriceRule
 * @route   PUT /api/v1/pricing/rules/:id
 * @route   PATCH /api/v1/pricing/rules/:id
 * @access  Private (ADMIN)
 */
export const updatePriceRule = asyncHandler(async (req, res) => {
  const result = await updatePriceRuleService(req.params.id, req.user._id, req.body);
  return res
    .status(200)
    .json(new ApiResponse(200, 'Price rule updated and batches recalculated', result));
});

/**
 * @desc    Admin deletes a PriceRule
 * @route   DELETE /api/v1/pricing/rules/:id
 * @access  Private (ADMIN)
 */
export const deletePriceRule = asyncHandler(async (req, res) => {
  const result = await deletePriceRuleService(req.params.id, req.user._id);
  return res
    .status(200)
    .json(new ApiResponse(200, 'Price rule deleted and batches recalculated', result));
});

/**
 * @desc    Admin resets/seeds default 6-tier PriceRules
 * @route   POST /api/v1/pricing/rules/seed-defaults
 * @access  Private (ADMIN)
 */
export const seedDefaultPriceRules = asyncHandler(async (req, res) => {
  const result = await resetDefaultPriceRulesService(req.user._id);
  return res
    .status(200)
    .json(new ApiResponse(200, 'Default 6-tier price rules seeded and applied', result));
});

/**
 * @desc    Simulate / Calculate Dynamic Pricing Result for any (originalPrice, remainingDays / expiryDate)
 * @route   POST /api/v1/pricing/simulate
 * @access  Public
 */
export const simulatePricing = asyncHandler(async (req, res) => {
  const pricingResult = await calculatePricingFromDatabaseService(req.body);
  return res
    .status(200)
    .json(new ApiResponse(200, 'Dynamic pricing result computed', pricingResult));
});

/**
 * @desc    Calculate & persist dynamic price for a specific Batch ID
 * @route   GET /api/v1/pricing/batch/:batchId
 * @route   POST /api/v1/pricing/batch/:batchId/recalculate
 * @access  Public / Authenticated
 */
export const calculateBatchDynamicPrice = asyncHandler(async (req, res) => {
  const { pricingResult, batch, auditLog } = await applyDynamicPricingToBatchService(
    req.params.batchId,
    { triggeredBy: req.user?._id || null }
  );

  return res.status(200).json(
    new ApiResponse(200, 'Batch dynamic pricing calculated', {
      pricing: pricingResult,
      batch,
      auditLog,
    })
  );
});

/**
 * @desc    Recalculate dynamic prices across all batches
 * @route   POST /api/v1/pricing/recalculate-all
 * @access  Private (ADMIN, SELLER)
 */
export const recalculateAllBatches = asyncHandler(async (req, res) => {
  const summary = await recalculateAllBatchesPricingService({
    triggeredBy: req.user._id,
  });
  return res
    .status(200)
    .json(new ApiResponse(200, 'All batches dynamically repriced', summary));
});

/**
 * @desc    Capture purchase-time price snapshot for an Order Item (Rule 5)
 * @route   POST /api/v1/pricing/purchase-snapshot
 * @access  Private
 */
export const getPurchasePriceSnapshot = asyncHandler(async (req, res) => {
  const snapshot = await capturePurchaseTimePriceSnapshotService(
    req.body.batchId,
    req.body.quantity || 1
  );
  return res
    .status(200)
    .json(new ApiResponse(200, 'Purchase-time price snapshot locked', { snapshot }));
});

/**
 * @desc    List Price Audit Logs (Rule 6: Price changes must be auditable)
 * @route   GET /api/v1/pricing/audit-logs
 * @access  Private (SELLER, ADMIN)
 */
export const listPriceAuditLogs = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.batchId) filter.batchId = req.query.batchId;
  if (req.query.storeId) filter.storeId = req.query.storeId;

  const logs = await PriceAuditLog.find(filter)
    .populate('appliedRuleId', 'name minDays maxDays discountPercentage')
    .sort({ createdAt: -1 })
    .limit(50);

  return res.status(200).json(
    new ApiResponse(200, 'Price audit logs fetched successfully', {
      count: logs.length,
      logs,
    })
  );
});
