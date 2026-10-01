import mongoose from 'mongoose';

export const QR_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  REVOKED: 'REVOKED',
});

const scanHistorySchema = new mongoose.Schema(
  {
    scannedAt: { type: Date, default: Date.now },
    scannedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    ipAddress: { type: String, default: 'unknown' },
    userAgent: { type: String, default: 'unknown' },
    result: { type: String, required: true }, // 'SUCCESS', 'REVOKED', 'INVALID', 'EXPIRED'
    verificationStatus: { type: String, default: null },
    notes: { type: String, default: '' },
  },
  { _id: false }
);

/**
 * QR Verification Model.
 * Manages cryptographic token registrations, revocation states, and scan audit logs.
 */
const qrVerificationSchema = new mongoose.Schema(
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
qrVerificationSchema.index({ storeId: 1, createdAt: -1 });

export const QrVerification = mongoose.model('QrVerification', qrVerificationSchema);
export default QrVerification;
