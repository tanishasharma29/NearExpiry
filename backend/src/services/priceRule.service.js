import mongoose from 'mongoose';
import { PriceRule } from '../models/priceRule.model.js';
import { PRICE_CHANGE_TRIGGERS } from '../models/priceAudit.model.js';
import { ApiError } from '../utils/ApiError.js';
import { recalculateAllBatchesPricingService } from './pricing.service.js';

/**
 * Initial Configurable Pricing Tiers seeded into MongoDB if priceRules collection is empty.
 * Admin can modify or replace these in the database at any time via REST API.
 */
export const INITIAL_SEED_PRICE_RULES = [
  { name: '61+ Days (Standard Shelf Life)', minDays: 61, maxDays: null, discountPercentage: 0, priority: 1 },
  { name: '31–60 Days (Early Saver)',       minDays: 31, maxDays: 60,   discountPercentage: 10, priority: 1 },
  { name: '16–30 Days (Smart Value)',       minDays: 16, maxDays: 30,   discountPercentage: 25, priority: 1 },
  { name: '8–15 Days (Half-Life Clearance)',minDays: 8,  maxDays: 15,   discountPercentage: 40, priority: 1 },
  { name: '3–7 Days (Urgent Flash)',        minDays: 3,  maxDays: 7,    discountPercentage: 60, priority: 1 },
  { name: '0–2 Days (Final 48h Rescue)',    minDays: 0,  maxDays: 2,    discountPercentage: 75, priority: 1 },
];

/**
 * Seeds the initial 6 priceRules into MongoDB if no rules exist yet.
 */
export const ensureDefaultPriceRulesSeeded = async () => {
  const existingCount = await PriceRule.countDocuments();
  if (existingCount === 0) {
    await PriceRule.insertMany(INITIAL_SEED_PRICE_RULES);
    console.log('[PricingEngine] Seeded 6 default dynamic priceRules into MongoDB.');
  }
};

/**
 * Validates that a new/updated PriceRule does not overlap with another active rule
 * in the same scope (same categoryId or global).
 */
const assertNoOverlappingActiveRule = async ({
  minDays,
  maxDays,
  categoryId = null,
  excludeRuleId = null,
}) => {
  const effectiveMax = maxDays === null || maxDays === undefined ? Number.MAX_SAFE_INTEGER : maxDays;

  const existingRules = await PriceRule.find({
    isActive: true,
    categoryId: categoryId || null,
    ...(excludeRuleId && { _id: { $ne: excludeRuleId } }),
  });

  for (const rule of existingRules) {
    const ruleMax =
      rule.maxDays === null || rule.maxDays === undefined ? Number.MAX_SAFE_INTEGER : rule.maxDays;

    const overlaps = minDays <= ruleMax && effectiveMax >= rule.minDays;
    if (overlaps) {
      throw new ApiError(
        409,
        `Day range [${minDays}..${maxDays ?? '∞'}] overlaps with existing active rule [${rule.name}] (${rule.minDays}..${rule.maxDays ?? '∞'} days).`,
        'OVERLAPPING_PRICE_RULE'
      );
    }
  }
};

/**
 * List all PriceRules from MongoDB sorted by minDays DESC.
 */
export const listPriceRulesService = async (query = {}) => {
  await ensureDefaultPriceRulesSeeded();

  const filter = {};
  if (query.isActive !== undefined) {
    filter.isActive = query.isActive === 'true' || query.isActive === true;
  }
  if (query.categoryId) {
    filter.categoryId = query.categoryId;
  }

  return PriceRule.find(filter)
    .populate('categoryId', 'name slug')
    .sort({ categoryId: 1, minDays: -1 });
};

/**
 * Admin: Create a new PriceRule in MongoDB & recalculate affected batches.
 */
export const createPriceRuleService = async (adminUserId, payload) => {
  if (payload.isActive !== false) {
    await assertNoOverlappingActiveRule({
      minDays: payload.minDays,
      maxDays: payload.maxDays,
      categoryId: payload.categoryId || null,
    });
  }

  const rule = await PriceRule.create({
    name: payload.name,
    minDays: payload.minDays,
    maxDays: payload.maxDays ?? null,
    discountPercentage: payload.discountPercentage,
    categoryId: payload.categoryId || null,
    priority: payload.priority || (payload.categoryId ? 10 : 1),
    isActive: payload.isActive ?? true,
    updatedBy: adminUserId,
  });

  // Automatically recalculate all batches to reflect the new rule
  const recalculationSummary = await recalculateAllBatchesPricingService({
    triggerSource: PRICE_CHANGE_TRIGGERS.ADMIN_RULE_UPDATED,
    triggeredBy: adminUserId,
  });

  return {
    rule,
    recalculationSummary: {
      totalBatchesEvaluated: recalculationSummary.totalBatchesEvaluated,
      batchesUpdated: recalculationSummary.batchesUpdated,
    },
  };
};

