import mongoose from 'mongoose';

const billItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    productName: { type: String, required: true },
    brand: { type: String, default: '' },
    unit: { type: String, default: 'pcs' },
    requestedQuantity: { type: Number, required: true },
    blendedUnitPrice: { type: Number, required: true },
    lineOriginalAmount: { type: Number, required: true },
    lineDiscountedAmount: { type: Number, required: true },
    lineSavingsAmount: { type: Number, default: 0 },
    batchAllocations: [
      {
        batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch' },
        batchNumber: { type: String, required: true },
        expiryDate: { type: Date, required: true },
        allocatedQuantity: { type: Number, required: true },
        originalUnitPrice: { type: Number, default: 0 },
        discountedUnitPrice: { type: Number, default: 0 },
        savings: { type: Number, default: 0 },
      },
    ],
  },
  { _id: false }
);

const billReceiptSchema = new mongoose.Schema(
  {
    receiptNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      unique: true,
      index: true,
    },
    orderNumber: {
      type: String,
      required: true,
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    customerInfo: {
      name: { type: String, default: 'Customer' },
      email: { type: String, default: '' },
      phone: { type: String, default: '' },
    },
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      required: true,
      index: true,
    },
    storeInfo: {
      storeName: { type: String, required: true },
      address: { type: mongoose.Schema.Types.Mixed, default: '' },
      contactPhone: { type: String, default: '' },
      contactEmail: { type: String, default: '' },
    },
    items: [billItemSchema],
    pricingSummary: {
      subtotal: { type: Number, required: true },
      discounts: { type: Number, default: 0 },
      deliveryFee: { type: Number, default: 0 },
      finalTotal: { type: Number, required: true },
      totalSavings: { type: Number, default: 0 },
      itemCount: { type: Number, default: 0 },
      totalUnits: { type: Number, default: 0 },
    },
    paymentMethod: { type: String, default: 'CASH_ON_DELIVERY' },
    paymentStatus: { type: String, default: 'PAID' },
    fulfillmentType: { type: String, default: 'PICKUP' },
    deliveredAt: { type: Date, default: Date.now },
    verifiedBy: { type: String, default: 'Store Staff' },
    emailSent: { type: Boolean, default: false },
    emailSentAt: { type: Date, default: null },
    emailMessageId: { type: String, default: null },
  },
  {
    timestamps: true,
  }
);

export const BillReceipt = mongoose.model('BillReceipt', billReceiptSchema);

