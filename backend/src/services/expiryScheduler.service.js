import { Batch, BATCH_STATUS } from '../models/batch.model.js';
import { Product } from '../models/product.model.js';
import { PriceRule } from '../models/priceRule.model.js';
import { PriceAuditLog, PRICE_CHANGE_TRIGGERS } from '../models/priceAudit.model.js';
import { InventoryAudit, INVENTORY_ACTION_TYPES } from '../models/inventory.model.js';
import {
  ExpiryAlert,
  EXPIRY_ALERT_TYPES,
  ALERT_SEVERITY,
} from '../models/expiryAlert.model.js';
import { SchedulerExecutionLog } from '../models/schedulerLog.model.js';
import { ensureDefaultPriceRulesSeeded } from './priceRule.service.js';
import { evaluateDynamicPricingAlgorithm } from './pricing.service.js';
import { calculateRemainingDays } from '../utils/shelfLife.js';
import { Wishlist } from '../models/wishlist.model.js';
import {
  notifySellerApproachingExpiry,
  notifySellerCriticalExpiry,
  notifySellerExpiredInventory,
  notifyCustomerWishlistDiscount,
} from './notification.service.js';

// In-process concurrency lock to guarantee idempotent, non-overlapping runs
let isJobCurrentlyRunning = false;

/**
 * Determines which alert stages apply to a batch based on its remainingDays and status,
 * and inserts them idempotently using { batchId, alertType } unique constraint ($setOnInsert).
 *
 * Returns counters of newly created alerts (0 if alert was already created on an earlier run).
 */
