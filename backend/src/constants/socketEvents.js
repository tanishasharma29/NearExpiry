/**
 * NearExpiry Socket.IO Central Event Contract.
 *
 * Defines strictly typed, documented event names and room formats
 * across customer, seller, and administrator notification channels.
 */

export const SOCKET_EVENTS = Object.freeze({
  // 1. Seller Events
  SELLER_ORDER_NEW: 'seller:order:new',

  // 2. Customer Events
  CUSTOMER_ORDER_STATUS: 'customer:order:status',

  // 3. Inventory & Batch Events
  INVENTORY_CHANGED: 'inventory:changed',

  // 4. Administrator Alerts
  ADMIN_ALERT: 'admin:alert',

  // 5. Generic User In-App Notification Delivery
  NOTIFICATION_NEW: 'notification:new',
});

export const SOCKET_ROOMS = Object.freeze({
  user: (userId) => `user:${String(userId)}`,
  store: (storeId) => `store:${String(storeId)}`,
  ADMIN: 'admin',
});

