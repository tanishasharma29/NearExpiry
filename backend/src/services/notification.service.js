import mongoose from 'mongoose';
import { Notification, NOTIFICATION_TYPES } from '../models/notification.model.js';
import { User, USER_ROLES } from '../models/user.model.js';
import { defaultDispatcher } from './notification/notification.dispatcher.js';
import { ApiError } from '../utils/ApiError.js';

const toDateBucket = (date = new Date()) => date.toISOString().slice(0, 10);

/**
 * High-Level Notification Service.
 * Implements business event notifiers and user inbox management.
 */

// ==========================================
// 1. SELLER NOTIFICATIONS
// ==========================================

export const notifySellerApproachingExpiry = async ({
  sellerId,
  batch,
  product,
  store,
  remainingDays,
  discountPercentage,
  currentPrice,
}) => {
  const seller = await User.findById(sellerId).lean();
  if (!seller) return null;

  const dedupKey = `APPROACHING_EXPIRY:${batch._id}:${remainingDays <= 15 ? 'TIER_15' : 'TIER_30'}:${toDateBucket()}`;

  return defaultDispatcher.dispatch({
    recipient: seller._id,
    recipientEmail: seller.email,
    recipientRole: USER_ROLES.SELLER,
    type: NOTIFICATION_TYPES.APPROACHING_EXPIRY,
    title: `Approaching Expiry: ${batch.batchNumber} (${remainingDays} Days Left)`,
    message: `Batch [${batch.batchNumber}] of "${product.name}" at ${store.storeName} has ${remainingDays} days remaining. Dynamic discount updated to ${discountPercentage}% (₹${currentPrice}).`,
    data: {
      batchId: batch._id,
      batchNumber: batch.batchNumber,
      productId: product._id,
      productName: product.name,
      storeId: store._id,
      storeName: store.storeName,
      remainingDays,
      discountPercentage,
      currentPrice,
    },
    dedupKey,
  });
};

export const notifySellerCriticalExpiry = async ({
  sellerId,
  batch,
  product,
  store,
  remainingDays,
  discountPercentage,
  currentPrice,
}) => {
  const seller = await User.findById(sellerId).lean();
  if (!seller) return null;

  const dedupKey = `CRITICAL_EXPIRY:${batch._id}:${toDateBucket()}`;

  return defaultDispatcher.dispatch({
    recipient: seller._id,
    recipientEmail: seller.email,
    recipientRole: USER_ROLES.SELLER,
    type: NOTIFICATION_TYPES.CRITICAL_EXPIRY,
    title: `URGENT: Critical Expiry for Batch ${batch.batchNumber} (${remainingDays}d left)`,
    message: `Batch [${batch.batchNumber}] of "${product.name}" has entered the critical expiry window (${remainingDays} day(s) left, ${batch.quantity} units unsold). Maximum rescue discount of ${discountPercentage}% (₹${currentPrice}) is applied.`,
    data: {
      batchId: batch._id,
      batchNumber: batch.batchNumber,
      productId: product._id,
      productName: product.name,
      storeId: store._id,
      storeName: store.storeName,
      remainingDays,
      quantity: batch.quantity,
      discountPercentage,
      currentPrice,
    },
    dedupKey,
  });
};

export const notifySellerExpiredInventory = async ({ sellerId, batch, product, store }) => {
  const seller = await User.findById(sellerId).lean();
  if (!seller) return null;

  const dedupKey = `EXPIRED_INVENTORY:${batch._id}`;

  return defaultDispatcher.dispatch({
    recipient: seller._id,
    recipientEmail: seller.email,
    recipientRole: USER_ROLES.SELLER,
    type: NOTIFICATION_TYPES.EXPIRED_INVENTORY,
    title: `Batch Expired & Locked: ${batch.batchNumber}`,
    message: `Batch [${batch.batchNumber}] of "${product.name}" has crossed its expiry date and was automatically delisted from customer sale to ensure food safety compliance.`,
    data: {
      batchId: batch._id,
      batchNumber: batch.batchNumber,
      productId: product._id,
      productName: product.name,
      storeId: store._id,
      storeName: store.storeName,
      quantity: batch.quantity,
      expiryDate: batch.expiryDate,
    },
    dedupKey,
  });
};

