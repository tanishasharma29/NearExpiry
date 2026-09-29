import mongoose from 'mongoose';

/**
 * SchedulerExecutionLog Model (Collection: schedulerExecutionLogs).
 * Records audit telemetry for every scheduled or manual run of the Expiry-Processing Job.
 */
const schedulerLogSchema = new mongoose.Schema(
  {
    jobName: {
      type: String,
      default: 'EXPIRY_AND_DYNAMIC_PRICING_SWEEP',
      index: true,
    },
    triggerType: {
      type: String,
      enum: ['CRON_SCHEDULED', 'ADMIN_MANUAL', 'STARTUP_SYNC'],
      required: true,
    },
    referenceDate: {
      type: Date,
      required: true,
    },
    batchesScanned: {
      type: Number,
      default: 0,
    },
    batchesStatusUpdated: {
      type: Number,
      default: 0,
    },
    batchesPriceUpdated: {
      type: Number,
      default: 0,
    },
    batchesMarkedExpired: {
      type: Number,
      default: 0,
    },
    approachingAlertsGenerated: {
      type: Number,
      default: 0,
    },
    criticalAlertsGenerated: {
      type: Number,
      default: 0,
    },
    expiredAlertsGenerated: {
      type: Number,
      default: 0,
    },
    durationMs: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['SUCCESS', 'PARTIAL_ERROR', 'FAILED'],
      default: 'SUCCESS',
    },
    errorMessages: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'schedulerExecutionLogs',
  }
);

schedulerLogSchema.index({ createdAt: -1 });

export const SchedulerExecutionLog = mongoose.model('SchedulerExecutionLog', schedulerLogSchema);
