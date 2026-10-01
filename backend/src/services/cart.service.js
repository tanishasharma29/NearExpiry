import mongoose from 'mongoose';
import { Cart } from '../models/cart.model.js';
import { Product, PRODUCT_STATUS } from '../models/product.model.js';
import { Store } from '../models/store.model.js';
import { User, VERIFICATION_STATUS } from '../models/user.model.js';
import { Batch, BATCH_STATUS } from '../models/batch.model.js';
import { InventoryAudit, INVENTORY_ACTION_TYPES } from '../models/inventory.model.js';
import { ApiError } from '../utils/ApiError.js';
import { toCalendarDayEpochUTC } from '../utils/shelfLife.js';

const round2 = (num) => Math.round((Number(num) + Number.EPSILON) * 100) / 100;

/**
 * Retrieve or automatically create an active Cart for the given customer.
 */
export const getOrCreateCart = async (userId) => {
  let cart = await Cart.findOne({ userId });
  if (!cart) {
    cart = await Cart.create({ userId, items: [] });
  }
  return cart;
};

/**
 * Core Live Cart Evaluation Engine.
 *
 * GUARANTEES:
 * 1. NEVER trusts frontend prices or stock counts.
 * 2. Validates product status (flags deleted or archived products).
 * 3. Validates store and seller verification status.
 * 4. Strictly checks expiry: expired batches can NEVER be purchased.
 * 5. Performs live FEFO batch breakdown (blended unit price across lots).
 * 6. Detects price changes between when item was added and current evaluation.
 * 7. Flags insufficient stock with exact available counts.
 * 8. Calculates subtotal, discounts, and final total.
 */
