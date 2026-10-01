import mongoose from 'mongoose';

export const SECURITY_EVENT_TYPES = Object.freeze({
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILURE: 'LOGIN_FAILURE',
  LOGOUT: 'LOGOUT',
  TOKEN_INVALIDATED: 'TOKEN_INVALIDATED',
  ADMIN_REGISTRATION: 'ADMIN_REGISTRATION',
  UNAUTHORIZED_ACCESS: 'UNAUTHORIZED_ACCESS',
  RATE_LIMIT_HIT: 'RATE_LIMIT_HIT',
  QR_REVOCATION: 'QR_REVOCATION',
  PAYMENT_REFUND: 'PAYMENT_REFUND',
});

const securityLogSchema = new mongoose.Schema(
  {
    eventType: {
      type: String,
      enum: Object.values(SECURITY_EVENT_TYPES),
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
      index: true,
    },
    role: {
      type: String,
      default: null,
    },
    ipAddress: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
    path: {
      type: String,
      default: null,
    },
    method: {
      type: String,
      default: null,
    },
    statusCode: {
      type: Number,
      default: null,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'securityAuditLogs',
  }
);

securityLogSchema.index({ eventType: 1, createdAt: -1 });

export const SecurityLog = mongoose.model('SecurityLog', securityLogSchema);
