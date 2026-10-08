import mongoose from 'mongoose';

export const COMPLAINT_STATUS = Object.freeze({
  OPEN: 'OPEN',
  UNDER_REVIEW: 'UNDER_REVIEW',
  WAITING_FOR_CUSTOMER: 'WAITING_FOR_CUSTOMER',
  WAITING_FOR_SELLER: 'WAITING_FOR_SELLER',
  RESOLUTION_PENDING: 'RESOLUTION_PENDING',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
  REJECTED: 'REJECTED',
});

export const COMPLAINT_CATEGORY = Object.freeze({
  ORDER_NOT_RECEIVED: 'ORDER_NOT_RECEIVED',
  WRONG_PRODUCT: 'WRONG_PRODUCT',
  DAMAGED_PRODUCT: 'DAMAGED_PRODUCT',
  EXPIRED_OR_UNSAFE_PRODUCT: 'EXPIRED_OR_UNSAFE_PRODUCT',
  MISSING_ITEM: 'MISSING_ITEM',
  PAYMENT_PROBLEM: 'PAYMENT_PROBLEM',
  REFUND_PROBLEM: 'REFUND_PROBLEM',
  PICKUP_PROBLEM: 'PICKUP_PROBLEM',
  DELIVERY_PROBLEM: 'DELIVERY_PROBLEM',
  PRODUCT_QUALITY: 'PRODUCT_QUALITY',
  SELLER_DISPUTE: 'SELLER_DISPUTE',
  OTHER: 'OTHER',
});

export const COMPLAINT_PRIORITY = Object.freeze({
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
});

export const RESOLUTION_DECISION = Object.freeze({
  FULL_REFUND: 'FULL_REFUND',
  PARTIAL_REFUND: 'PARTIAL_REFUND',
  ORDER_CANCELLATION: 'ORDER_CANCELLATION',
  REPLACEMENT_APPROVED: 'REPLACEMENT_APPROVED',
  REJECTED_INVALID: 'REJECTED_INVALID',
  RESOLVED_WITH_EXPLANATION: 'RESOLVED_WITH_EXPLANATION',
  STORE_CREDIT: 'STORE_CREDIT',
});

export const RESOLUTION_ACTION_EXECUTION_STATUS = Object.freeze({
  NONE: 'NONE',
  PENDING: 'PENDING',
  EXECUTED: 'EXECUTED',
  FAILED: 'FAILED',
  SKIPPED: 'SKIPPED',
});

export const RESOLUTION_ACTION_TYPE = Object.freeze({
  NONE: 'NONE',
  EXECUTE_REFUND: 'EXECUTE_REFUND',
  EXECUTE_ORDER_CANCEL: 'EXECUTE_ORDER_CANCEL',
  BOTH: 'BOTH',
});

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    senderRole: {
      type: String,
      enum: ['CUSTOMER', 'ADMIN', 'SELLER'],
      required: true,
    },
    senderName: {
      type: String,
      default: '',
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    attachments: {
      type: [String],
      default: [],
    },
    isInternalNote: {
      type: Boolean,
      default: false,
      index: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const timelineSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      trim: true,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    performerRole: {
      type: String,
      required: true,
      trim: true,
    },
    performerName: {
      type: String,
      default: '',
      trim: true,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    isInternal: {
      type: Boolean,
      default: false,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const resolutionSchema = new mongoose.Schema(
  {
    decision: {
      type: String,
      enum: [...Object.values(RESOLUTION_DECISION), null],
      default: null,
    },
    notes: {
      type: String,
      default: null,
      trim: true,
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    resolvedByName: {
      type: String,
      default: null,
      trim: true,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    refundAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    actionRequested: {
      type: String,
      enum: Object.values(RESOLUTION_ACTION_TYPE),
      default: RESOLUTION_ACTION_TYPE.NONE,
    },
    actionExecutionStatus: {
      type: String,
      enum: Object.values(RESOLUTION_ACTION_EXECUTION_STATUS),
      default: RESOLUTION_ACTION_EXECUTION_STATUS.NONE,
    },
    actionExecutionResult: {
      refundId: { type: String, default: null },
      refundStatus: { type: String, default: null },
      cancellationStatus: { type: String, default: null },
      stockRestored: { type: Boolean, default: false },
      error: { type: String, default: null },
      executedAt: { type: Date, default: null },
    },
  },
  { _id: false }
);

const complaintSchema = new mongoose.Schema(
  {
    complaintNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    orderNumber: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      required: true,
      index: true,
    },
    storeName: {
      type: String,
      default: '',
      trim: true,
    },
    relatedItemId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    category: {
      type: String,
      enum: Object.values(COMPLAINT_CATEGORY),
      required: true,
      index: true,
    },
    priority: {
      type: String,
      enum: Object.values(COMPLAINT_PRIORITY),
      default: COMPLAINT_PRIORITY.MEDIUM,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(COMPLAINT_STATUS),
      default: COMPLAINT_STATUS.OPEN,
      index: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 200,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 3000,
    },
    evidenceUrls: {
      type: [String],
      default: [],
    },
    assignedAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    assignedAdminName: {
      type: String,
      default: null,
      trim: true,
    },
    messages: {
      type: [messageSchema],
      default: [],
    },
    timeline: {
      type: [timelineSchema],
      default: [],
    },
    resolution: {
      type: resolutionSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for query performance and operational dashboards
complaintSchema.index({ customerId: 1, createdAt: -1 });
complaintSchema.index({ storeId: 1, status: 1, createdAt: -1 });
complaintSchema.index({ orderId: 1, status: 1 });
complaintSchema.index({ status: 1, priority: 1, createdAt: -1 });
complaintSchema.index({ assignedAdminId: 1, status: 1 });
complaintSchema.index(
  {
    complaintNumber: 'text',
    orderNumber: 'text',
    subject: 'text',
    storeName: 'text',
  },
  {
    weights: {
      complaintNumber: 10,
      orderNumber: 8,
      subject: 5,
      storeName: 2,
    },
    name: 'ComplaintTextIndex',
  }
);

/**
 * Static method to generate collision-free, human-readable complaint numbers:
 * Format: NE-CMP-YYYYMMDD-XXXX (e.g. NE-CMP-20261008-4821)
 */
complaintSchema.statics.generateComplaintNumber = async function () {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  for (let attempt = 0; attempt < 5; attempt++) {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const candidate = `NE-CMP-${dateStr}-${randomSuffix}`;
    const existing = await this.findOne({ complaintNumber: candidate }).lean();
    if (!existing) return candidate;
  }
  return `NE-CMP-${dateStr}-${Date.now().toString().slice(-4)}`;
};

export const Complaint = mongoose.model('Complaint', complaintSchema);
export default Complaint;