export const getCartSummaryService = async (userId) => {
  const cart = await getOrCreateCart(userId);
  const todayUtc = new Date(toCalendarDayEpochUTC(new Date()));

  if (cart.items.length === 0) {
    return {
      cartId: cart._id,
      userId: cart.userId,
      store: null,
      items: [],
      pricingSummary: {
        subtotal: 0,
        discounts: 0,
        finalTotal: 0,
        totalAvailableUnits: 0,
        itemCount: 0,
      },
      hasUnavailableItems: false,
      unavailableItemCount: 0,
      hasPriceChanges: false,
      canCheckout: false,
      blockingIssues: [],
      updatedAt: cart.updatedAt,
    };
  }

  // Pre-load distinct products, stores, and sellers to minimize query overhead
  const productIds = cart.items.map((i) => i.productId);
  const storeIds = cart.items.map((i) => i.storeId);

  const [products, stores] = await Promise.all([
    Product.find({ _id: { $in: productIds } })
      .populate('category', 'name slug status')
      .lean(),
    Store.find({ _id: { $in: storeIds } }).lean(),
  ]);

  const productMap = new Map(products.map((p) => [p._id.toString(), p]));
  const storeMap = new Map(stores.map((s) => [s._id.toString(), s]));

  const sellerIds = stores.map((s) => s.ownerId || s.sellerId).filter(Boolean);
  const sellers = await User.find({ _id: { $in: sellerIds } }).lean();
  const sellerMap = new Map(sellers.map((u) => [u._id.toString(), u]));

  let subtotal = 0;
  let discounts = 0;
  let finalTotal = 0;
  let totalAvailableUnits = 0;
  let unavailableItemCount = 0;
  let hasPriceChanges = false;
  const blockingIssues = [];
  const evaluatedItems = [];

  // Group by store to identify fulfilling store
  let activeStore = null;

  for (const item of cart.items) {
    const pIdStr = item.productId.toString();
    const sIdStr = item.storeId.toString();
    const product = productMap.get(pIdStr);
    const store = storeMap.get(sIdStr);
    const sellerId = store ? (store.ownerId || store.sellerId) : null;
    const seller = sellerId ? sellerMap.get(sellerId.toString()) : null;

    if (!activeStore && store) {
      activeStore = {
        _id: store._id,
        storeName: store.storeName,
        slug: store.slug,
        address: store.address,
        isActive: store.isActive,
        verificationStatus: store.verificationStatus,
      };
    }

    const itemResult = {
      _id: item._id,
      productId: item.productId,
      storeId: item.storeId,
      requestedQuantity: item.quantity,
      batchId: item.batchId || null,
      product: product
        ? {
            _id: product._id,
            name: product.name,
            brand: product.brand,
            image: product.image,
            unit: product.unit,
            status: product.status,
            category: product.category,
          }
        : null,
      store: store
        ? {
            _id: store._id,
            storeName: store.storeName,
            isActive: store.isActive,
            verificationStatus: store.verificationStatus,
          }
        : null,
      isAvailable: false,
      itemStatus: 'AVAILABLE',
      reason: null,
      availableQuantity: 0,
      priceChanged: false,
      priceChangeNotice: null,
      batchAllocations: [],
      pricing: {
        unitOriginalPrice: 0,
        unitFinalPrice: 0,
        discountPercentage: 0,
        lineOriginalTotal: 0,
        lineDiscountTotal: 0,
        lineFinalTotal: 0,
      },
      warnings: [],
    };

    // 1. Validate Product Status
    if (!product || product.status !== PRODUCT_STATUS.ACTIVE) {
      itemResult.itemStatus = 'PRODUCT_DELETED';
      itemResult.reason = 'Product is no longer available or was removed from catalog.';
      unavailableItemCount += 1;
      blockingIssues.push({
        productId: item.productId,
        productName: product?.name || 'Unknown Product',
        issue: 'PRODUCT_DELETED',
        message: itemResult.reason,
      });
      evaluatedItems.push(itemResult);
      continue;
    }

    // 2. Validate Store & Seller Verification Status
    if (!store || !store.isActive || store.verificationStatus !== VERIFICATION_STATUS.APPROVED) {
      itemResult.itemStatus = 'STORE_UNAVAILABLE';
      itemResult.reason = 'Store is currently inactive, unverified, or temporarily closed.';
      unavailableItemCount += 1;
      blockingIssues.push({
        productId: item.productId,
        productName: product.name,
        issue: 'STORE_UNAVAILABLE',
        message: itemResult.reason,
      });
      evaluatedItems.push(itemResult);
      continue;
    }

    if (seller && (seller.isActive === false || seller.status === 'SUSPENDED')) {
      itemResult.itemStatus = 'SELLER_SUSPENDED';
      itemResult.reason = 'Seller account is suspended or inactive.';
      unavailableItemCount += 1;
      blockingIssues.push({
        productId: item.productId,
        productName: product.name,
        issue: 'SELLER_SUSPENDED',
        message: itemResult.reason,
      });
      evaluatedItems.push(itemResult);
      continue;
    }

    // 3. Validate Stock & Expiry via Batches (FEFO Resolution)
    let candidateBatches = [];

    if (item.batchId) {
      // Pinned specific batch
      const specificBatch = await Batch.findOne({
        _id: item.batchId,
        productId: item.productId,
        storeId: item.storeId,
      }).lean();

      if (!specificBatch) {
        itemResult.itemStatus = 'BATCH_NOT_FOUND';
        itemResult.reason = 'Specified batch lot could not be found.';
      } else if (
        specificBatch.remainingDays < 0 ||
        new Date(specificBatch.expiryDate) < todayUtc ||
        specificBatch.status === BATCH_STATUS.EXPIRED
      ) {
        itemResult.itemStatus = 'EXPIRED';
        itemResult.reason = `Batch [${specificBatch.batchNumber}] has EXPIRED on ${new Date(specificBatch.expiryDate).toISOString().slice(0, 10)} and cannot be purchased.`;
      } else if (specificBatch.quantity <= 0 || !specificBatch.isPurchasable) {
        itemResult.itemStatus = 'OUT_OF_STOCK';
        itemResult.reason = 'Selected batch is currently out of stock.';
      } else {
        candidateBatches = [specificBatch];
      }
    } else {
      // Dynamic FEFO: query all active non-expired purchasable batches in FEFO order
      candidateBatches = await Batch.find({
        productId: item.productId,
        storeId: item.storeId,
        isPurchasable: true,
        quantity: { $gt: 0 },
        remainingDays: { $gte: 0 },
        expiryDate: { $gte: todayUtc },
        status: {
          $in: [BATCH_STATUS.NORMAL, BATCH_STATUS.APPROACHING_EXPIRY, BATCH_STATUS.CRITICAL],
        },
      })
        .sort({ expiryDate: 1, createdAt: 1 })
        .lean();
    }

    const totalAvailableQty = candidateBatches.reduce((acc, b) => acc + b.quantity, 0);
    itemResult.availableQuantity = totalAvailableQty;

    if (candidateBatches.length === 0) {
      if (!itemResult.itemStatus || itemResult.itemStatus === 'AVAILABLE') {
        const expiredCount = await Batch.countDocuments({
          productId: item.productId,
          storeId: item.storeId,
          $or: [{ expiryDate: { $lt: todayUtc } }, { status: BATCH_STATUS.EXPIRED }],
        });

        if (expiredCount > 0) {
          itemResult.itemStatus = 'EXPIRED';
          itemResult.reason = 'All available inventory for this product has expired.';
        } else {
          itemResult.itemStatus = 'OUT_OF_STOCK';
          itemResult.reason = 'Product is currently out of stock at this store.';
        }
      }

      unavailableItemCount += 1;
      blockingIssues.push({
        productId: item.productId,
        productName: product.name,
        issue: itemResult.itemStatus,
        message: itemResult.reason,
      });
      evaluatedItems.push(itemResult);
      continue;
    }

    if (totalAvailableQty < item.quantity) {
      itemResult.itemStatus = 'INSUFFICIENT_STOCK';
      itemResult.reason = `Requested ${item.quantity} units, but only ${totalAvailableQty} units are available in active non-expired stock.`;
      unavailableItemCount += 1;
      blockingIssues.push({
        productId: item.productId,
        productName: product.name,
        issue: 'INSUFFICIENT_STOCK',
        requestedQuantity: item.quantity,
        availableQuantity: totalAvailableQty,
        message: itemResult.reason,
      });
      evaluatedItems.push(itemResult);
      continue;
    }

    // 4. Multi-Batch FEFO Allocation & Live Pricing Math
    let needed = item.quantity;
    let lineOrig = 0;
    let lineFinal = 0;
    const allocations = [];

    for (const b of candidateBatches) {
      if (needed <= 0) break;
      const allocQty = Math.min(b.quantity, needed);
      const bOrig = round2(b.originalPrice * allocQty);
      const bFinal = round2(b.currentPrice * allocQty);
      const bSavings = round2(bOrig - bFinal);

      allocations.push({
        batchId: b._id,
        batchNumber: b.batchNumber,
        manufacturingDate: b.manufacturingDate,
        expiryDate: b.expiryDate,
        remainingDays: b.remainingDays,
        status: b.status,
        allocatedQuantity: allocQty,
        unitOriginalPrice: b.originalPrice,
        unitDiscountedPrice: b.currentPrice,
        discountPercentage: b.discountPercentage,
        lineOriginalPrice: bOrig,
        lineFinalPrice: bFinal,
        savings: bSavings,
      });

      lineOrig += bOrig;
      lineFinal += bFinal;
      needed -= allocQty;
    }

    lineOrig = round2(lineOrig);
    lineFinal = round2(lineFinal);
    const lineSavings = round2(lineOrig - lineFinal);
    const blendedUnitPrice = round2(lineFinal / item.quantity);
    const blendedOriginalPrice = round2(lineOrig / item.quantity);
    const effectiveDiscountPercent = round2(((lineOrig - lineFinal) / lineOrig) * 100);

    itemResult.isAvailable = true;
    itemResult.itemStatus = 'AVAILABLE';
    itemResult.batchAllocations = allocations;
    itemResult.pricing = {
      unitOriginalPrice: blendedOriginalPrice,
      unitFinalPrice: blendedUnitPrice,
      discountPercentage: effectiveDiscountPercent,
      lineOriginalTotal: lineOrig,
      lineDiscountTotal: lineSavings,
      lineFinalTotal: lineFinal,
    };

    // 5. Price Change Detection (comparing current blended price vs priceSnapshotAtAdd)
    if (
      item.priceSnapshotAtAdd &&
      item.priceSnapshotAtAdd.unitDiscountedPrice > 0 &&
      Math.abs(blendedUnitPrice - item.priceSnapshotAtAdd.unitDiscountedPrice) > 0.01
    ) {
      const diff = round2(blendedUnitPrice - item.priceSnapshotAtAdd.unitDiscountedPrice);
      itemResult.priceChanged = true;
      hasPriceChanges = true;
      itemResult.priceChangeNotice = {
        oldUnitPrice: item.priceSnapshotAtAdd.unitDiscountedPrice,
        newUnitPrice: blendedUnitPrice,
        difference: diff,
        direction: diff < 0 ? 'DECREASED' : 'INCREASED',
        message:
          diff < 0
            ? `Price dropped by ₹${Math.abs(diff)}/unit due to near-expiry dynamic markdown!`
            : `Price changed by ₹${diff}/unit since you added this item.`,
      };
      itemResult.warnings.push(itemResult.priceChangeNotice.message);
    }

    const hasCriticalBatch = allocations.some((a) => a.remainingDays <= 2);
    if (hasCriticalBatch) {
      itemResult.warnings.push('Contains items expiring within 48 hours. Best consumed promptly.');
    }

    subtotal += lineOrig;
    discounts += lineSavings;
    finalTotal += lineFinal;
    totalAvailableUnits += item.quantity;

    evaluatedItems.push(itemResult);
  }

  subtotal = round2(subtotal);
  discounts = round2(discounts);
  finalTotal = round2(finalTotal);

  const canCheckout = evaluatedItems.length > 0 && unavailableItemCount === 0;

  return {
    cartId: cart._id,
    userId: cart.userId,
    store: activeStore,
    items: evaluatedItems,
    pricingSummary: {
      subtotal,
      discounts,
      finalTotal,
      totalAvailableUnits,
      itemCount: evaluatedItems.length,
    },
    hasUnavailableItems: unavailableItemCount > 0,
    unavailableItemCount,
    hasPriceChanges,
    canCheckout,
    blockingIssues,
    updatedAt: cart.updatedAt,
  };
};

