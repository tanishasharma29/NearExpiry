import mongoose from 'mongoose';

export const NOTIFICATION_TYPES = Object.freeze({
  // Seller notification types
  APPROACHING_EXPIRY: 'APPROACHING_EXPIRY',
  CRITICAL_EXPIRY: 'CRITICAL_EXPIRY',
  EXPIRED_INVENTORY: 'EXPIRED_INVENTORY',
  LOW_STOCK: 'LOW_STOCK',
  NEW_ORDER: 'NEW_ORDER',

  // Customer notification types
  ORDER_CONFIRMED: 'ORDER_CONFIRMED',
  ORDER_STATUS_UPDATE: 'ORDER_STATUS_UPDATE',
  WISHLIST_DISCOUNT: 'WISHLIST_DISCOUNT',
  WISHLIST_AVAILABILITY: 'WISHLIST_AVAILABILITY',
  PICKUP_READINESS: 'PICKUP_READINESS',

  // Administrative / System alerts
  SYSTEM_ALERT: 'SYSTEM_ALERT',
});

export const NOTIFICATION_CHANNELS = Object.freeze({
  IN_APP: 'IN_APP',
  EMAIL: 'EMAIL',
  REALTIME: 'REALTIME',
  QUEUE: 'QUEUE',
});

export const EMAIL_STATUS = Object.freeze({
  PENDING: 'PENDING',
  SENT: 'SENT',
  FAILED: 'FAILED',
  SKIPPED: 'SKIPPED',
});

/**
 * Notification Mongoose Schema.
 * In-app notification inbox with email delivery tracking and deduplication keys.
 */
const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Recipient User ID is required'],
      index: true,
    },
    recipientEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    recipientRole: {
      type: String,
      enum: ['CUSTOMER', 'SELLER', 'ADMIN'],
      required: true,
    },
    type: {
      type: String,
      enum: Object.values(NOTIFICATION_TYPES),
      required: [true, 'Notification type is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true,
      maxlength: 200,
    },
    message: {
      type: String,
      required: [true, 'Notification message is required'],
      trim: true,
      maxlength: 2000,
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    dedupKey: {
      type: String,
      sparse: true,
      unique: true,
      index: true,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
    channels: {
      type: [String],
      enum: Object.values(NOTIFICATION_CHANNELS),
      default: [NOTIFICATION_CHANNELS.IN_APP, NOTIFICATION_CHANNELS.EMAIL],
    },
    emailDelivery: {
      status: {
        type: String,
        enum: Object.values(EMAIL_STATUS),
        default: EMAIL_STATUS.PENDING,
      },
      sentAt: { type: Date, default: null },
      messageId: { type: String, default: null },
      error: { type: String, default: null },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, type: 1, createdAt: -1 });

export const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