const generateIdempotentExpiryAlertsForBatch = async ({
  batch,
  productName,
  remainingDays,
  status,
  discountPercentage,
  finalPrice,
}) => {
  const alertsToEnsure = [];

  if (remainingDays < 0 || status === BATCH_STATUS.EXPIRED) {
    alertsToEnsure.push({
      alertType: EXPIRY_ALERT_TYPES.BATCH_EXPIRED,
      severity: ALERT_SEVERITY.EXPIRED_LOCKOUT,
      title: `Batch Expired & Delisted: ${batch.batchNumber}`,
      message: `Batch [${batch.batchNumber}] of "${productName}" has crossed its expiry date (${batch.expiryDate
        .toISOString()
        .slice(0, 10)}). It has been marked EXPIRED and locked from purchase.`,
    });
  } else if (remainingDays >= 0 && remainingDays <= 2 && batch.quantity > 0) {
    // Both CRITICAL_EXPIRY and FINAL_48H_CRITICAL apply
    alertsToEnsure.push({
      alertType: EXPIRY_ALERT_TYPES.CRITICAL_EXPIRY,
      severity: ALERT_SEVERITY.CRITICAL,
      title: `Critical Expiry Window (<= 7 Days): ${batch.batchNumber}`,
      message: `Batch [${batch.batchNumber}] of "${productName}" has ${remainingDays} day(s) left. Discount automatically updated to ${discountPercentage}% (₹${finalPrice}).`,
    });
    alertsToEnsure.push({
      alertType: EXPIRY_ALERT_TYPES.FINAL_48H_CRITICAL,
      severity: ALERT_SEVERITY.CRITICAL,
      title: `URGENT 48-Hour Final Clearance: ${batch.batchNumber}`,
      message: `Batch [${batch.batchNumber}] of "${productName}" has only ${remainingDays} day(s) remaining (${batch.quantity} units unsold). Maximum rescue discount (${discountPercentage}% OFF -> ₹${finalPrice}) is active.`,
    });
  } else if (remainingDays >= 3 && remainingDays <= 7 && batch.quantity > 0) {
    alertsToEnsure.push({
      alertType: EXPIRY_ALERT_TYPES.CRITICAL_EXPIRY,
      severity: ALERT_SEVERITY.CRITICAL,
      title: `Critical Expiry Window (${remainingDays} Days Left): ${batch.batchNumber}`,
      message: `Batch [${batch.batchNumber}] of "${productName}" entered CRITICAL status (${remainingDays} days remaining, ${batch.quantity} units). Discount updated to ${discountPercentage}% (₹${finalPrice}).`,
    });
  } else if (remainingDays >= 8 && remainingDays <= 30 && batch.quantity > 0) {
    alertsToEnsure.push({
      alertType: EXPIRY_ALERT_TYPES.APPROACHING_EXPIRY,
      severity: ALERT_SEVERITY.WARNING,
      title: `Approaching Expiry (${remainingDays} Days Left): ${batch.batchNumber}`,
      message: `Batch [${batch.batchNumber}] of "${productName}" is approaching expiry (${remainingDays} days left). Dynamic discount is now ${discountPercentage}% (₹${finalPrice}).`,
    });
  }

  let approachingCreated = 0;
  let criticalCreated = 0;
  let expiredCreated = 0;

  for (const candidate of alertsToEnsure) {
    const rawResult = await ExpiryAlert.findOneAndUpdate(
      {
        batchId: batch._id,
        alertType: candidate.alertType,
      },
      {
        $setOnInsert: {
          batchId: batch._id,
          productId: batch.productId,
          storeId: batch.storeId,
          sellerId: batch.sellerId,
          batchNumber: batch.batchNumber,
          alertType: candidate.alertType,
          severity: candidate.severity,
          title: candidate.title,
          message: candidate.message,
          remainingDaysAtTrigger: remainingDays,
          quantityAtTrigger: batch.quantity,
          discountPercentageApplied: discountPercentage,
          currentPriceApplied: finalPrice,
          batchStatusAtTrigger: status,
          isAcknowledged: false,
        },
      },
      {
        upsert: true,
        new: true,
        includeResultMetadata: true,
      }
    );

    const wasInserted = Boolean(rawResult?.lastErrorObject?.upserted);
    if (wasInserted) {
      if (candidate.alertType === EXPIRY_ALERT_TYPES.APPROACHING_EXPIRY) {
        approachingCreated += 1;
        notifySellerApproachingExpiry({
          sellerId: batch.sellerId,
          batch,
          product: { _id: batch.productId, name: productName },
          store: { _id: batch.storeId, storeName: 'NearExpiry Store' },
          remainingDays,
          discountPercentage,
          currentPrice: finalPrice,
        }).catch((err) => console.error('[Notification] Approaching expiry error:', err));
      } else if (
        candidate.alertType === EXPIRY_ALERT_TYPES.CRITICAL_EXPIRY ||
        candidate.alertType === EXPIRY_ALERT_TYPES.FINAL_48H_CRITICAL
      ) {
        criticalCreated += 1;
        notifySellerCriticalExpiry({
          sellerId: batch.sellerId,
          batch,
          product: { _id: batch.productId, name: productName },
          store: { _id: batch.storeId, storeName: 'NearExpiry Store' },
          remainingDays,
          discountPercentage,
          currentPrice: finalPrice,
        }).catch((err) => console.error('[Notification] Critical expiry error:', err));
      } else if (candidate.alertType === EXPIRY_ALERT_TYPES.BATCH_EXPIRED) {
        expiredCreated += 1;
        notifySellerExpiredInventory({
          sellerId: batch.sellerId,
          batch,
          product: { _id: batch.productId, name: productName },
          store: { _id: batch.storeId, storeName: 'NearExpiry Store' },
        }).catch((err) => console.error('[Notification] Expired inventory error:', err));
      }
    }
  }

  return {
    approachingCreated,
    criticalCreated,
    expiredCreated,
  };
};

/**
 * Authoritative Expiry-Processing & Dynamic Pricing Job.
 *
 * Performs all 9 core steps idempotently:
 * 1. Finds all candidate batches in MongoDB.
 * 2. Calculates timezone-safe remainingDays.
 * 3. Determines expiry status (NORMAL, APPROACHING_EXPIRY, CRITICAL, EXPIRED, OUT_OF_STOCK).
 * 4. Evaluates database PriceRules (pre-loaded in memory for O(1) lookup).
 * 5. Updates currentPrice & discountPercentage and logs PriceAuditLog on change.
 * 6. Marks expired batches (status = EXPIRED) & logs EXPIRED_WRITE_OFF in InventoryAudit.
 * 7. Prevents expired inventory from being sold (isPurchasable = false).
 * 8. Generates APPROACHING_EXPIRY & BATCH_EXPIRED alerts (with duplicate prevention).
 * 9. Generates CRITICAL_EXPIRY & FINAL_48H_CRITICAL alerts (with duplicate prevention).
 */