/**
 * Add an item to the customer's cart.
 * Enforces single-store cart policy with option for customer to replace cart.
 */
export const addItemToCartService = async (
  userId,
  { productId, quantity = 1, batchId = null, replaceCart = false }
) => {
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw new ApiError(400, 'Invalid product ID format.', 'INVALID_PRODUCT_ID');
  }

  const requestedQty = Number(quantity);
  if (!Number.isInteger(requestedQty) || requestedQty <= 0 || requestedQty > 99) {
    throw new ApiError(400, 'Quantity must be an integer between 1 and 99.', 'INVALID_QUANTITY');
  }

  const product = await Product.findById(productId);
  if (!product || product.status !== PRODUCT_STATUS.ACTIVE) {
    throw new ApiError(404, 'Product not found or inactive.', 'PRODUCT_NOT_FOUND');
  }

  const store = await Store.findById(product.storeId);
  if (!store || !store.isActive || store.verificationStatus !== VERIFICATION_STATUS.APPROVED) {
    throw new ApiError(400, 'Store is currently unavailable or unverified.', 'STORE_UNAVAILABLE');
  }

  const todayUtc = new Date(toCalendarDayEpochUTC(new Date()));

  // Verify batch lot if specified
  let targetBatch = null;
  if (batchId) {
    if (!mongoose.Types.ObjectId.isValid(batchId)) {
      throw new ApiError(400, 'Invalid batch ID format.', 'INVALID_BATCH_ID');
    }
    targetBatch = await Batch.findOne({
      _id: batchId,
      productId: product._id,
      storeId: store._id,
    });
    if (!targetBatch) {
      throw new ApiError(404, 'Specified batch lot not found.', 'BATCH_NOT_FOUND');
    }
    if (
      targetBatch.remainingDays < 0 ||
      new Date(targetBatch.expiryDate) < todayUtc ||
      targetBatch.status === BATCH_STATUS.EXPIRED
    ) {
      throw new ApiError(
        400,
        `Batch [${targetBatch.batchNumber}] has EXPIRED and cannot be added to cart.`,
        'EXPIRED_ITEM_CANNOT_BE_PURCHASED'
      );
    }
    if (targetBatch.quantity < requestedQty) {
      throw new ApiError(
        400,
        `Insufficient batch stock. Requested ${requestedQty}, available: ${targetBatch.quantity}.`,
        'INSUFFICIENT_STOCK'
      );
    }
  } else {
    // Check total active stock across non-expired batches
    const totalStock = await Batch.aggregate([
      {
        $match: {
          productId: product._id,
          storeId: store._id,
          isPurchasable: true,
          quantity: { $gt: 0 },
          remainingDays: { $gte: 0 },
          expiryDate: { $gte: todayUtc },
          status: {
            $in: [BATCH_STATUS.NORMAL, BATCH_STATUS.APPROACHING_EXPIRY, BATCH_STATUS.CRITICAL],
          },
        },
      },
      { $group: { _id: null, total: { $sum: '$quantity' } } },
    ]);

    const availableStock = totalStock[0]?.total || 0;
    if (availableStock === 0) {
      throw new ApiError(
        400,
        'This product is currently out of stock or all batches have expired.',
        'PRODUCT_OUT_OF_STOCK'
      );
    }
  }

  const cart = await getOrCreateCart(userId);

  // Single-Store Policy: Check if existing items belong to a different store
  if (cart.items.length > 0) {
    const existingStoreId = cart.items[0].storeId.toString();
    const newStoreId = store._id.toString();

    if (existingStoreId !== newStoreId) {
      if (!replaceCart) {
        const existingStore = await Store.findById(existingStoreId).lean();
        throw new ApiError(
          409,
          `Your cart already contains items from "${existingStore?.storeName || 'another store'}". Would you like to clear your cart and start a new order from "${store.storeName}"?`,
          'CART_STORE_CONFLICT',
          {
            existingStore: {
              _id: existingStore?._id,
              storeName: existingStore?.storeName,
            },
            newStore: {
              _id: store._id,
              storeName: store.storeName,
            },
          }
        );
      } else {
        // Customer approved replacing cart from new store
        cart.items = [];
      }
    }
  }

  // Find if product already in cart
  const existingItemIndex = cart.items.findIndex(
    (i) => i.productId.toString() === product._id.toString()
  );

  // Query live FEFO lead batch for baseline snapshot
  const leadBatch = targetBatch || (await Batch.findOne({
    productId: product._id,
    storeId: store._id,
    isPurchasable: true,
    quantity: { $gt: 0 },
    remainingDays: { $gte: 0 },
    expiryDate: { $gte: todayUtc },
  }).sort({ expiryDate: 1, createdAt: 1 }));

  const snapshot = {
    unitOriginalPrice: leadBatch?.originalPrice || 0,
    unitDiscountedPrice: leadBatch?.currentPrice || 0,
    discountPercentage: leadBatch?.discountPercentage || 0,
    addedAt: new Date(),
  };

  if (existingItemIndex > -1) {
    cart.items[existingItemIndex].quantity += requestedQty;
    cart.items[existingItemIndex].priceSnapshotAtAdd = snapshot;
  } else {
    cart.items.push({
      productId: product._id,
      storeId: store._id,
      quantity: requestedQty,
      batchId: targetBatch?._id || null,
      priceSnapshotAtAdd: snapshot,
    });
  }

  await cart.save();
  return getCartSummaryService(userId);
};

