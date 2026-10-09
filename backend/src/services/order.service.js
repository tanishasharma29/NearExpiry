import { ensureSellerStore } from './store.service.js';
import mongoose from 'mongoose';
import { Order, ORDER_STATUS, FULFILLMENT_TYPES } from '../models/order.model.js';
import { Cart } from '../models/cart.model.js';
import { Batch, BATCH_STATUS } from '../models/batch.model.js';
import { Store } from '../models/store.model.js';
import { User, USER_ROLES } from '../models/user.model.js';
import { InventoryAudit, INVENTORY_ACTION_TYPES } from '../models/inventory.model.js';
import { ApiError } from '../utils/ApiError.js';
import { validateCartForCheckoutService } from './cart.service.js';
import { toCalendarDayEpochUTC, computeBatchStatus, isBatchPurchasable } from '../utils/shelfLife.js';
import {
  notifyCustomerOrderConfirmed,
  notifyCustomerOrderStatus,
  notifyCustomerPickupReady,
  notifySellerNewOrder,
  notifySellerLowStock,
} from './notification.service.js';
import { generateBillReceiptService } from './billing.service.js';
import { emitToUser, emitToStore } from '../config/socket.js';
import { SOCKET_EVENTS } from '../constants/socketEvents.js';

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/**
 * Generate unique human-readable order number: NE-YYYYMMDD-XXXX
 */
const generateUniqueOrderNumber = async () => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  for (let attempt = 0; attempt < 5; attempt++) {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const candidate = `NE-${dateStr}-${randomSuffix}`;
    const existing = await Order.findOne({ orderNumber: candidate }).lean();
    if (!existing) return candidate;
  }
  return `NE-${dateStr}-${Date.now().toString().slice(-4)}`;
};

/**
 * Helper to check if current MongoDB connection supports multi-document transactions.
 */
const checkReplicaSetSupport = () => {
  const topology = mongoose.connection.client?.topology?.description;
  return (
    topology?.type === 'ReplicaSetWithPrimary' ||
    Boolean(topology?.setName) ||
    topology?.type === 'Sharded'
  );
};

/**
 * 1. Checkout & Create Order.
 *
 * GUARANTEES:
 * - Pre-flight checkout validation ensures zero expired, deleted, or unavailable items.
 * - Enforces FEFO batch allocation: earliest expiring batches are consumed first.
 * - Safely and atomically reduces batch inventory via conditional updates ($gte requested quantity).
 * - Prevents negative stock and prevents concurrent over-allocation.
 * - Preserves immutable purchase-time prices on both item and lot allocation levels.
 * - Uses MongoDB transactions where replica set is available, with compensating rollback on standalone Mongo.
 * - Clears customer's cart upon order confirmation.
 */
