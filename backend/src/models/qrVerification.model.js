import mongoose from 'mongoose';

export const QR_TYPE = Object.freeze({
  BATCH: 'BATCH',
  PICKUP: 'PICKUP',
});

export const QR_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  USED: 'USED',
  EXPIRED: 'EXPIRED',
  REVOKED: 'REVOKED',
});

const scanHistorySchema = new mongoose.Schema(
  {
    scannedAt: { type: Date, default: Date.now },
    scannedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    ipAddress: { type: String, default: 'unknown' },
    userAgent: { type: String, default: 'unknown' },
    result: { type: String, required: true }, // 'SUCCESS', 'REVOKED', 'INVALID', 'EXPIRED', 'ALREADY_USED', 'STORE_MISMATCH', 'NOT_READY'
    verificationStatus: { type: String, default: null },
    notes: { type: String, default: '' },
  },
  { _id: false }
);

/**
 * QR Verification Model.
 * Manages cryptographic token registrations, revocation states, and scan audit logs
 * for both FEFO Batch lots and Customer Self-Pickup Orders.
 */
const qrVerificationSchema = new mongoose.Schema(
  {
    qrType: {
      type: String,
      enum: Object.values(QR_TYPE),
      default: QR_TYPE.BATCH,
      index: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    batchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Batch',
      default: null,
      index: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      default: null,
      index: true,
    },
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      required: true,
      index: true,
    },
    tokenNonce: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(QR_STATUS),
      default: QR_STATUS.ACTIVE,
      index: true,
    },
    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },
    generatedAt: {
      type: Date,
      default: Date.now,
    },
    usedAt: {
      type: Date,
      default: null,
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    revokedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    revokedReason: {
      type: String,
      default: null,
    },
    scanHistory: {
      type: [scanHistorySchema],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

qrVerificationSchema.index({ batchId: 1, status: 1 });
qrVerificationSchema.index({ orderId: 1, qrType: 1, status: 1 });
qrVerificationSchema.index({ storeId: 1, createdAt: -1 });

export const QrVerification = mongoose.model('QrVerification', qrVerificationSchema);
export default QrVerification;
