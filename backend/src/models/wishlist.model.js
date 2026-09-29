import mongoose from 'mongoose';

/**
 * Wishlist Model (Collection: wishlists).
 * Allows customers to save products and optionally set a target discount alert threshold.
 */
const wishlistSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'userId is required'],
      index: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'productId is required'],
      index: true,
    },
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      required: true,
      index: true,
    },
    targetDiscountPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 300,
      default: '',
    },
  },
  {
    timestamps: true,
    collection: 'wishlists',
  }
);

// Unique compound index: A customer can bookmark a specific product once
wishlistSchema.index({ userId: 1, productId: 1 }, { unique: true, name: 'uniq_user_product_wishlist' });
wishlistSchema.index({ userId: 1, createdAt: -1 });

export const Wishlist = mongoose.model('Wishlist', wishlistSchema);