export const runExpiryProcessingJob = async ({
  triggerType = 'CRON_SCHEDULED',
  referenceDate = new Date(),
  triggeredBy = null,
} = {}) => {
  if (isJobCurrentlyRunning) {
    console.warn('[ExpiryScheduler] Job is already running. Skipping overlapping invocation.');
    return {
      skipped: true,
      message: 'Expiry processing job is already in progress.',
    };
  }

  isJobCurrentlyRunning = true;
  const startTime = Date.now();
  const refDate = new Date(referenceDate);

  const metrics = {
    triggerType,
    referenceDate: refDate.toISOString(),
    batchesScanned: 0,
    batchesStatusUpdated: 0,
    batchesPriceUpdated: 0,
    batchesMarkedExpired: 0,
    approachingAlertsGenerated: 0,
    criticalAlertsGenerated: 0,
    expiredAlertsGenerated: 0,
    durationMs: 0,
    status: 'SUCCESS',
    errorMessages: [],
  };

  try {
    // Step 0: Ensure default PriceRules exist in DB and load all active rules once
    await ensureDefaultPriceRulesSeeded();
    const activePriceRules = await PriceRule.find({ isActive: true }).lean();

    // Step 1: Efficiently query batches that are either non-expired OR still marked isPurchasable
    const candidateBatches = await Batch.find({
      $or: [
        { status: { $ne: BATCH_STATUS.EXPIRED } },
        { isPurchasable: true },
        { remainingDays: { $gte: 0 } },
      ],
    });

    metrics.batchesScanned = candidateBatches.length;

    // Pre-fetch Product names & categoryIds in one batch $in query to avoid N+1 queries
    const productIds = [...new Set(candidateBatches.map((b) => b.productId.toString()))];
    const products = await Product.find({ _id: { $in: productIds } })
      .select('name category')
      .lean();
    const productMap = new Map(products.map((p) => [p._id.toString(), p]));

    const bulkBatchOps = [];
    const priceAuditDocs = [];
    const inventoryAuditDocs = [];

    for (const batch of candidateBatches) {
      try {
        const productInfo = productMap.get(batch.productId.toString());
        const productName = productInfo?.name || 'Product';
        const categoryId = productInfo?.category || null;

        // Step 2: Calculate timezone-safe remainingDays
        const remainingDays = calculateRemainingDays(batch.expiryDate, refDate);

        // Step 3 & 4: Determine expiry status and apply database PriceRules
        const pricingResult = evaluateDynamicPricingAlgorithm({
          originalPrice: batch.originalPrice,
          remainingDays,
          quantity: batch.quantity,
          rules: activePriceRules,
          categoryId,
        });

        const prevStatus = batch.status;
        const prevPrice = batch.currentPrice;
        const prevDiscount = batch.discountPercentage ?? 0;
        const prevRemainingDays = batch.remainingDays;
        const prevPurchasable = batch.isPurchasable;

        const nextStatus = pricingResult.status;
        const nextPrice = pricingResult.finalPrice;
        const nextDiscount = pricingResult.discountPercentage;
        const nextPurchasable = pricingResult.isPurchasable;

        const statusChanged = prevStatus !== nextStatus;
        const priceChanged = prevPrice !== nextPrice || prevDiscount !== nextDiscount;
        const daysChanged = prevRemainingDays !== remainingDays;
        const purchasableChanged = prevPurchasable !== nextPurchasable;

        if (statusChanged) {
          metrics.batchesStatusUpdated += 1;
        }
        if (priceChanged) {
          metrics.batchesPriceUpdated += 1;
        }
        if (nextStatus === BATCH_STATUS.EXPIRED && prevStatus !== BATCH_STATUS.EXPIRED) {
          metrics.batchesMarkedExpired += 1;

          // Step 6 & 7: Record EXPIRED_WRITE_OFF in InventoryAudit when an active batch expires
          if (batch.quantity > 0 || batch.reservedQuantity > 0) {
            inventoryAuditDocs.push({
              batchId: batch._id,
              productId: batch.productId,
              storeId: batch.storeId,
              batchNumber: batch.batchNumber,
              actionType: INVENTORY_ACTION_TYPES.EXPIRED_WRITE_OFF,
              quantityChange: -batch.quantity,
              previousQuantity: batch.quantity,
              newQuantity: batch.quantity,
              previousReserved: batch.reservedQuantity,
              newReserved: 0,
              batchStatusAfter: BATCH_STATUS.EXPIRED,
              reason: `Automated scheduler marked batch EXPIRED (expiryDate: ${batch.expiryDate
                .toISOString()
                .slice(0, 10)}) and locked remaining stock from sale`,
              performedBy: triggeredBy || batch.sellerId,
              performedByRole: triggeredBy ? 'ADMIN' : 'SYSTEM_CRON',
            });
          }
        }

        // Step 5: Queue bulk update only if any state or price changed (Idempotency!)
        if (statusChanged || priceChanged || daysChanged || purchasableChanged) {
          bulkBatchOps.push({
            updateOne: {
              filter: { _id: batch._id },
              update: {
                $set: {
                  remainingDays,
                  status: nextStatus,
                  discountPercentage: nextDiscount,
                  currentPrice: nextPrice,
                  appliedPriceRuleId: pricingResult.appliedRuleId,
                  isPurchasable: nextPurchasable,
                  ...(nextStatus === BATCH_STATUS.EXPIRED && { reservedQuantity: 0 }),
                },
              },
            },
          });
        }

        if (priceChanged) {
          priceAuditDocs.push({
            batchId: batch._id,
            productId: batch.productId,
            storeId: batch.storeId,
            batchNumber: batch.batchNumber,
            originalPrice: batch.originalPrice,
            remainingDays,
            previousDiscountPercentage: prevDiscount,
            newDiscountPercentage: nextDiscount,
            previousFinalPrice: prevPrice,
            newFinalPrice: nextPrice,
            batchStatus: nextStatus,
            appliedRuleId: pricingResult.appliedRuleId,
            appliedRuleName: pricingResult.appliedRuleName,
            triggerSource:
              triggerType === 'CRON_SCHEDULED'
                ? PRICE_CHANGE_TRIGGERS.SCHEDULED_CRON_SWEEP
                : PRICE_CHANGE_TRIGGERS.MANUAL_RECALCULATION,
            triggeredBy,
          });

          // Check for Wishlist customers who set alert thresholds for this product
          if (nextDiscount > prevDiscount) {
            Wishlist.find({
              productId: batch.productId,
              targetDiscountPercentage: { $lte: nextDiscount },
            })
              .lean()
              .then((wishlists) => {
                for (const w of wishlists) {
                  notifyCustomerWishlistDiscount({
                    customerId: w.userId,
                    product: { _id: batch.productId, name: productName },
                    discountPercentage: nextDiscount,
                    currentPrice: nextPrice,
                    store: { _id: batch.storeId, storeName: 'NearExpiry Partner Store' },
                  }).catch((err) => console.error('[Notification] Wishlist discount notify error:', err));
                }
              })
              .catch((err) => console.error('[Notification] Wishlist query error:', err));
          }
        }

        // Step 8 & 9: Generate Expiry & Critical Alerts (Idempotent via unique index)
        const alertCounts = await generateIdempotentExpiryAlertsForBatch({
          batch,
          productName,
          remainingDays,
          status: nextStatus,
          discountPercentage: nextDiscount,
          finalPrice: nextPrice,
        });

        metrics.approachingAlertsGenerated += alertCounts.approachingCreated;
        metrics.criticalAlertsGenerated += alertCounts.criticalCreated;
        metrics.expiredAlertsGenerated += alertCounts.expiredCreated;
      } catch (batchErr) {
        metrics.status = 'PARTIAL_ERROR';
        metrics.errorMessages.push(
          `Batch [${batch.batchNumber || batch._id}]: ${batchErr.message}`
        );
      }
    }

    // Execute batched database writes in bulk
    if (bulkBatchOps.length > 0) {
      await Batch.bulkWrite(bulkBatchOps, { ordered: false });
    }
    if (priceAuditDocs.length > 0) {
      await PriceAuditLog.insertMany(priceAuditDocs, { ordered: false });
    }
    if (inventoryAuditDocs.length > 0) {
      await InventoryAudit.insertMany(inventoryAuditDocs, { ordered: false });
    }
  } catch (fatalErr) {
    metrics.status = 'FAILED';
    metrics.errorMessages.push(fatalErr.message);
    console.error('[ExpiryScheduler] Job execution failed:', fatalErr.message);
  } finally {
    metrics.durationMs = Date.now() - startTime;
    isJobCurrentlyRunning = false;

    try {
      const logDoc = await SchedulerExecutionLog.create(metrics);
      metrics.executionLogId = logDoc._id;
      metrics.batchesProcessed = metrics.batchesScanned;
    } catch (logErr) {
      console.error('[ExpiryScheduler] Failed to write SchedulerExecutionLog:', logErr.message);
    }
  }

  console.log(
    `[ExpiryScheduler] Completed [${metrics.triggerType}] in ${metrics.durationMs}ms | Scanned: ${metrics.batchesScanned} | StatusChanged: ${metrics.batchesStatusUpdated} | PriceChanged: ${metrics.batchesPriceUpdated} | MarkedExpired: ${metrics.batchesMarkedExpired} | Alerts(Appr/Crit/Exp): ${metrics.approachingAlertsGenerated}/${metrics.criticalAlertsGenerated}/${metrics.expiredAlertsGenerated}`
  );

  return metrics;
};