/**
 * Update the quantity of a product in the cart.
 */
export const updateCartItemQuantityService = async (userId, productId, quantity) => {
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw new ApiError(400, 'Invalid product ID format.', 'INVALID_PRODUCT_ID');
  }

  const newQty = Number(quantity);
  if (!Number.isInteger(newQty) || newQty <= 0 || newQty > 99) {
    throw new ApiError(400, 'Quantity must be an integer between 1 and 99.', 'INVALID_QUANTITY');
  }

  const cart = await getOrCreateCart(userId);
  const item = cart.items.find((i) => i.productId.toString() === productId);

  if (!item) {
    throw new ApiError(404, 'Product was not found in your cart.', 'CART_ITEM_NOT_FOUND');
  }

  item.quantity = newQty;
  await cart.save();

  return getCartSummaryService(userId);
};

/**
 * Remove a specific product from the cart.
 */
export const removeCartItemService = async (userId, productId) => {
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw new ApiError(400, 'Invalid product ID format.', 'INVALID_PRODUCT_ID');
  }

  const cart = await getOrCreateCart(userId);
  const initialCount = cart.items.length;
  cart.items = cart.items.filter((i) => i.productId.toString() !== productId);

  if (cart.items.length === initialCount) {
    throw new ApiError(404, 'Product was not found in your cart.', 'CART_ITEM_NOT_FOUND');
  }

  await cart.save();
  return getCartSummaryService(userId);
};