export const createOrderService = async (customerId, payload, userActor) => {
  // Step 1: Pre-flight checkout validation (never trust frontend prices)
  const checkoutData = await validateCartForCheckoutService(customerId);

  if (payload.fulfillmentType === FULFILLMENT_TYPES.LOCAL_DELIVERY && !payload.deliveryAddress?.street) {
    throw new ApiError(400, 'Delivery address is required for local delivery.', 'DELIVERY_ADDRESS_REQUIRED');
  }

  const orderNumber = await generateUniqueOrderNumber();
  const todayUtc = new Date(toCalendarDayEpochUTC(new Date()));

  const isReplicaSet = checkReplicaSetSupport();
  const session = isReplicaSet ? await mongoose.startSession() : null;
  if (session) {
    session.startTransaction();
  }

  const reservedDeductions = [];
  let createdOrder = null;

  try {
    // Step 2: Atomic Inventory Deduction across all FEFO Batch Allocations
    for (const item of checkoutData.items) {
      for (const alloc of item.batchAllocations) {
        // Atomic conditional check ensuring batch has sufficient stock and is not expired
        const query = {
          _id: alloc.batchId,
          quantity: { $gte: alloc.allocatedQuantity },
          expiryDate: { $gte: todayUtc },
          status: {
            $in: [BATCH_STATUS.NORMAL, BATCH_STATUS.APPROACHING_EXPIRY, BATCH_STATUS.CRITICAL],
          },
        };

        const currentBatch = await Batch.findById(alloc.batchId);
        if (!currentBatch || currentBatch.quantity < alloc.allocatedQuantity) {
          throw new ApiError(
            409,
            `Insufficient stock or lot expired on batch [${alloc.batchNumber}]. Available: ${currentBatch?.quantity || 0}, requested: ${alloc.allocatedQuantity}.`,
            'INSUFFICIENT_STOCK_OR_EXPIRED'
          );
        }

        const newQty = currentBatch.quantity - alloc.allocatedQuantity;
        const newStatus = computeBatchStatus(alloc.remainingDays, newQty);
        const newPurchasable = isBatchPurchasable(alloc.remainingDays, newQty, newStatus);

        const update = {
          $inc: {
            quantity: -alloc.allocatedQuantity,
            soldQuantity: alloc.allocatedQuantity,
          },
          $set: {
            status: newStatus,
            isPurchasable: newPurchasable,
          },
        };

        const opts = session ? { session, new: true } : { new: true };
        const updatedBatch = await Batch.findOneAndUpdate(query, update, opts);

        if (!updatedBatch) {
          throw new ApiError(
            409,
            `Stock conflict or batch expiry detected on batch [${alloc.batchNumber}]. Another customer may have completed their order first.`,
            'CONCURRENT_CHECKOUT_CONFLICT'
          );
        }

        reservedDeductions.push({
          batchId: alloc.batchId,
          quantity: alloc.allocatedQuantity,
          productId: item.productId,
          productName: item.productName,
          storeId: checkoutData.storeId,
          batchNumber: alloc.batchNumber,
          previousQuantity: currentBatch.quantity,
          newQuantity: newQty,
          batchStatusAfter: newStatus,
        });
      }
    }

    // Step 3: Create Immutable Order Document
    const orderDocData = {
      orderNumber,
      customerId,
      storeId: checkoutData.storeId,
      items: checkoutData.items.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        brand: item.brand || '',
        productImage: item.image || '',
        unit: item.unit || 'pcs',
        requestedQuantity: item.quantity,
        blendedUnitPrice: item.unitPrice,
        lineOriginalAmount: item.originalPrice * item.quantity,
        lineDiscountedAmount: item.lineTotal,
        lineSavingsAmount: round2(item.originalPrice * item.quantity - item.lineTotal),
        batchAllocations: item.batchAllocations.map((a) => ({
          batchId: a.batchId,
          batchNumber: a.batchNumber,
          manufacturingDate: a.manufacturingDate,
          expiryDate: a.expiryDate,
          remainingDays: a.remainingDays,
          allocatedQuantity: a.allocatedQuantity,
          originalUnitPrice: a.unitOriginalPrice,
          discountedUnitPrice: a.unitDiscountedPrice,
          discountPercent: a.discountPercentage,
          urgencyTier: a.status || 'NORMAL',
          lineOriginalPrice: a.lineOriginalPrice,
          lineFinalPrice: a.lineFinalPrice,
          savings: a.savings,
        })),
      })),
      pricingSummary: {
        subtotal: checkoutData.pricingSummary.subtotal,
        discounts: checkoutData.pricingSummary.discounts,
        deliveryFee: payload.fulfillmentType === FULFILLMENT_TYPES.LOCAL_DELIVERY ? 40 : 0,
        finalTotal:
          round2(
            checkoutData.pricingSummary.finalTotal +
              (payload.fulfillmentType === FULFILLMENT_TYPES.LOCAL_DELIVERY ? 40 : 0)
          ),
        totalUnits: checkoutData.pricingSummary.totalAvailableUnits,
        itemCount: checkoutData.pricingSummary.itemCount,
      },
      fulfillmentType: payload.fulfillmentType || FULFILLMENT_TYPES.PICKUP,
      paymentMethod: payload.paymentMethod || 'MOCK_PAYMENT',
      paymentStatus: 'PENDING',
      deliveryAddress: payload.deliveryAddress || {},
      status: ORDER_STATUS.PLACED,
      statusTimeline: [
        {
          status: ORDER_STATUS.PLACED,
          timestamp: new Date(),
          updatedBy: customerId,
          updatedByRole: 'CUSTOMER',
          note: 'Order successfully placed via NearExpiry checkout.',
        },
      ],
    };

    if (session) {
      const created = await Order.create([orderDocData], { session });
      createdOrder = created[0];
    } else {
      createdOrder = await Order.create(orderDocData);
    }

    // Step 4: Record Immutable Inventory Audit Entries for Every Allocated Batch
    const auditEntries = reservedDeductions.map((ded) => ({
      batchId: ded.batchId,
      productId: ded.productId,
      storeId: ded.storeId,
      batchNumber: ded.batchNumber,
      actionType: INVENTORY_ACTION_TYPES.STOCK_COMMITTED_SALE,
      quantityChange: -ded.quantity,
      previousQuantity: ded.previousQuantity,
      newQuantity: ded.newQuantity,
      previousReserved: 0,
      newReserved: 0,
      batchStatusAfter: ded.batchStatusAfter,
      referenceId: orderNumber,
      reason: `Sale committed for order [${orderNumber}]`,
      performedBy: userActor?._id || customerId,
      performedByRole: userActor?.role || 'CUSTOMER',
    }));

    if (session) {
      await InventoryAudit.create(auditEntries, { session });
      // Step 5: Clear Customer's Cart inside transaction
      await Cart.findOneAndUpdate({ userId: customerId }, { items: [] }, { session });
      await session.commitTransaction();
    } else {
      await InventoryAudit.create(auditEntries);
      await Cart.findOneAndUpdate({ userId: customerId }, { items: [] });
    }

    // Step 6: Dispatch Asynchronous Multi-Channel Notifications (Customer & Seller)
    try {
      const store = await Store.findById(checkoutData.storeId).lean();
      if (store) {
        // Customer: Order Confirmed
        notifyCustomerOrderConfirmed({
          customerId,
          order: createdOrder,
          store,
        }).catch((err) => console.error('[Notification] Order confirmed notify error:', err));

        // Seller: New Order
        notifySellerNewOrder({
          sellerId: store.ownerId,
          order: createdOrder,
          store,
        }).catch((err) => console.error('[Notification] Seller new order notify error:', err));

        // Seller: Low stock check for each allocated lot (threshold: <= 5 units remaining)
        for (const ded of reservedDeductions) {
          if (ded.newQuantity <= 5 && ded.newQuantity >= 0) {
            notifySellerLowStock({
              sellerId: store.ownerId,
              batch: { _id: ded.batchId, batchNumber: ded.batchNumber },
              product: { _id: ded.productId, name: ded.productName || 'Product' },
              store,
              quantity: ded.newQuantity,
            }).catch((err) => console.error('[Notification] Low stock notify error:', err));
          }
        }

        // Real-Time Socket.IO Notifications
        emitToStore(store._id, SOCKET_EVENTS.SELLER_ORDER_NEW, {
          orderId: createdOrder._id,
          orderNumber: createdOrder.orderNumber,
          storeId: store._id,
          finalTotal: createdOrder.pricingSummary?.finalTotal || 0,
          itemCount: createdOrder.items?.length || 0,
          fulfillmentType: createdOrder.fulfillmentType,
          createdAt: createdOrder.createdAt,
        });

        emitToUser(customerId, SOCKET_EVENTS.CUSTOMER_ORDER_STATUS, {
          orderId: createdOrder._id,
          orderNumber: createdOrder.orderNumber,
          status: createdOrder.status,
          storeId: store._id,
          note: 'Order placed successfully',
          updatedAt: createdOrder.createdAt,
        });
      }
    } catch (notifErr) {
      console.error('[Notification] Error dispatching order notifications:', notifErr);
    }

    return createdOrder;
  } catch (error) {
    if (session) {
      await session.abortTransaction();
    } else {
      // Manual Compensation Rollback for standalone MongoDB
      for (const ded of reservedDeductions) {
        await Batch.findByIdAndUpdate(ded.batchId, {
          $inc: {
            quantity: ded.quantity,
            soldQuantity: -ded.quantity,
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

/**
 * 2. Get Customer Order History (with status filter and pagination).
 */
export const getCustomerOrdersService = async (customerId, query = {}) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 10));
  const skip = (page - 1) * limit;

  const filter = { customerId };
  if (query.status && Object.values(ORDER_STATUS).includes(query.status)) {
    filter.status = query.status;
  }

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate('storeId', 'storeName slug address contactPhone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Order.countDocuments(filter),
  ]);

  return {
    orders,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * 3. Get Seller's Store Orders.
 */
export const getSellerOrdersService = async (sellerUser, query = {}) => {
  let store = await Store.findOne({ ownerId: sellerUser._id }).lean();
  if (!store) {
    store = await ensureSellerStore(sellerUser);
  }
  if (!store) {
    throw new ApiError(404, 'Store not found for this seller.', 'STORE_NOT_FOUND');
  }

  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 10));
  const skip = (page - 1) * limit;

  const filter = { storeId: store._id };
  if (query.status && Object.values(ORDER_STATUS).includes(query.status)) {
    filter.status = query.status;
  }

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate('customerId', 'name email phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Order.countDocuments(filter),
  ]);

  return {
    store: {
      _id: store._id,
      storeName: store.storeName,
    },
    orders,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * 4. Get Detailed Order Information by ID.
 * Accessible by owning customer, fulfilling seller, or admin.
 */
export const getOrderByIdService = async (orderId, requesterUser) => {
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    throw new ApiError(400, 'Invalid Order ID format.', 'INVALID_ORDER_ID');
  }

  const order = await Order.findById(orderId)
    .populate('storeId', 'storeName slug address contactPhone ownerId')
    .populate('customerId', 'name email phone')
    .lean();

  if (!order) {
    throw new ApiError(404, 'Order not found.', 'ORDER_NOT_FOUND');
  }

  // Authorization Check
  if (requesterUser.role === USER_ROLES.CUSTOMER) {
    if (order.customerId._id.toString() !== requesterUser._id.toString()) {
      throw new ApiError(403, 'Forbidden: You cannot view orders placed by other customers.', 'FORBIDDEN');
    }
  } else if (requesterUser.role === USER_ROLES.SELLER) {
    if (order.storeId.ownerId?.toString() !== requesterUser._id.toString()) {
      throw new ApiError(403, 'Forbidden: You can only view orders placed at your store.', 'FORBIDDEN');
    }
  }

  return order;
};

/**
 * 5. Order Tracking Timeline.
 */
export const trackOrderService = async (orderId, requesterUser) => {
  const order = await getOrderByIdService(orderId, requesterUser);

  return {
    orderNumber: order.orderNumber,
    status: order.status,
    fulfillmentType: order.fulfillmentType,
    deliveryAddress: order.deliveryAddress,
    store: {
      storeName: order.storeId.storeName,
      address: order.storeId.address,
      contactPhone: order.storeId.contactPhone,
    },
    statusTimeline: order.statusTimeline,
    pricingSummary: order.pricingSummary,
    itemCount: order.items.length,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
};

/**
 * 6. Update Order Status (Seller / Admin Workflow).
 * Enforces valid state machine transitions:
 * PLACED -> CONFIRMED -> PACKED -> READY_FOR_PICKUP / OUT_FOR_DELIVERY -> DELIVERED.
 */
export const updateOrderStatusService = async (orderId, newStatus, userActor, note = '') => {
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    throw new ApiError(400, 'Invalid Order ID format.', 'INVALID_ORDER_ID');
  }

  const order = await Order.findById(orderId).populate('storeId', 'ownerId storeName');
  if (!order) {
    throw new ApiError(404, 'Order not found.', 'ORDER_NOT_FOUND');
  }

  // Check role ownership
  if (userActor.role === USER_ROLES.SELLER) {
    if (order.storeId.ownerId?.toString() !== userActor._id.toString()) {
      throw new ApiError(403, 'Forbidden: You can only manage orders for your own store.', 'FORBIDDEN');
    }
  }

  const currentStatus = order.status;

  if (currentStatus === ORDER_STATUS.CANCELLED || currentStatus === ORDER_STATUS.DELIVERED) {
    throw new ApiError(
      400,
      `Cannot change status of an order that is already ${currentStatus}.`,
      'ORDER_FINALIZED'
    );
  }

  const validTransitions = {
    [ORDER_STATUS.PLACED]: [ORDER_STATUS.CONFIRMED, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.CONFIRMED]: [ORDER_STATUS.PACKED, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.PACKED]: [
      ORDER_STATUS.READY_FOR_PICKUP,
      ORDER_STATUS.OUT_FOR_DELIVERY,
      ORDER_STATUS.CANCELLED,
    ],
    [ORDER_STATUS.READY_FOR_PICKUP]: [ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.OUT_FOR_DELIVERY]: [ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED],
  };

  const allowedNext = validTransitions[currentStatus] || [];
  if (!allowedNext.includes(newStatus)) {
    throw new ApiError(
      400,
      `Invalid status transition from [${currentStatus}] to [${newStatus}]. Allowed transitions: ${allowedNext.join(', ') || 'none'}.`,
      'INVALID_STATUS_TRANSITION'
    );
  }

  order.status = newStatus;
  order.statusTimeline.push({
    status: newStatus,
    timestamp: new Date(),
    updatedBy: userActor._id,
    updatedByRole: userActor.role,
    note: note || `Order status updated to ${newStatus} by ${userActor.role}`,
  });

  await order.save();

  // Trigger Asynchronous Customer Notification
  try {
    const store = order.storeId || (await Store.findById(order.storeId).lean());
    if (newStatus === ORDER_STATUS.READY_FOR_PICKUP) {
      notifyCustomerPickupReady({
        customerId: order.customerId,
        order,
        store,
      }).catch((err) => console.error('[Notification] Pickup readiness notify error:', err));
    } else {
      notifyCustomerOrderStatus({
        customerId: order.customerId,
        order,
        newStatus,
        store,
      }).catch((err) => console.error('[Notification] Order status update notify error:', err));
    }

    // Automatically generate Bill Receipt & dispatch email when delivered
    if (newStatus === ORDER_STATUS.DELIVERED) {
      generateBillReceiptService(order._id, {
        verifiedBy: userActor.name || userActor.email,
      }).catch((billErr) => console.error('[Billing] Order delivery bill generation error:', billErr));
    }

    // Real-Time Socket.IO Notification to Customer
    emitToUser(order.customerId, SOCKET_EVENTS.CUSTOMER_ORDER_STATUS, {
      orderId: order._id,
      orderNumber: order.orderNumber,
      status: newStatus,
      storeId: store?._id || order.storeId,
      note: note || `Order status updated to ${newStatus}`,
      updatedAt: new Date().toISOString(),
    });
  } catch (notifErr) {
    console.error('[Notification] Error dispatching status update notification:', notifErr);
  }

  return order;
};

/**
 * 7. Cancel Order with BR-05 Expiry-Aware Inventory Restock.
 *
 * BR-05 RULE:
 * - If order is cancelled and allocated batch still has expiryDate >= today:
 *   Stock returns to Batch.quantity (sellable stock restored).
 * - If batch expired while the order was open:
 *   Stock moves to Batch.expiredQuantity and is NEVER re-listed.
 */
export const cancelOrderService = async (orderId, userActor, reason) => {
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    throw new ApiError(400, 'Invalid Order ID format.', 'INVALID_ORDER_ID');
  }

  const order = await Order.findById(orderId).populate('storeId', 'ownerId storeName');
  if (!order) {
    throw new ApiError(404, 'Order not found.', 'ORDER_NOT_FOUND');
  }

  // Authorization & Cancellation Window
  if (userActor.role === USER_ROLES.CUSTOMER) {
    if (order.customerId.toString() !== userActor._id.toString()) {
      throw new ApiError(403, 'Forbidden: You cannot cancel orders placed by other customers.', 'FORBIDDEN');
    }
    // Customer can only cancel before packing has started
    if (![ORDER_STATUS.PLACED, ORDER_STATUS.CONFIRMED].includes(order.status)) {
      throw new ApiError(
        400,
        `Order cannot be cancelled in status [${order.status}]. Packing or dispatch has already started.`,
        'CANCELLATION_WINDOW_CLOSED'
      );
    }
  } else if (userActor.role === USER_ROLES.SELLER) {
    if (order.storeId.ownerId?.toString() !== userActor._id.toString()) {
      throw new ApiError(403, 'Forbidden: You can only cancel orders placed at your store.', 'FORBIDDEN');
    }
    if ([ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED].includes(order.status)) {
      throw new ApiError(400, `Order is already ${order.status}.`, 'ORDER_ALREADY_FINALIZED');
    }
  }

  const todayUtc = new Date(toCalendarDayEpochUTC(new Date()));
  const restockedBatches = [];

  // Execute Expiry-Aware Restock Rule across all allocated batches
  for (const item of order.items) {
    for (const alloc of item.batchAllocations) {
      const batch = await Batch.findById(alloc.batchId);
      if (!batch) continue;

      const isStillFresh = new Date(batch.expiryDate) >= todayUtc;

      if (isStillFresh) {
        // Return to active sellable stock
        const previousQty = batch.quantity;
        const newQty = previousQty + alloc.allocatedQuantity;
        const newStatus = computeBatchStatus(batch.remainingDays, newQty);
        const newPurchasable = isBatchPurchasable(batch.remainingDays, newQty, newStatus);

        await Batch.findByIdAndUpdate(batch._id, {
          $inc: {
            quantity: alloc.allocatedQuantity,
            soldQuantity: -alloc.allocatedQuantity,
          },
          $set: {
            status: newStatus,
            isPurchasable: newPurchasable,
          },
        });

        await InventoryAudit.create({
          batchId: batch._id,
          productId: item.productId,
          storeId: order.storeId._id,
          batchNumber: batch.batchNumber,
          actionType: INVENTORY_ACTION_TYPES.STOCK_ADJUSTMENT,
          quantityChange: alloc.allocatedQuantity,
          previousQuantity: previousQty,
          newQuantity: newQty,
          previousReserved: 0,
          newReserved: 0,
          batchStatusAfter: newStatus,
          referenceId: order.orderNumber,
          reason: `Order [${order.orderNumber}] cancelled: Stock restored to active inventory lot`,
          performedBy: userActor._id,
          performedByRole: userActor.role,
        });

        restockedBatches.push({
          batchId: batch._id,
          batchNumber: batch.batchNumber,
          quantity: alloc.allocatedQuantity,
          action: 'RESTOCKED_ACTIVE',
        });
      } else {
        // Batch expired during order lifetime: write off directly to expiredQuantity
        await Batch.findByIdAndUpdate(batch._id, {
          $inc: {
            expiredQuantity: alloc.allocatedQuantity,
            soldQuantity: -alloc.allocatedQuantity,
          },
          $set: {
            status: BATCH_STATUS.EXPIRED,
            isPurchasable: false,
          },
        });

        await InventoryAudit.create({
          batchId: batch._id,
          productId: item.productId,
          storeId: order.storeId._id,
          batchNumber: batch.batchNumber,
          actionType: INVENTORY_ACTION_TYPES.EXPIRED_WRITE_OFF,
          quantityChange: alloc.allocatedQuantity,
          previousQuantity: batch.quantity,
          newQuantity: batch.quantity,
          previousReserved: 0,
          newReserved: 0,
          batchStatusAfter: BATCH_STATUS.EXPIRED,
          referenceId: order.orderNumber,
          reason: `Order [${order.orderNumber}] cancelled: Lot expired while order was open (written off)`,
          performedBy: userActor._id,
          performedByRole: userActor.role,
        });

        restockedBatches.push({
          batchId: batch._id,
          batchNumber: batch.batchNumber,
          quantity: alloc.allocatedQuantity,
          action: 'WRITTEN_OFF_EXPIRED',
        });
      }
    }
  }

  order.status = ORDER_STATUS.CANCELLED;
  order.cancellation = {
    cancelledBy: userActor._id,
    cancelledByRole: userActor.role,
    reason: reason || 'Order cancelled by user',
    cancelledAt: new Date(),
    stockRestored: true,
    restockedBatches,
  };

  order.statusTimeline.push({
    status: ORDER_STATUS.CANCELLED,
    timestamp: new Date(),
    updatedBy: userActor._id,
    updatedByRole: userActor.role,
    note: `Order cancelled. Reason: ${reason}`,
  });

  await order.save();

  // Real-Time Socket.IO Notifications
  try {
    emitToUser(order.customerId, SOCKET_EVENTS.CUSTOMER_ORDER_STATUS, {
      orderId: order._id,
      orderNumber: order.orderNumber,
      status: ORDER_STATUS.CANCELLED,
      storeId: order.storeId?._id || order.storeId,
      note: `Order cancelled. Reason: ${reason}`,
      updatedAt: new Date().toISOString(),
    });

    emitToStore(order.storeId?._id || order.storeId, SOCKET_EVENTS.CUSTOMER_ORDER_STATUS, {
      orderId: order._id,
      orderNumber: order.orderNumber,
      status: ORDER_STATUS.CANCELLED,
      storeId: order.storeId?._id || order.storeId,
      note: `Order cancelled. Reason: ${reason}`,
      updatedAt: new Date().toISOString(),
    });

    if (restockedBatches && restockedBatches.length > 0) {
      for (const b of restockedBatches) {
        emitToStore(order.storeId?._id || order.storeId, SOCKET_EVENTS.INVENTORY_CHANGED, {
          batchId: b.batchId,
          productId: b.productId,
          storeId: order.storeId?._id || order.storeId,
          batchNumber: b.batchNumber,
          quantity: b.newQuantity,
          restockedQuantity: b.restockedQuantity,
          status: b.isExpired ? 'EXPIRED' : 'RESTOCKED',
          changeType: 'ORDER_CANCELLATION_RESTOCK',
          timestamp: new Date().toISOString(),
        });
      }
    }
  } catch (sockErr) {
    console.error('[Socket.IO] Error emitting order cancellation events:', sockErr);
  }

  return order;
};