export const notifySellerLowStock = async ({ sellerId, batch, product, store, quantity }) => {
  const seller = await User.findById(sellerId).lean();
  if (!seller) return null;

  const dedupKey = `LOW_STOCK:${batch._id}:${quantity}:${toDateBucket()}`;

  return defaultDispatcher.dispatch({
    recipient: seller._id,
    recipientEmail: seller.email,
    recipientRole: USER_ROLES.SELLER,
    type: NOTIFICATION_TYPES.LOW_STOCK,
    title: `Low Stock Alert: ${batch.batchNumber} (${quantity} Units Left)`,
    message: `Batch lot [${batch.batchNumber}] for "${product.name}" at ${store.storeName} is running low on stock (${quantity} units remaining).`,
    data: {
      batchId: batch._id,
      batchNumber: batch.batchNumber,
      productId: product._id,
      productName: product.name,
      storeId: store._id,
      storeName: store.storeName,
      remainingQuantity: quantity,
    },
    dedupKey,
  });
};

export const notifySellerNewOrder = async ({ sellerId, order, store }) => {
  const seller = await User.findById(sellerId).lean();
  if (!seller) return null;

  const dedupKey = `NEW_ORDER:${order._id}:${sellerId}`;

  return defaultDispatcher.dispatch({
    recipient: seller._id,
    recipientEmail: seller.email,
    recipientRole: USER_ROLES.SELLER,
    type: NOTIFICATION_TYPES.NEW_ORDER,
    title: `New Order Received: ${order.orderNumber}`,
    message: `You have received a new order ${order.orderNumber} for total ₹${order.pricingSummary?.finalTotal || 0}. Fulfillment: ${order.fulfillmentType}.`,
    data: {
      orderId: order._id,
      orderNumber: order.orderNumber,
      storeId: store._id,
      storeName: store.storeName,
      fulfillmentType: order.fulfillmentType,
      itemCount: order.items?.length || 0,
      finalTotal: order.pricingSummary?.finalTotal || 0,
    },
    dedupKey,
    actionText: 'View Order',
    actionUrl: `https://nearexpiry.app/seller/orders/${order._id}`,
  });
};

export const notifySellerStoreApproved = async ({ sellerId, storeName }) => {
  const seller = await User.findById(sellerId).lean();
  if (!seller) return null;

  const dedupKey = `STORE_APPROVED:${seller._id}`;

  return defaultDispatcher.dispatch({
    recipient: seller._id,
    recipientEmail: seller.email,
    recipientRole: USER_ROLES.SELLER,
    type: NOTIFICATION_TYPES.STORE_APPROVED,
    title: 'Your Store Has Been Approved',
    message:
      'Congratulations! Your store has been approved. You can now access the store-management features available to your account.',
    data: {
      sellerId: seller._id,
      storeName: storeName || 'Your Store',
      status: 'APPROVED',
    },
    dedupKey,
    actionText: 'Access Store Dashboard',
    actionUrl: 'https://nearexpiry.app/seller/dashboard',
  });
};

export const notifySellerStoreRejected = async ({ sellerId, storeName, rejectionReason }) => {
  const seller = await User.findById(sellerId).lean();
  if (!seller) return null;

  const safeReason = rejectionReason ? rejectionReason.trim() : null;
  const dedupKey = `STORE_REJECTED:${seller._id}:${safeReason || 'default'}`;

  const message = safeReason
    ? `Your store application has been rejected: ${safeReason}. Please review your application status and contact support if you need clarification.`
    : 'Your store application has been rejected. Please review your application status and contact support if you need clarification.';

  return defaultDispatcher.dispatch({
    recipient: seller._id,
    recipientEmail: seller.email,
    recipientRole: USER_ROLES.SELLER,
    type: NOTIFICATION_TYPES.STORE_REJECTED,
    title: 'Store Application Update',
    message,
    data: {
      sellerId: seller._id,
      storeName: storeName || 'Your Store',
      status: 'REJECTED',
      rejectionReason: safeReason,
    },
    dedupKey,
    actionText: 'Review Application',
    actionUrl: 'https://nearexpiry.app/seller/dashboard',
  });
};