/**
 * Clear all items from the cart.
 */
export const clearCartService = async (userId) => {
  const cart = await getOrCreateCart(userId);
  cart.items = [];
  await cart.save();
  return getCartSummaryService(userId);
};

/**
 * Strictly validate the cart for checkout.
 * Recalculates all items, checks stock, expiry, product, and store status.
 * Returns validated checkout snapshot or throws detailed blocking errors.
 */
export const validateCartForCheckoutService = async (userId, options = {}) => {
  const summary = await getCartSummaryService(userId);

  if (summary.items.length === 0) {
    throw new ApiError(400, 'Your cart is empty. Please add items before checkout.', 'CART_EMPTY');
  }

  if (summary.hasUnavailableItems) {
    throw new ApiError(
      422,
      'Some items in your cart are no longer purchasable (expired, out of stock, or store closed). Please review your cart.',
      'CHECKOUT_VALIDATION_FAILED',
      { blockingIssues: summary.blockingIssues, cart: summary }
    );
  }

  if (options.storeId && summary.store?._id.toString() !== options.storeId.toString()) {
    throw new ApiError(
      400,
      'Cart store does not match the requested checkout store.',
      'STORE_MISMATCH'
    );
  }

  return {
    canProceed: true,
    storeId: summary.store._id,
    storeName: summary.store.storeName,
    pricingSummary: summary.pricingSummary,
    items: summary.items.map((item) => ({
      productId: item.productId,
      productName: item.product.name,
      quantity: item.requestedQuantity,
      unitPrice: item.pricing.unitFinalPrice,
      originalPrice: item.pricing.unitOriginalPrice,
      discountPercentage: item.pricing.discountPercentage,
      lineTotal: item.pricing.lineFinalTotal,
      batchAllocations: item.batchAllocations,
    })),
    validatedAt: new Date(),
  };
};

