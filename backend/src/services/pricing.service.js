import { PriceRule } from '../models/priceRule.model.js';
import { PriceAuditLog, PRICE_CHANGE_TRIGGERS } from '../models/priceAudit.model.js';
import { Batch, BATCH_STATUS } from '../models/batch.model.js';
import { Product } from '../models/product.model.js';
import { ApiError } from '../utils/ApiError.js';
import {
  calculateRemainingDays,
  computeBatchStatus,
  isBatchPurchasable,
} from '../utils/shelfLife.js';

/**
 * Pure Dynamic Pricing Algorithm.
 *
 * Evaluates a set of database-fetched PriceRule documents against remainingDays
 * and originalPrice without ANY hard-coded discount brackets.
 *
 * Enforces:
 * 1. Expired products (remainingDays < 0) cannot be purchased (status = 'EXPIRED', isPurchasable = false).
 * 2. Discount percentage must be between 0 and 100.
 * 3. Final price can never be negative (finalPrice >= 0).
 *
 * @param {Object} params
 * @param {number} params.originalPrice
 * @param {number} params.remainingDays
 * @param {number} [params.quantity=1]
 * @param {Array<Object>} params.rules - Active PriceRule documents loaded from MongoDB
 * @param {string|null} [params.categoryId=null]
 * @returns {{
 *   originalPrice: number,
 *   remainingDays: number,
 *   discountPercentage: number,
 *   finalPrice: number,
 *   status: string,
 *   isPurchasable: boolean,
 *   appliedRuleId: any,
 *   appliedRuleName: string | null
 * }}
 */
export const evaluateDynamicPricingAlgorithm = ({
  originalPrice,
  remainingDays,
  quantity = 1,
  rules = [],
  categoryId = null,
}) => {
  if (typeof originalPrice !== 'number' || Number.isNaN(originalPrice) || originalPrice <= 0) {
    throw new ApiError(400, 'originalPrice must be a positive number.', 'INVALID_ORIGINAL_PRICE');
  }

  const status = computeBatchStatus(remainingDays, quantity);
  const purchasable = isBatchPurchasable(remainingDays, quantity, status);

  // Rule 1: Expired products cannot be purchased
  if (remainingDays < 0 || status === BATCH_STATUS.EXPIRED) {
    return {
      originalPrice: Number(originalPrice.toFixed(2)),
      remainingDays,
      discountPercentage: 0,
      finalPrice: Number(originalPrice.toFixed(2)),
      status: BATCH_STATUS.EXPIRED,
      isPurchasable: false,
      appliedRuleId: null,
      appliedRuleName: 'EXPIRED_LOCKOUT',
    };
  }

  // Filter matching rules from database where minDays <= remainingDays <= maxDays (or maxDays === null)
  const matchingRules = rules.filter((rule) => {
    if (!rule.isActive) return false;

    // Scope match: either global (categoryId == null) or matching categoryId
    const ruleCatId = rule.categoryId ? rule.categoryId.toString() : null;
    const targetCatId = categoryId ? categoryId.toString() : null;
    if (ruleCatId !== null && ruleCatId !== targetCatId) {
      return false;
    }

    const meetsMin = remainingDays >= rule.minDays;
    const meetsMax =
      rule.maxDays === null || rule.maxDays === undefined || remainingDays <= rule.maxDays;

    return meetsMin && meetsMax;
  });

  // Sort matched rules so Category-specific rules and higher priority rules win first
  matchingRules.sort((a, b) => {
    const aHasCat = a.categoryId ? 1 : 0;
    const bHasCat = b.categoryId ? 1 : 0;
    if (bHasCat !== aHasCat) return bHasCat - aHasCat;
    return (b.priority || 1) - (a.priority || 1);
  });

  const matchedRule = matchingRules[0] || null;
  const rawDiscount = matchedRule ? Number(matchedRule.discountPercentage) : 0;

  // Rule 3: Discount must be valid (0% to 100%)
  if (rawDiscount < 0 || rawDiscount > 100 || Number.isNaN(rawDiscount)) {
    throw new ApiError(
      400,
      `Invalid discount percentage [${rawDiscount}]. Must be between 0 and 100.`,
      'INVALID_DISCOUNT_PERCENTAGE'
    );
  }

  // Rule 2: Final price cannot be negative
  const rawFinalPrice = originalPrice * (1 - rawDiscount / 100);
  const finalPrice = Math.max(0, Number(rawFinalPrice.toFixed(2)));

  return {
    originalPrice: Number(originalPrice.toFixed(2)),
    remainingDays,
    discountPercentage: rawDiscount,
    finalPrice,
    status,
    isPurchasable: purchasable,
    appliedRuleId: matchedRule ? matchedRule._id : null,
    appliedRuleName: matchedRule ? matchedRule.name : 'DEFAULT_ZERO_DISCOUNT',
  };
};