// ==========================================
// 2. CUSTOMER NOTIFICATIONS
// ==========================================

export const notifyCustomerOrderConfirmed = async ({ customerId, order, store }) => {
  const customer = await User.findById(customerId).lean();
  if (!customer) return null;

  const dedupKey = `ORDER_CONFIRMED:${order._id}`;

  return defaultDispatcher.dispatch({
    recipient: customer._id,
    recipientEmail: customer.email,
    recipientRole: USER_ROLES.CUSTOMER,
    type: NOTIFICATION_TYPES.ORDER_CONFIRMED,
    title: `Order Confirmed: ${order.orderNumber}`,
    message: `Thank you for your order! Your near-expiry rescue order ${order.orderNumber} has been received by ${store.storeName}. Total: ₹${order.pricingSummary?.finalTotal || 0}.`,
    data: {
      orderId: order._id,
      orderNumber: order.orderNumber,
      storeId: store._id,
      storeName: store.storeName,
      fulfillmentType: order.fulfillmentType,
      finalTotal: order.pricingSummary?.finalTotal || 0,
      totalSavings: order.pricingSummary?.totalSavings || 0,
    },
    dedupKey,
    actionText: 'Track Order',
    actionUrl: `https://nearexpiry.app/orders/${order._id}/track`,
  });
};

export const notifyCustomerOrderStatus = async ({ customerId, order, newStatus, store }) => {
  const customer = await User.findById(customerId).lean();
  if (!customer) return null;

  const dedupKey = `ORDER_STATUS:${order._id}:${newStatus}`;

  return defaultDispatcher.dispatch({
    recipient: customer._id,
    recipientEmail: customer.email,
    recipientRole: USER_ROLES.CUSTOMER,
    type: NOTIFICATION_TYPES.ORDER_STATUS_UPDATE,
    title: `Order ${order.orderNumber} is ${newStatus}`,
    message: `Your order ${order.orderNumber} status has changed to ${newStatus} at ${store.storeName}.`,
    data: {
      orderId: order._id,
      orderNumber: order.orderNumber,
      status: newStatus,
      storeId: store._id,
      storeName: store.storeName,
    },
    dedupKey,
    actionText: 'View Status',
    actionUrl: `https://nearexpiry.app/orders/${order._id}/track`,
  });
};

export const notifyCustomerPickupReady = async ({ customerId, order, store }) => {
  const customer = await User.findById(customerId).lean();
  if (!customer) return null;

  const dedupKey = `PICKUP_READINESS:${order._id}`;

  const street = store.address?.street || 'Store Counter';
  const city = store.address?.city || '';

  return defaultDispatcher.dispatch({
    recipient: customer._id,
    recipientEmail: customer.email,
    recipientRole: USER_ROLES.CUSTOMER,
    type: NOTIFICATION_TYPES.PICKUP_READINESS,
    title: `Ready for Pickup: Order ${order.orderNumber}`,
    message: `Your order ${order.orderNumber} is packed and ready for pickup at ${store.storeName} (${street}, ${city}).`,
    data: {
      orderId: order._id,
      orderNumber: order.orderNumber,
      storeId: store._id,
      storeName: store.storeName,
      pickupAddress: store.address,
      contactPhone: store.contactPhone,
    },
    dedupKey,
    actionText: 'Get Pickup Directions',
    actionUrl: `https://nearexpiry.app/orders/${order._id}/pickup`,
  });
};