/**
 * Synchronize and prune the cart.
 * Automatically removes items that are expired or deleted,
 * and clips quantities down to maximum available stock.
 */
export const syncOrPruneCartService = async (userId) => {
  const summary = await getCartSummaryService(userId);
  const cart = await getOrCreateCart(userId);

  let modified = false;
  const prunedItems = [];

  const validCartItems = [];
  for (const item of cart.items) {
    const evaluated = summary.items.find(
      (ev) => ev.productId.toString() === item.productId.toString()
    );

    if (!evaluated || !evaluated.isAvailable) {
      modified = true;
      prunedItems.push({
        productId: item.productId,
        reason: evaluated?.reason || 'Unavailable',
      });
      continue;
    }

    if (evaluated.availableQuantity < item.quantity) {
      modified = true;
      item.quantity = evaluated.availableQuantity;
    }

    validCartItems.push(item);
  }

  cart.items = validCartItems;
  if (modified) {
    await cart.save();
  }

  const updatedSummary = await getCartSummaryService(userId);
  return {
    modified,
    prunedItems,
    summary: updatedSummary,
  };
};

/**
 * Atomic Cart Stock Reservation using MongoDB Transactions (where supported)
 * or Atomic Conditional Updates with Rollback.
 * Locks sellable stock into batch.reservedQuantity for checkout fulfillment.
 */