/**
 * Fetches active PriceRules from MongoDB and computes the live pricing result.
 */
export const calculatePricingFromDatabaseService = async ({
  originalPrice,
  expiryDate,
  remainingDays,
  quantity = 1,
  categoryId = null,
  referenceDate = new Date(),
}) => {
  const resolvedRemainingDays =
    typeof remainingDays === 'number'
      ? remainingDays
      : calculateRemainingDays(expiryDate, referenceDate);

  const queryFilter = {
    isActive: true,
    $or: [{ categoryId: null }, ...(categoryId ? [{ categoryId }] : [])],
  };

  const activeRules = await PriceRule.find(queryFilter).lean();

  return evaluateDynamicPricingAlgorithm({
    originalPrice,
    remainingDays: resolvedRemainingDays,
    quantity,
    rules: activeRules,
    categoryId,
  });
};

/**
 * Recalculates and persists the dynamic price for a single Batch document,
 * recording an immutable PriceAuditLog entry whenever the price or discount changes
 * (or when initially calculated).
 */
export const applyDynamicPricingToBatchService = async (
  batchIdOrDoc,
  {
    triggerSource = PRICE_CHANGE_TRIGGERS.MANUAL_RECALCULATION,
    triggeredBy = null,
    referenceDate = new Date(),
  } = {}
) => {
  const batch =
    batchIdOrDoc instanceof Batch ? batchIdOrDoc : await Batch.findById(batchIdOrDoc);

  if (!batch) {
    throw new ApiError(404, 'Batch not found for pricing calculation.', 'BATCH_NOT_FOUND');
  }

  const product = await Product.findById(batch.productId).select('category name').lean();
  const categoryId = product?.category || null;

  const previousDiscount = batch.discountPercentage ?? 0;
  const previousPrice = batch.currentPrice ?? batch.originalPrice;

  const pricingResult = await calculatePricingFromDatabaseService({
    originalPrice: batch.originalPrice,
    expiryDate: batch.expiryDate,
    quantity: batch.quantity,
    categoryId,
    referenceDate,
  });

  batch.remainingDays = pricingResult.remainingDays;
  batch.discountPercentage = pricingResult.discountPercentage;
  batch.currentPrice = pricingResult.finalPrice;
  batch.status = pricingResult.status;
  batch.isPurchasable = pricingResult.isPurchasable;
  batch.appliedPriceRuleId = pricingResult.appliedRuleId;

  await batch.save();

  // Rule 6: Price changes must be auditable
  const priceChanged =
    previousDiscount !== pricingResult.discountPercentage ||
    previousPrice !== pricingResult.finalPrice ||
    triggerSource === PRICE_CHANGE_TRIGGERS.BATCH_CREATED;

  let auditLog = null;
  if (priceChanged) {
    auditLog = await PriceAuditLog.create({
      batchId: batch._id,
      productId: batch.productId,
      storeId: batch.storeId,
      batchNumber: batch.batchNumber,
      originalPrice: batch.originalPrice,
      remainingDays: pricingResult.remainingDays,
      previousDiscountPercentage: previousDiscount,
      newDiscountPercentage: pricingResult.discountPercentage,
      previousFinalPrice: previousPrice,
      newFinalPrice: pricingResult.finalPrice,
      batchStatus: pricingResult.status,
      appliedRuleId: pricingResult.appliedRuleId,
      appliedRuleName: pricingResult.appliedRuleName,
      triggerSource,
      triggeredBy,
    });
  }

  return {
    pricingResult,
    batch,
    auditLog,
  };
};