/**
 * Admin: Update an existing PriceRule & automatically recalculate affected batches.
 */
export const updatePriceRuleService = async (ruleId, adminUserId, payload) => {
  if (!mongoose.Types.ObjectId.isValid(ruleId)) {
    throw new ApiError(400, 'Invalid PriceRule ID format.', 'INVALID_RULE_ID');
  }

  const rule = await PriceRule.findById(ruleId);
  if (!rule) {
    throw new ApiError(404, 'PriceRule not found.', 'PRICE_RULE_NOT_FOUND');
  }

  const nextMinDays = payload.minDays !== undefined ? payload.minDays : rule.minDays;
  const nextMaxDays = payload.maxDays !== undefined ? payload.maxDays : rule.maxDays;
  const nextCategoryId = payload.categoryId !== undefined ? payload.categoryId : rule.categoryId;
  const nextIsActive = payload.isActive !== undefined ? payload.isActive : rule.isActive;

  if (nextMaxDays !== null && nextMaxDays < nextMinDays) {
    throw new ApiError(400, 'maxDays must be >= minDays.', 'INVALID_DAY_RANGE');
  }

  if (nextIsActive) {
    await assertNoOverlappingActiveRule({
      minDays: nextMinDays,
      maxDays: nextMaxDays,
      categoryId: nextCategoryId,
      excludeRuleId: rule._id,
    });
  }

  if (payload.name !== undefined) rule.name = payload.name;
  rule.minDays = nextMinDays;
  rule.maxDays = nextMaxDays;
  if (payload.discountPercentage !== undefined) {
    rule.discountPercentage = payload.discountPercentage;
  }
  rule.categoryId = nextCategoryId;
  if (payload.priority !== undefined) rule.priority = payload.priority;
  rule.isActive = nextIsActive;
  rule.updatedBy = adminUserId;

  await rule.save();

  // Automatically recalculate all batches and log price changes
  const recalculationSummary = await recalculateAllBatchesPricingService({
    triggerSource: PRICE_CHANGE_TRIGGERS.ADMIN_RULE_UPDATED,
    triggeredBy: adminUserId,
  });

  return {
    rule,
    recalculationSummary: {
      totalBatchesEvaluated: recalculationSummary.totalBatchesEvaluated,
      batchesUpdated: recalculationSummary.batchesUpdated,
    },
  };
};

/**
 * Admin: Delete a PriceRule & recalculate batches.
 */
export const deletePriceRuleService = async (ruleId, adminUserId) => {
  if (!mongoose.Types.ObjectId.isValid(ruleId)) {
    throw new ApiError(400, 'Invalid PriceRule ID format.', 'INVALID_RULE_ID');
  }

  const rule = await PriceRule.findByIdAndDelete(ruleId);
  if (!rule) {
    throw new ApiError(404, 'PriceRule not found.', 'PRICE_RULE_NOT_FOUND');
  }

  const recalculationSummary = await recalculateAllBatchesPricingService({
    triggerSource: PRICE_CHANGE_TRIGGERS.ADMIN_RULE_UPDATED,
    triggeredBy: adminUserId,
  });

  return {
    deletedRuleId: ruleId,
    recalculationSummary: {
      totalBatchesEvaluated: recalculationSummary.totalBatchesEvaluated,
      batchesUpdated: recalculationSummary.batchesUpdated,
    },
  };
};

/**
 * Admin: Reset / Seed the default 6-tier PriceRules in MongoDB.
 */
export const resetDefaultPriceRulesService = async (adminUserId) => {
  await PriceRule.deleteMany({ categoryId: null });
  const seededRules = await PriceRule.insertMany(
    INITIAL_SEED_PRICE_RULES.map((r) => ({ ...r, updatedBy: adminUserId }))
  );

  const recalculationSummary = await recalculateAllBatchesPricingService({
    triggerSource: PRICE_CHANGE_TRIGGERS.ADMIN_RULE_UPDATED,
    triggeredBy: adminUserId,
  });

  return {
    rules: seededRules,
    recalculationSummary: {
      totalBatchesEvaluated: recalculationSummary.totalBatchesEvaluated,
      batchesUpdated: recalculationSummary.batchesUpdated,
    },
  };
};
