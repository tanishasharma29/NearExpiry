import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import mongoose from 'mongoose';
import app from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/user.model.js';
import { Store } from '../src/models/store.model.js';
import { Category } from '../src/models/category.model.js';
import { Product } from '../src/models/product.model.js';
import { Batch } from '../src/models/batch.model.js';
import { Wishlist } from '../src/models/wishlist.model.js';
import { Notification, NOTIFICATION_TYPES } from '../src/models/notification.model.js';
import {
  notifySellerApproachingExpiry,
  notifySellerCriticalExpiry,
  notifySellerExpiredInventory,
  notifySellerLowStock,
  notifySellerNewOrder,
  notifyCustomerOrderConfirmed,
  notifyCustomerOrderStatus,
  notifyCustomerPickupReady,
  notifyCustomerWishlistDiscount,
  notifyCustomerWishlistAvailability,
} from '../src/services/notification.service.js';
import { getSentEmails, clearSentEmails } from '../src/services/notification/email.channel.js';
import { resetDefaultPriceRulesService } from '../src/services/priceRule.service.js';

describe('NearExpiry Multi-Channel Notification Module Test Suite', () => {
  let server;
  let baseUrl;
  let adminToken;
  let sellerToken;
  let customerToken;
  let otherCustomerToken;
  let sellerUser;
  let customerUser;
  let storeId;
  let storeDoc;
  let categoryId;
  let productId;
  let batchId;
  let batchDoc;
  let ts;

  before(async () => {
    await connectDB();

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}/api/v1`;

    ts = Date.now().toString().slice(-6);

    // 1. Admin
    const adminRes = await fetch(`${baseUrl}/auth/register/admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Notification Admin',
        email: `notif.admin.${ts}@nearexpiry.test`,
        phone: '9876550001',
        password: 'Password123!',
      }),
    });
    adminToken = (await adminRes.json()).data.token;
    await resetDefaultPriceRulesService(null);

    // 2. Seller
    const sRes = await fetch(`${baseUrl}/auth/register/seller`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Notification Seller',
        email: `notif.seller.${ts}@nearexpiry.test`,
        phone: '9876550002',
        password: 'Password123!',
        storeName: `FreshRescue SuperStore ${ts}`,
      }),
    });
    const sData = await sRes.json();
    sellerToken = sData.data.token;
    sellerUser = sData.data.user;

    const stRes = await fetch(`${baseUrl}/stores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
      body: JSON.stringify({
        storeName: `FreshRescue SuperStore ${ts}`,
        contactPhone: '9876550002',
        address: { street: '12th Main Indiranagar', city: 'Bengaluru', state: 'Karnataka', pincode: '560038' },
        latitude: 12.9716,
        longitude: 77.5946,
      }),
    });
    storeId = (await stRes.json()).data.store._id;
    await Store.findByIdAndUpdate(storeId, { verificationStatus: 'APPROVED', isActive: true });
    storeDoc = await Store.findById(storeId).lean();

    // 3. Customer 1
    const cRes = await fetch(`${baseUrl}/auth/register/customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Notification Customer',
        email: `notif.customer.${ts}@nearexpiry.test`,
        phone: '9876550003',
        password: 'Password123!',
      }),
    });
    const cData = await cRes.json();
    customerToken = cData.data.token;
    customerUser = cData.data.user;

    // 4. Customer 2
    const c2Res = await fetch(`${baseUrl}/auth/register/customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Other Shopper',
        email: `other.shopper.${ts}@nearexpiry.test`,
        phone: '9876550004',
        password: 'Password123!',
      }),
    });
    otherCustomerToken = (await c2Res.json()).data.token;

    // 5. Category & Product
    const catRes = await fetch(`${baseUrl}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: `Notif Dairy Category ${ts}`, status: 'ACTIVE' }),
    });
    categoryId = (await catRes.json()).data.category._id;

    const pRes = await fetch(`${baseUrl}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
      body: JSON.stringify({
        name: `Organic Almond Milk ${ts}`,
        description: 'Unsweetened plant milk 1L',
        brand: 'RawPressery',
        category: categoryId,
        unit: 'bottle',
      }),
    });
    productId = (await pRes.json()).data.product._id;

    // 6. Batch (expires in 12 days -> approaching expiry)
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 12);

    const bRes = await fetch(`${baseUrl}/batches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
      body: JSON.stringify({
        productId,
        batchNumber: `NOTIF-B-${ts}`,
        manufacturingDate: '2026-09-01T00:00:00.000Z',
        expiryDate: futureDate.toISOString(),
        quantity: 15,
        originalPrice: 200,
      }),
    });
    batchId = (await bRes.json()).data.batch._id;
    batchDoc = await Batch.findById(batchId).lean();
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await disconnectDB();
  });

  beforeEach(() => {
    clearSentEmails();
  });

  describe('1. Seller Notification Events', () => {
    it('should dispatch APPROACHING_EXPIRY notification to seller via MongoDB and Nodemailer', async () => {
      const result = await notifySellerApproachingExpiry({
        sellerId: sellerUser._id,
        batch: batchDoc,
        product: { _id: productId, name: `Organic Almond Milk ${ts}` },
        store: storeDoc,
        remainingDays: 12,
        discountPercentage: 40,
        currentPrice: 120,
      });

      assert.equal(result.isDuplicate, false);
      assert.ok(result.notification, 'Notification document must be created');
      assert.equal(result.notification.type, NOTIFICATION_TYPES.APPROACHING_EXPIRY);
      assert.equal(result.notification.recipient.toString(), sellerUser._id.toString());
      assert.ok(result.notification.title.includes('Approaching Expiry'));

      // Verify email channel delivery
      const emails = getSentEmails();
      assert.equal(emails.length, 1);
      assert.equal(emails[0].to, sellerUser.email);
      assert.ok(emails[0].subject.includes('Approaching Expiry'));
      assert.ok(emails[0].html.includes('NearExpiry'));
    });

    it('should dispatch CRITICAL_EXPIRY notification to seller', async () => {
      const result = await notifySellerCriticalExpiry({
        sellerId: sellerUser._id,
        batch: batchDoc,
        product: { _id: productId, name: `Organic Almond Milk ${ts}` },
        store: storeDoc,
        remainingDays: 2,
        discountPercentage: 75,
        currentPrice: 50,
      });

      assert.equal(result.isDuplicate, false);
      assert.equal(result.notification.type, NOTIFICATION_TYPES.CRITICAL_EXPIRY);
      assert.ok(result.notification.title.includes('Critical Expiry'));
      assert.equal(getSentEmails().length, 1);
    });

    it('should dispatch EXPIRED_INVENTORY notification to seller', async () => {
      const result = await notifySellerExpiredInventory({
        sellerId: sellerUser._id,
        batch: batchDoc,
        product: { _id: productId, name: `Organic Almond Milk ${ts}` },
        store: storeDoc,
      });

      assert.equal(result.isDuplicate, false);
      assert.equal(result.notification.type, NOTIFICATION_TYPES.EXPIRED_INVENTORY);
      assert.ok(result.notification.message.includes('delisted'));
    });

    it('should dispatch LOW_STOCK alert to seller', async () => {
      const result = await notifySellerLowStock({
        sellerId: sellerUser._id,
        batch: batchDoc,
        product: { _id: productId, name: `Organic Almond Milk ${ts}` },
        store: storeDoc,
        quantity: 3,
      });

      assert.equal(result.isDuplicate, false);
      assert.equal(result.notification.type, NOTIFICATION_TYPES.LOW_STOCK);
      assert.ok(result.notification.title.includes('Low Stock Alert'));
    });

    it('should dispatch NEW_ORDER notification to seller when an order is received', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const fakeOrder = {
        _id: fakeId,
        orderNumber: `NE-${ts}-${fakeId.slice(-4)}`,
        fulfillmentType: 'PICKUP',
        pricingSummary: { finalTotal: 360 },
        items: [{ productName: 'Organic Almond Milk', quantity: 3 }],
      };

      const result = await notifySellerNewOrder({
        sellerId: sellerUser._id,
        order: fakeOrder,
        store: storeDoc,
      });

      assert.equal(result.isDuplicate, false);
      assert.equal(result.notification.type, NOTIFICATION_TYPES.NEW_ORDER);
      assert.ok(result.notification.title.includes(fakeOrder.orderNumber));
    });
  });

  describe('2. Customer Notification Events', () => {
    it('should dispatch ORDER_CONFIRMED notification to customer', async () => {
      const ordId = new mongoose.Types.ObjectId().toString();
      const mockOrder = {
        _id: ordId,
        orderNumber: `NE-${ts}-${ordId.slice(-4)}`,
        fulfillmentType: 'PICKUP',
        pricingSummary: { finalTotal: 240, totalSavings: 160 },
      };

      const result = await notifyCustomerOrderConfirmed({
        customerId: customerUser._id,
        order: mockOrder,
        store: storeDoc,
      });

      assert.equal(result.isDuplicate, false);
      assert.equal(result.notification.type, NOTIFICATION_TYPES.ORDER_CONFIRMED);
      assert.equal(result.notification.recipient.toString(), customerUser._id.toString());
      assert.ok(result.notification.title.includes('Order Confirmed'));

      const emails = getSentEmails();
      assert.equal(emails.length, 1);
      assert.equal(emails[0].to, customerUser.email);
      assert.ok(emails[0].subject.includes(mockOrder.orderNumber));
    });

    it('should dispatch ORDER_STATUS_UPDATE notification to customer', async () => {
      const ordId = new mongoose.Types.ObjectId().toString();
      const mockOrder = {
        _id: ordId,
        orderNumber: `NE-${ts}-${ordId.slice(-4)}`,
        fulfillmentType: 'PICKUP',
        pricingSummary: { finalTotal: 240, totalSavings: 160 },
      };

      const result = await notifyCustomerOrderStatus({
        customerId: customerUser._id,
        order: mockOrder,
        newStatus: 'PACKED',
        store: storeDoc,
      });

      assert.equal(result.isDuplicate, false);
      assert.equal(result.notification.type, NOTIFICATION_TYPES.ORDER_STATUS_UPDATE);
      assert.ok(result.notification.title.includes('PACKED'));
    });

    it('should dispatch PICKUP_READINESS notification to customer', async () => {
      const ordId = new mongoose.Types.ObjectId().toString();
      const mockOrder = {
        _id: ordId,
        orderNumber: `NE-${ts}-${ordId.slice(-4)}`,
        fulfillmentType: 'PICKUP',
        pricingSummary: { finalTotal: 240, totalSavings: 160 },
      };

      const result = await notifyCustomerPickupReady({
        customerId: customerUser._id,
        order: mockOrder,
        store: storeDoc,
      });

      assert.equal(result.isDuplicate, false);
      assert.equal(result.notification.type, NOTIFICATION_TYPES.PICKUP_READINESS);
      assert.ok(result.notification.title.includes('Ready for Pickup'));
      assert.ok(result.notification.message.includes('12th Main Indiranagar'));
    });

    it('should dispatch WISHLIST_DISCOUNT notification to customer when target discount is met', async () => {
      const result = await notifyCustomerWishlistDiscount({
        customerId: customerUser._id,
        product: { _id: productId, name: `Organic Almond Milk ${ts}` },
        discountPercentage: 60,
        currentPrice: 80,
        store: storeDoc,
      });

      assert.equal(result.isDuplicate, false);
      assert.equal(result.notification.type, NOTIFICATION_TYPES.WISHLIST_DISCOUNT);
      assert.ok(result.notification.title.includes('Price Drop'));
      assert.ok(result.notification.message.includes('60% discount'));
    });

    it('should dispatch WISHLIST_AVAILABILITY notification to customer when lot restocked', async () => {
      const result = await notifyCustomerWishlistAvailability({
        customerId: customerUser._id,
        product: { _id: productId, name: `Organic Almond Milk ${ts}` },
        batch: batchDoc,
        store: storeDoc,
      });

      assert.equal(result.isDuplicate, false);
      assert.equal(result.notification.type, NOTIFICATION_TYPES.WISHLIST_AVAILABILITY);
      assert.ok(result.notification.title.includes('Back in Stock'));
    });
  });

  describe('3. Deduplication Architecture', () => {
    it('should prevent duplicate notifications with identical dedupKey and drop redundant emails', async () => {
      clearSentEmails();

      const dupId = new mongoose.Types.ObjectId().toString();
      const orderPayload = {
        _id: dupId,
        orderNumber: `NE-DUP-${ts}-${dupId.slice(-4)}`,
        pricingSummary: { finalTotal: 100 },
      };

      // First dispatch
      const first = await notifyCustomerOrderConfirmed({
        customerId: customerUser._id,
        order: orderPayload,
        store: storeDoc,
      });
      assert.equal(first.isDuplicate, false);
      assert.equal(getSentEmails().length, 1);

      // Second identical dispatch (e.g. repeated cron run or duplicate webhook)
      const second = await notifyCustomerOrderConfirmed({
        customerId: customerUser._id,
        order: orderPayload,
        store: storeDoc,
      });
      assert.equal(second.isDuplicate, true, 'Second call must be flagged as duplicate');
      assert.ok(second.message.includes('Duplicate notification suppressed'));

      // Ensure no second duplicate email was sent!
      assert.equal(getSentEmails().length, 1, 'Duplicate email must NOT be dispatched');
    });
  });

  describe('4. Notification Inbox REST APIs', () => {
    let testNotificationId;

    it('should list notifications for authenticated user with unread count', async () => {
      const res = await fetch(`${baseUrl}/notifications`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${customerToken}` },
      });

      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.success, true);
      assert.ok(Array.isArray(body.data.notifications));
      assert.ok(body.data.notifications.length > 0);
      assert.ok(body.data.pagination.unreadCount > 0);

      testNotificationId = body.data.notifications[0]._id;
    });

    it('should get unread count via /notifications/unread-count', async () => {
      const res = await fetch(`${baseUrl}/notifications/unread-count`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${customerToken}` },
      });

      const body = await res.json();
      assert.equal(res.status, 200);
      assert.ok(typeof body.data.unreadCount === 'number');
      assert.ok(body.data.unreadCount > 0);
    });

    it('should mark a specific notification as read via PATCH /notifications/:id/read', async () => {
      const res = await fetch(`${baseUrl}/notifications/${testNotificationId}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${customerToken}` },
      });

      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.data.isRead, true);
      assert.ok(body.data.readAt);

      // Verify in DB
      const notifDoc = await Notification.findById(testNotificationId);
      assert.equal(notifDoc.isRead, true);
    });

    it('should mark all notifications as read via PATCH /notifications/mark-all-read', async () => {
      const res = await fetch(`${baseUrl}/notifications/mark-all-read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${customerToken}` },
      });

      const body = await res.json();
      assert.equal(res.status, 200);
      assert.ok(body.data.modifiedCount >= 0);

      // Verify unread count is now 0 for this customer
      const countRes = await fetch(`${baseUrl}/notifications/unread-count`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${customerToken}` },
      });
      const countBody = await countRes.json();
      assert.equal(countBody.data.unreadCount, 0);
    });

    it("should prevent other users from modifying someone else's notification", async () => {
      const res = await fetch(`${baseUrl}/notifications/${testNotificationId}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${otherCustomerToken}` },
      });

      const body = await res.json();
      assert.equal(res.status, 404);
      assert.equal(body.errorCode, 'NOTIFICATION_NOT_FOUND');
    });

    it('should delete/dismiss a notification via DELETE /notifications/:id', async () => {
      const res = await fetch(`${baseUrl}/notifications/${testNotificationId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${customerToken}` },
      });

      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.data.success, true);

      // Verify gone
      const deletedDoc = await Notification.findById(testNotificationId);
      assert.equal(deletedDoc, null);
    });
  });

  describe('5. End-to-End Workflow Integration', () => {
    it('should automatically trigger ORDER_CONFIRMED and NEW_ORDER notifications on real checkout', async () => {
      // Add product to cart for customer
      await fetch(`${baseUrl}/cart/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
        body: JSON.stringify({ productId, quantity: 1 }),
      });

      // Place order
      const orderRes = await fetch(`${baseUrl}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
        body: JSON.stringify({ fulfillmentType: 'PICKUP' }),
      });

      assert.equal(orderRes.status, 201);
      const orderData = (await orderRes.json()).data;

      // Small delay for async notification promises
      await new Promise((r) => setTimeout(r, 200));

      // Customer should have received ORDER_CONFIRMED
      const customerNotifs = await Notification.find({
        recipient: customerUser._id,
        type: NOTIFICATION_TYPES.ORDER_CONFIRMED,
      });
      assert.ok(customerNotifs.length >= 1, 'Customer must receive ORDER_CONFIRMED notification');
      assert.ok(
        customerNotifs.some((n) => n.data?.orderId === orderData._id || n.title.includes(orderData.orderNumber)),
        'Notification must reference the placed order'
      );

      // Seller should have received NEW_ORDER
      const sellerNotifs = await Notification.find({
        recipient: sellerUser._id,
        type: NOTIFICATION_TYPES.NEW_ORDER,
      });
      assert.ok(sellerNotifs.length >= 1, 'Seller must receive NEW_ORDER notification');
      assert.ok(
        sellerNotifs.some((n) => n.data?.orderId === orderData._id || n.title.includes(orderData.orderNumber)),
        'Seller notification must reference the placed order'
      );

      // State machine valid transitions: PLACED -> CONFIRMED -> PACKED -> READY_FOR_PICKUP
      await fetch(`${baseUrl}/orders/${orderData._id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
        body: JSON.stringify({ status: 'CONFIRMED' }),
      });

      await fetch(`${baseUrl}/orders/${orderData._id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
        body: JSON.stringify({ status: 'PACKED' }),
      });

      const updateRes = await fetch(`${baseUrl}/orders/${orderData._id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
        body: JSON.stringify({ status: 'READY_FOR_PICKUP' }),
      });
      assert.equal(updateRes.status, 200);

      await new Promise((r) => setTimeout(r, 200));

      // Customer should have received PICKUP_READINESS
      const pickupNotifs = await Notification.find({
        recipient: customerUser._id,
        type: NOTIFICATION_TYPES.PICKUP_READINESS,
      });
      assert.ok(pickupNotifs.length >= 1, 'Customer must receive PICKUP_READINESS notification');
    });
  });
});
