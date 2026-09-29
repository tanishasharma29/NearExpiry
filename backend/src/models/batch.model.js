import mongoose from 'mongoose';
import {
  BATCH_STATUS,
  calculateRemainingDays,
  computeBatchStatus,
  isBatchPurchasable,
} from '../utils/shelfLife.js';

export { BATCH_STATUS };

const batchSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'productId is required'],
      index: true,
    },
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      required: [true, 'storeId is required'],
      index: true,
    },
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'sellerId is required'],
      index: true,
    },
    batchNumber: {
      type: String,
      required: [true, 'Batch number is required'],
      trim: true,
      uppercase: true,
      minlength: [1, 'Batch number cannot be empty'],
      maxlength: [64, 'Batch number cannot exceed 64 characters'],
    },
    manufacturingDate: {
      type: Date,
      required: [true, 'Manufacturing date is required'],
    },
    expiryDate: {
      type: Date,
      required: [true, 'Expiry / Best-before date is required'],
      index: true,
    },
    remainingDays: {
      type: Number,
      required: true,
      default: 0,
      index: true,
    },
    initialQuantity: {
      type: Number,
      required: true,
      min: [0, 'Initial quantity cannot be negative'],
    },
    quantity: {
      type: Number,
      required: [true, 'Batch quantity is required'],
      min: [0, 'Batch quantity cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'Batch quantity must be an integer',
      },
    },
    reservedQuantity: {
      type: Number,
      default: 0,
      min: [0, 'Reserved quantity cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'Reserved quantity must be an integer',
      },
    },
    soldQuantity: {
      type: Number,
      default: 0,
      min: [0, 'Sold quantity cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'Sold quantity must be an integer',
      },
    },
    originalPrice: {
      type: Number,
      required: [true, 'Original price is required'],
      min: [0.01, 'Original price must be greater than 0'],
    },
    discountPercentage: {
      type: Number,
      default: 0,
      min: [0, 'Discount percentage cannot be negative'],
      max: [100, 'Discount percentage cannot exceed 100%'],
    },
    currentPrice: {
      type: Number,
      required: [true, 'Current price is required'],
      min: [0, 'Current price cannot be negative'],
    },
    appliedPriceRuleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PriceRule',
      default: null,
    },
    status: {
      type: String,
      enum: Object.values(BATCH_STATUS),
      default: BATCH_STATUS.NORMAL,
      index: true,
    },
    isPurchasable: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

batchSchema.virtual('totalPhysicalStock').get(function () {
  return (this.quantity || 0) + (this.reservedQuantity || 0);
});

batchSchema.virtual('finalPrice').get(function () {
  return this.currentPrice;
});

batchSchema.index(
  { storeId: 1, productId: 1, batchNumber: 1 },
  { unique: true, name: 'uniq_store_product_batchNumber' }
);

batchSchema.index(
  { productId: 1, status: 1, expiryDate: 1, createdAt: 1 },
  { name: 'idx_fefo_product_status_expiry' }
);

batchSchema.index(
  { storeId: 1, status: 1, expiryDate: 1 },
  { name: 'idx_store_status_expiry' }
);

batchSchema.pre('validate', function (next) {
  if (this.manufacturingDate && this.expiryDate) {
    if (new Date(this.manufacturingDate) >= new Date(this.expiryDate)) {
      return next(new Error('manufacturingDate must be earlier than expiryDate'));
    }
  }

  if (this.currentPrice === undefined || this.currentPrice === null) {
    this.currentPrice = this.originalPrice;
  }

  if (this.isNew && (this.initialQuantity === undefined || this.initialQuantity === null)) {
    this.initialQuantity = this.quantity;
  }

  if (this.expiryDate) {
    if ((this.isNew || this.isModified('expiryDate')) && !this.isModified('remainingDays')) {
      this.remainingDays = calculateRemainingDays(this.expiryDate);
    }
    this.status = computeBatchStatus(this.remainingDays, this.quantity ?? 0);
    this.isPurchasable = isBatchPurchasable(this.remainingDays, this.quantity ?? 0, this.status);
  }

  next();
});

export const Batch = mongoose.model('Batch', batchSchema);