/**
 * List Expiry & Critical Alerts for Seller (own store) or Admin (all stores).
 */
export const listExpiryAlertsService = async (query = {}, requesterUser) => {
  const page = Math.max(parseInt(query.page || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(query.limit || '25', 10), 1), 100);
  const skip = (page - 1) * limit;

  const filter = {};
  if (requesterUser.role === 'SELLER') {
    filter.sellerId = requesterUser._id;
  } else if (query.storeId) {
    filter.storeId = query.storeId;
  }

  if (query.alertType) filter.alertType = query.alertType;
  if (query.severity) filter.severity = query.severity;
  if (query.isAcknowledged !== undefined) {
    filter.isAcknowledged = query.isAcknowledged === 'true' || query.isAcknowledged === true;
  }
  if (query.batchId) filter.batchId = query.batchId;

  const [alerts, total] = await Promise.all([
    ExpiryAlert.find(filter)
      .populate('productId', 'name brand unit image')
      .populate('storeId', 'storeName slug')
      .populate('batchId', 'batchNumber expiryDate remainingDays quantity currentPrice status isPurchasable')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    ExpiryAlert.countDocuments(filter),
  ]);

  return {
    alerts,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * Acknowledge an ExpiryAlert (Seller for own alert, or Admin).
 */
export const acknowledgeExpiryAlertService = async (alertId, requesterUser) => {
  const alert = await ExpiryAlert.findById(alertId);
  if (!alert) {
    throw new Error('Expiry alert not found');
  }

  if (
    requesterUser.role === 'SELLER' &&
    alert.sellerId.toString() !== requesterUser._id.toString()
  ) {
    throw new Error('Forbidden: You can only acknowledge alerts belonging to your store');
  }

  alert.isAcknowledged = true;
  alert.acknowledgedAt = new Date();
  alert.acknowledgedBy = requesterUser._id;
  await alert.save();

  return alert;
};

/**
 * List historical SchedulerExecutionLogs for Admin observability.
 */
export const listSchedulerLogsService = async (limit = 20) => {
  return SchedulerExecutionLog.find()
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(limit) || 20, 100));
};
