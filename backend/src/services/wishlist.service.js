import mongoose from 'mongoose';
import { Wishlist } from '../models/wishlist.model.js';
import { Product, PRODUCT_STATUS } from '../models/product.model.js';
import { Batch, BATCH_STATUS } from '../models/batch.model.js';
import { ApiError } from '../utils/ApiError.js';
import { toCalendarDayEpochUTC } from '../utils/shelfLife.js';

/**
 * Add or update a product in the Customer's Wishlist.
 */
export const addToWishlistService = async (userId, { productId, targetDiscountPercentage = 0, notes = '' }) => {
  const product = await Product.findById(productId);
  if (!product || product.status !== PRODUCT_STATUS.ACTIVE) {
    throw new ApiError(404, 'Product not found or inactive.', 'PRODUCT_NOT_FOUND');
  }

  const wishlistItem = await Wishlist.findOneAndUpdate(
    { userId, productId: product._id },
    {
      $set: {
        storeId: product.storeId,
        targetDiscountPercentage,
        notes,
      },
    },
    { upsert: true, new: true }
  ).populate('productId', 'name brand image unit status');

  return wishlistItem;
};

/**
 * List Customer's Wishlist enriched with live purchasable FEFO batch status.
 * Expired products are flagged with isCurrentlyPurchasable: false so they can never be bought.
 */
export const getCustomerWishlistService = async (userId) => {
  const items = await Wishlist.find({ userId })
    .populate('productId', 'name slug brand image unit status category')
    .populate('storeId', 'storeName slug address verificationStatus')
    .sort({ createdAt: -1 });

  const todayUtcDate = new Date(toCalendarDayEpochUTC(new Date()));

  const enrichedWishlist = await Promise.all(
    items.map(async (item) => {
      if (!item.productId) return null;

      const activeBatches = await Batch.find({
        productId: item.productId._id,
        isPurchasable: true,
        quantity: { $gt: 0 },
        remainingDays: { $gte: 0 },
        expiryDate: { $gte: todayUtcDate },
        status: {
          $in: [BATCH_STATUS.NORMAL, BATCH_STATUS.APPROACHING_EXPIRY, BATCH_STATUS.CRITICAL],
        },
      }).sort({ expiryDate: 1, createdAt: 1 });

      const leadBatch = activeBatches[0] || null;
      const totalAvailableQuantity = activeBatches.reduce((sum, b) => sum + b.quantity, 0);

      return {
        _id: item._id,
        addedAt: item.createdAt,
        targetDiscountPercentage: item.targetDiscountPercentage,
        notes: item.notes,
        product: item.productId,
        store: item.storeId,
        isCurrentlyPurchasable: Boolean(leadBatch && totalAvailableQuantity > 0),
        livePricingSummary: leadBatch
          ? {
              leadBatchId: leadBatch._id,
              batchNumber: leadBatch.batchNumber,
              currentPrice: leadBatch.currentPrice,
              originalPrice: leadBatch.originalPrice,
              discountPercentage: leadBatch.discountPercentage,
              remainingDays: leadBatch.remainingDays,
              expiryDate: leadBatch.expiryDate,
              status: leadBatch.status,
              totalAvailableQuantity,
            }
          : null,
      };
    })
  );

  return enrichedWishlist.filter(Boolean);
};

/**
 * Remove a product from the Customer's Wishlist.
 */
export const removeFromWishlistService = async (userId, productId) => {
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw new ApiError(400, 'Invalid product ID format.', 'INVALID_PRODUCT_ID');
  }

  const deleted = await Wishlist.findOneAndDelete({ userId, productId });
  if (!deleted) {
    throw new ApiError(404, 'Product was not found in your wishlist.', 'WISHLIST_ITEM_NOT_FOUND');
  }

  return { removedProductId: productId };
};
