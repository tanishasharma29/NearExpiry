import mongoose from 'mongoose';

export const PRICE_CHANGE_TRIGGERS = Object.freeze({
  BATCH_CREATED: 'BATCH_CREATED',
  ADMIN_RULE_UPDATED: 'ADMIN_RULE_UPDATED',
  SCHEDULED_CRON_SWEEP: 'SCHEDULED_CRON_SWEEP',
  MANUAL_RECALCULATION: 'MANUAL_RECALCULATION',
});

/**
 * Immutable Price Audit Log Model (Collection: priceAuditLogs).
 * Tracks every dynamic price calculation and change on any Batch.
 */
const priceAuditSchema = new mongoose.Schema(
  {
    batchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Batch',
      required: true,
      index: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      required: true,
      index: true,
    },
    batchNumber: {
      type: String,
      required: true,
      trim: true,
    },
    originalPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    remainingDays: {
      type: Number,
      required: true,
    },
    previousDiscountPercentage: {
      type: Number,
      required: true,
      default: 0,
    },
    newDiscountPercentage: {
      type: Number,
      required: true,
    },
    previousFinalPrice: {
      type: Number,
      required: true,
    },
    newFinalPrice: {
      type: Number,
      required: true,
    },
    batchStatus: {
      type: String,
      required: true,
    },
    appliedRuleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PriceRule',
      default: null,
    },
    appliedRuleName: {
      type: String,
      default: null,
    },
    triggerSource: {
      type: String,
      enum: Object.values(PRICE_CHANGE_TRIGGERS),
      required: true,
    },
    triggeredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'priceAuditLogs',
  }
);

priceAuditSchema.index({ batchId: 1, createdAt: -1 });
priceAuditSchema.index({ storeId: 1, createdAt: -1 });

export const PriceAuditLog = mongoose.model('PriceAuditLog', priceAuditSchema);
