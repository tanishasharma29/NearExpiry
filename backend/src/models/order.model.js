import mongoose from 'mongoose';

export const ORDER_STATUS = Object.freeze({
  PLACED: 'PLACED',
  CONFIRMED: 'CONFIRMED',
  PACKED: 'PACKED',
  READY_FOR_PICKUP: 'READY_FOR_PICKUP',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
});

export const FULFILLMENT_TYPES = Object.freeze({
  PICKUP: 'PICKUP',
  LOCAL_DELIVERY: 'LOCAL_DELIVERY',
});

const batchAllocationSchema = new mongoose.Schema(
  {
    batchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Batch',
      required: true,
    },
    batchNumber: {
      type: String,
      required: true,
      trim: true,
    },
    manufacturingDate: {
      type: Date,
      required: true,
    },
    expiryDate: {
      type: Date,
      required: true,
    },
    remainingDays: {
      type: Number,
      required: true,
    },
    allocatedQuantity: {
      type: Number,
      required: true,
      min: 1,
    },
    originalUnitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    discountedUnitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    discountPercent: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    urgencyTier: {
      type: String,
      default: 'NORMAL',
    },
    lineOriginalPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    lineFinalPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    savings: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: true }
);

const orderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    productName: {
      type: String,
      required: true,
      trim: true,
    },
    brand: {
      type: String,
      default: '',
      trim: true,
    },
    productImage: {
      type: String,
      default: '',
    },
    unit: {
      type: String,
      default: 'pcs',
    },
    requestedQuantity: {
      type: Number,
      required: true,
      min: 1,
    },
    blendedUnitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    lineOriginalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    lineDiscountedAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    lineSavingsAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    batchAllocations: [batchAllocationSchema],
  },
  { _id: true }
);

const statusTimelineSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: Object.values(ORDER_STATUS),
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedByRole: {
      type: String,
      required: true,
    },
    note: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      required: true,
      index: true,
    },
    items: [orderItemSchema],
    pricingSummary: {
      subtotal: { type: Number, required: true, min: 0 },
      discounts: { type: Number, required: true, min: 0 },
      deliveryFee: { type: Number, default: 0, min: 0 },
      finalTotal: { type: Number, required: true, min: 0 },
      totalUnits: { type: Number, required: true, min: 1 },
      itemCount: { type: Number, required: true, min: 1 },
    },
    fulfillmentType: {
      type: String,
      enum: Object.values(FULFILLMENT_TYPES),
      default: FULFILLMENT_TYPES.PICKUP,
    },
    deliveryAddress: {
      recipientName: { type: String, trim: true, default: '' },
      contactPhone: { type: String, trim: true, default: '' },
      street: { type: String, trim: true, default: '' },
      city: { type: String, trim: true, default: '' },
      state: { type: String, trim: true, default: '' },
      pincode: { type: String, trim: true, default: '' },
    },
    status: {
      type: String,
      enum: Object.values(ORDER_STATUS),
      default: ORDER_STATUS.PLACED,
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'PAID', 'FAILED', 'REFUNDED'],
      default: 'PENDING',
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: ['CASH_ON_DELIVERY', 'MOCK_PAYMENT'],
      default: 'MOCK_PAYMENT',
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      default: null,
    },
    statusTimeline: {
      type: [statusTimelineSchema],
      default: [],
    },
    cancellation: {
      cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      cancelledByRole: { type: String },
      reason: { type: String },
      cancelledAt: { type: Date },
      stockRestored: { type: Boolean, default: false },
      restockedBatches: [
        {
          batchId: mongoose.Schema.Types.ObjectId,
          batchNumber: String,
          quantity: Number,
          action: String, // 'RESTOCKED_ACTIVE' | 'WRITTEN_OFF_EXPIRED'
        },
      ],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

orderSchema.index({ customerId: 1, createdAt: -1 });
orderSchema.index({ storeId: 1, status: 1, createdAt: -1 });
orderSchema.index({ 'items.productId': 1 });
orderSchema.index({ 'items.batchAllocations.batchId': 1 });

export const Order = mongoose.model('Order', orderSchema);
export default Order;