export const notifyCustomerWishlistDiscount = async ({
  customerId,
  product,
  discountPercentage,
  currentPrice,
  store,
}) => {
  const customer = await User.findById(customerId).lean();
  if (!customer) return null;

  const dedupKey = `WISHLIST_DISCOUNT:${customerId}:${product._id}:${discountPercentage}:${toDateBucket()}`;

  return defaultDispatcher.dispatch({
    recipient: customer._id,
    recipientEmail: customer.email,
    recipientRole: USER_ROLES.CUSTOMER,
    type: NOTIFICATION_TYPES.WISHLIST_DISCOUNT,
    title: `Price Drop on your Wishlist: ${product.name}`,
    message: `Great news! "${product.name}" at ${store.storeName} now has a ${discountPercentage}% discount (Now ₹${currentPrice}). Grab it before it sells out!`,
    data: {
      productId: product._id,
      productName: product.name,
      storeId: store._id,
      storeName: store.storeName,
      discountPercentage,
      currentPrice,
    },
    dedupKey,
    actionText: 'View Deal',
    actionUrl: `https://nearexpiry.app/products/${product._id}`,
  });
};

export const notifyCustomerWishlistAvailability = async ({
  customerId,
  product,
  batch,
  store,
}) => {
  const customer = await User.findById(customerId).lean();
  if (!customer) return null;

  const dedupKey = `WISHLIST_AVAILABILITY:${customerId}:${product._id}:${toDateBucket()}`;

  return defaultDispatcher.dispatch({
    recipient: customer._id,
    recipientEmail: customer.email,
    recipientRole: USER_ROLES.CUSTOMER,
    type: NOTIFICATION_TYPES.WISHLIST_AVAILABILITY,
    title: `Back in Stock: ${product.name}`,
    message: `Good news! "${product.name}" is back in stock at ${store.storeName} (Batch lot ${batch.batchNumber}).`,
    data: {
      productId: product._id,
      productName: product.name,
      batchId: batch._id,
      batchNumber: batch.batchNumber,
      storeId: store._id,
      storeName: store.storeName,
      currentPrice: batch.currentPrice,
    },
    dedupKey,
    actionText: 'Shop Now',
    actionUrl: `https://nearexpiry.app/products/${product._id}`,
  });
};

// ==========================================
// 3. INBOX QUERY & READ STATUS MANAGEMENT
// ==========================================

export const getUserNotificationsService = async (userId, queryParams = {}) => {
  const page = Math.max(1, parseInt(queryParams.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(queryParams.limit || '20', 10)));
  const skip = (page - 1) * limit;

  const filter = { recipient: userId };
  if (queryParams.isRead !== undefined) {
    filter.isRead = queryParams.isRead === 'true' || queryParams.isRead === true;
  }
  if (queryParams.type) {
    filter.type = queryParams.type;
  }

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ recipient: userId, isRead: false }),
  ]);

  return {
    notifications,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
      unreadCount,
    },
  };
};

export const getUnreadNotificationCountService = async (userId) => {
  const unreadCount = await Notification.countDocuments({
    recipient: userId,
    isRead: false,
  });
  return { unreadCount };
};

export const markNotificationAsReadService = async (notificationId, userId) => {
  if (!mongoose.Types.ObjectId.isValid(notificationId)) {
    throw new ApiError(400, 'Invalid notification ID format.', 'INVALID_NOTIFICATION_ID');
  }

  const notification = await Notification.findOne({
    _id: notificationId,
    recipient: userId,
  });

  if (!notification) {
    throw new ApiError(404, 'Notification not found.', 'NOTIFICATION_NOT_FOUND');
  }

  notification.isRead = true;
  notification.readAt = new Date();
  await notification.save();

  return notification;
};

export const markAllNotificationsAsReadService = async (userId) => {
  const now = new Date();
  const result = await Notification.updateMany(
    { recipient: userId, isRead: false },
    { $set: { isRead: true, readAt: now } }
  );

  return {
    modifiedCount: result.modifiedCount,
    readAt: now,
  };
};

export const deleteNotificationService = async (notificationId, userId) => {
  if (!mongoose.Types.ObjectId.isValid(notificationId)) {
    throw new ApiError(400, 'Invalid notification ID format.', 'INVALID_NOTIFICATION_ID');
  }

  const notification = await Notification.findOneAndDelete({
    _id: notificationId,
    recipient: userId,
  });

  if (!notification) {
    throw new ApiError(404, 'Notification not found.', 'NOTIFICATION_NOT_FOUND');
  }

  return { success: true, deletedId: notificationId };
};