/**
 * Recalculates dynamic prices across all active/existing batches in MongoDB.
 * Invoked automatically when Admin creates/updates/deletes a PriceRule, or via cron/manual trigger.
 */
export const recalculateAllBatchesPricingService = async ({
  triggerSource = PRICE_CHANGE_TRIGGERS.MANUAL_RECALCULATION,
  triggeredBy = null,
  storeId = null,
  referenceDate = new Date(),
} = {}) => {
  const filter = storeId ? { storeId } : {};
  const batches = await Batch.find(filter);

  let updatedCount = 0;
  const results = [];

  for (const batch of batches) {
    const prevPrice = batch.currentPrice;
    const prevDiscount = batch.discountPercentage;
    const prevStatus = batch.status;

    const { pricingResult } = await applyDynamicPricingToBatchService(batch, {
      triggerSource,
      triggeredBy,
      referenceDate,
    });

    if (
      prevPrice !== pricingResult.finalPrice ||
      prevDiscount !== pricingResult.discountPercentage ||
      prevStatus !== pricingResult.status
    ) {
      updatedCount += 1;
    }

    results.push({
      batchId: batch._id,
      batchNumber: batch.batchNumber,
      ...pricingResult,
    });
  }

  return {
    totalBatchesEvaluated: batches.length,
    batchesUpdated: updatedCount,
    results,
  };
};

/**
 * Rule 5: Captures an immutable purchase-time price snapshot for an Order item,
 * ensuring expired batches are blocked and historical orders preserve exact purchase-time pricing.
 */
export const capturePurchaseTimePriceSnapshotService = async (batchId, quantity = 1) => {
  const { pricingResult, batch } = await applyDynamicPricingToBatchService(batchId, {
    triggerSource: PRICE_CHANGE_TRIGGERS.MANUAL_RECALCULATION,
  });

  if (!pricingResult.isPurchasable || pricingResult.status === BATCH_STATUS.EXPIRED) {
    throw new ApiError(
      400,
      `Batch [${batch.batchNumber}] is [${pricingResult.status}] and cannot be purchased.`,
      'EXPIRED_OR_UNAVAILABLE_BATCH'
    );
  }

  if (batch.quantity < quantity) {
    throw new ApiError(
      400,
      `Insufficient stock in batch [${batch.batchNumber}]. Available: ${batch.quantity}, Requested: ${quantity}.`,
      'INSUFFICIENT_BATCH_STOCK'
    );
  }

  const lineOriginalTotal = Number((pricingResult.originalPrice * quantity).toFixed(2));
  const lineFinalTotal = Number((pricingResult.finalPrice * quantity).toFixed(2));
  const lineSavingsTotal = Number((lineOriginalTotal - lineFinalTotal).toFixed(2));

  return {
    batchId: batch._id,
    productId: batch.productId,
    storeId: batch.storeId,
    batchNumber: batch.batchNumber,
    expiryDate: batch.expiryDate,
    remainingDaysAtPurchase: pricingResult.remainingDays,
    statusAtPurchase: pricingResult.status,
    quantity,
    originalPrice: pricingResult.originalPrice,
    discountPercentage: pricingResult.discountPercentage,
    finalPrice: pricingResult.finalPrice,
    lineOriginalTotal,
    lineFinalTotal,
    lineSavingsTotal,
    appliedRuleId: pricingResult.appliedRuleId,
    capturedAt: new Date().toISOString(),
  };
};
