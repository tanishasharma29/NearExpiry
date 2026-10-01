import mongoose from 'mongoose';

/**
 * Cart Item Sub-schema.
 * Stores product reference and desired quantity.
 * Batch-level FEFO allocations and dynamic pricing are computed dynamically on every read/checkout,
 * ensuring stale prices or expired inventory are NEVER persisted or trusted.
 */
const cartItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product ID is required in cart item'],
    },
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      required: [true, 'Store ID is required in cart item'],
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be at least 1'],
      default: 1,
    },
    batchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Batch',
      default: null, // null = dynamic FEFO allocation
    },
    priceSnapshotAtAdd: {
      unitOriginalPrice: { type: Number, default: 0 },
      unitDiscountedPrice: { type: Number, default: 0 },
      discountPercentage: { type: Number, default: 0 },
      addedAt: { type: Date, default: Date.now },
    },
  },
  {
    _id: true,
    timestamps: true,
  }
);

/**
 * Cart Schema (One Active Cart per Customer).
 */
const cartSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required for cart'],
      unique: true,
      index: true,
    },
    items: {
      type: [cartItemSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

export const Cart = mongoose.model('Cart', cartSchema);
export default Cart;