export const reserveCartStockService = async (userId, userActor = null) => {
  const checkoutData = await validateCartForCheckoutService(userId);
  const todayUtc = new Date(toCalendarDayEpochUTC(new Date()));

  // Detect whether MongoDB server topology supports multi-document transactions
  const topology = mongoose.connection.client?.topology?.description;
  const isReplicaSet =
    topology?.type === 'ReplicaSetWithPrimary' ||
    Boolean(topology?.setName) ||
    topology?.type === 'Sharded';

  const session = isReplicaSet ? await mongoose.startSession() : null;
  if (session) {
    session.startTransaction();
  }

  const reservedRecords = [];

  try {
    for (const line of checkoutData.items) {
      for (const alloc of line.batchAllocations) {
        const query = {
          _id: alloc.batchId,
          quantity: { $gte: alloc.allocatedQuantity },
          expiryDate: { $gte: todayUtc },
        };

        const update = {
          $inc: {
            quantity: -alloc.allocatedQuantity,
            reservedQuantity: alloc.allocatedQuantity,
          },
        };

        const opts = session ? { session, new: true } : { new: true };
        const updatedBatch = await Batch.findOneAndUpdate(query, update, opts);

        if (!updatedBatch) {
          throw new ApiError(
            409,
            `Stock conflict or batch expiry detected on batch [${alloc.batchNumber}]. Required: ${alloc.allocatedQuantity}.`,
            'CONCURRENT_RESERVATION_CONFLICT'
          );
        }

        reservedRecords.push({
          batchId: alloc.batchId,
          quantity: alloc.allocatedQuantity,
          productId: line.productId,
          storeId: checkoutData.storeId,
          batchNumber: alloc.batchNumber,
        });

        // Audit log
        await InventoryAudit.create(
          [
            {
              batchId: alloc.batchId,
              productId: line.productId,
              storeId: checkoutData.storeId,
              batchNumber: alloc.batchNumber,
              actionType: INVENTORY_ACTION_TYPES.STOCK_RESERVATION,
              quantityChange: -alloc.allocatedQuantity,
              previousQuantity: updatedBatch.quantity + alloc.allocatedQuantity,
              newQuantity: updatedBatch.quantity,
              previousReserved: updatedBatch.reservedQuantity - alloc.allocatedQuantity,
              newReserved: updatedBatch.reservedQuantity,
              batchStatusAfter: updatedBatch.status,
              reason: 'Cart checkout atomic stock reservation',
              performedBy: userActor?._id || userId,
              performedByRole: userActor?.role || 'CUSTOMER',
            },
          ],
          session ? { session } : {}
        );
      }
    }

    if (session) {
      await session.commitTransaction();
    }

    return {
      success: true,
      storeId: checkoutData.storeId,
      reservedBatches: reservedRecords,
      checkoutSnapshot: checkoutData,
    };
  } catch (error) {
    if (session) {
      await session.abortTransaction();
    } else {
      // Manual compensation rollback for standalone MongoDB
      for (const rec of reservedRecords) {
        await Batch.findByIdAndUpdate(rec.batchId, {
          $inc: {
            quantity: rec.quantity,
            reservedQuantity: -rec.quantity,
          },
        });
      }
    }
    throw error;
  } finally {
    if (session) {
      session.endSession();
    }
  }
};
