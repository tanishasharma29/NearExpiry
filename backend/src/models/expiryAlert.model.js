import mongoose from 'mongoose';

export const EXPIRY_ALERT_TYPES = Object.freeze({
  APPROACHING_EXPIRY: 'APPROACHING_EXPIRY',   // Triggered when batch enters 8–30 days window
  CRITICAL_EXPIRY: 'CRITICAL_EXPIRY',         // Triggered when batch enters 3–7 days CRITICAL window
  FINAL_48H_CRITICAL: 'FINAL_48H_CRITICAL',   // Triggered when batch enters 0–2 days urgent rescue window
  BATCH_EXPIRED: 'BATCH_EXPIRED',             // Triggered when batch crosses expiryDate (remainingDays < 0)
});

export const ALERT_SEVERITY = Object.freeze({
  WARNING: 'WARNING',
  CRITICAL: 'CRITICAL',
  EXPIRED_LOCKOUT: 'EXPIRED_LOCKOUT',
});

/**
 * ExpiryAlert Model (Collection: expiryAlerts).
 *
 * Enforces DUPLICATE-ALERT PREVENTION via a unique compound index on { batchId: 1, alertType: 1 }.
 * Even if the node-cron job runs multiple times per hour/day, a batch can only emit each
 * alertType once in its lifecycle.
 */
const expiryAlertSchema = new mongoose.Schema(
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
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    batchNumber: {
      type: String,
      required: true,
      trim: true,
    },
    alertType: {
      type: String,
      enum: Object.values(EXPIRY_ALERT_TYPES),
      required: true,
      index: true,
    },
    severity: {
      type: String,
      enum: Object.values(ALERT_SEVERITY),
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    remainingDaysAtTrigger: {
      type: Number,
      required: true,
    },
    quantityAtTrigger: {
      type: Number,
      required: true,
      min: 0,
    },
    discountPercentageApplied: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    currentPriceApplied: {
      type: Number,
      required: true,
      min: 0,
    },
    batchStatusAtTrigger: {
      type: String,
      required: true,
    },
    isAcknowledged: {
      type: Boolean,
      default: false,
      index: true,
    },
    acknowledgedAt: {
      type: Date,
      default: null,
    },
    acknowledgedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'expiryAlerts',
  }
);

// CRITICAL IDEMPOTENCY CONSTRAINT: Prevents duplicate alerts for the same (batchId, alertType)
expiryAlertSchema.index(
  { batchId: 1, alertType: 1 },
  { unique: true, name: 'uniq_batch_alertType' }
);

expiryAlertSchema.index({ storeId: 1, isAcknowledged: 1, createdAt: -1 });
expiryAlertSchema.index({ sellerId: 1, severity: 1, createdAt: -1 });

export const ExpiryAlert = mongoose.model('ExpiryAlert', expiryAlertSchema);
