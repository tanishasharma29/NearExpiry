import mongoose from 'mongoose';

/**
 * PriceRule Mongoose Model (Collection: priceRules).
 *
 * Stores configurable shelf-life discount brackets in MongoDB so pricing tiers
 * are NEVER hard-coded in application logic.
 *
 * Initial seeded brackets:
 * - 61+ days  (minDays: 61, maxDays: null) -> 0%
 * - 31–60 days (minDays: 31, maxDays: 60)  -> 10%
 * - 16–30 days (minDays: 16, maxDays: 30)  -> 25%
 * - 8–15 days  (minDays: 8,  maxDays: 15)  -> 40%
 * - 3–7 days   (minDays: 3,  maxDays: 7)   -> 60%
 * - 0–2 days   (minDays: 0,  maxDays: 2)   -> 75%
 */
const priceRuleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Rule name is required'],
      trim: true,
      maxlength: [120, 'Rule name cannot exceed 120 characters'],
    },
    minDays: {
      type: Number,
      required: [true, 'minDays is required'],
      min: [0, 'minDays cannot be negative (expired batches are never purchasable)'],
      validate: {
        validator: Number.isInteger,
        message: 'minDays must be an integer',
      },
    },
    maxDays: {
      type: Number,
      default: null, // null represents unbounded upper limit (e.g., 61+ days)
      validate: {
        validator: function (val) {
          if (val === null || val === undefined) return true;
          return Number.isInteger(val) && val >= this.minDays;
        },
        message: 'maxDays must be an integer greater than or equal to minDays (or null for 61+)',
      },
    },
    discountPercentage: {
      type: Number,
      required: [true, 'discountPercentage is required'],
      min: [0, 'discountPercentage cannot be less than 0%'],
      max: [100, 'discountPercentage cannot exceed 100%'],
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null, // null = Global default rule; populated = Category-specific rule
      index: true,
    },
    priority: {
      type: Number,
      default: 1, // Category rules use priority 10; Global rules use priority 1
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'priceRules',
  }
);

priceRuleSchema.index({ isActive: 1, categoryId: 1, priority: -1, minDays: 1 });

export const PriceRule = mongoose.model('PriceRule', priceRuleSchema);
