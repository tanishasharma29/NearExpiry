import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../../src/app.js';
import { connectTestDB, clearTestDB, disconnectTestDB } from '../setup/testDb.js';
import { User, USER_ROLES, VERIFICATION_STATUS } from '../../../src/models/user.model.js';
import { Store } from '../../../src/models/store.model.js';
import { Category } from '../../../src/models/category.model.js';
import { Product } from '../../../src/models/product.model.js';
import { Batch, BATCH_STATUS } from '../../../src/models/batch.model.js';
import { Order, ORDER_STATUS } from '../../../src/models/order.model.js';
import { Payment, PAYMENT_STATUS, PAYMENT_METHOD } from '../../../src/models/payment.model.js';
import { QrVerification, QR_STATUS } from '../../../src/models/qrVerification.model.js';
import { Notification, NOTIFICATION_TYPES } from '../../../src/models/notification.model.js';
import {
  notifyCustomerOrderConfirmed,
  notifySellerNewOrder,
} from '../../../src/services/notification.service.js';

describe('Integration Tests: Payment, QR Verification & Notifications', () => {
  let adminToken;
  let sellerToken;
  let customerToken;

  let adminUser;
  let sellerUser;
  let customerUser;
  let store;
  let product;
  let batch;
  let order;

  beforeAll(async () => {
    await connectTestDB();
    await clearTestDB();

    // 1. Seed Admin
    const adminRes = await request(app).post('/api/v1/auth/register/admin').send({
      name: 'Admin Pay',
      email: 'admin.pay@nearexpiry.com',
      password: 'AdminPassword123!',
      adminSecret: 'super-admin-root-key',
    });
    adminToken = adminRes.body.data.token;
    adminUser = adminRes.body.data.user;

    // 2. Seed Approved Seller
    const sellerRes = await request(app).post('/api/v1/auth/register/seller').send({
      name: 'Payment Seller',
      email: 'seller.pay@nearexpiry.com',
      password: 'SellerPassword123!',
      storeName: 'PayMart Express',
      businessType: 'GROCERY',
      address: {
        street: '789 Commerce Way',
        city: 'Metropolis',
        state: 'State',
        pincode: '123456',
      },
    });
    sellerToken = sellerRes.body.data.token;
    sellerUser = sellerRes.body.data.user;

    await request(app)
      .patch(`/api/v1/admin/sellers/${sellerUser._id}/approval`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'APPROVED' });

    store = await Store.findOne({ ownerId: sellerUser._id });

    // 3. Seed Customer
    const customerRes = await request(app).post('/api/v1/auth/register/customer').send({
      name: 'Paying Customer',
      email: 'customer.pay@nearexpiry.com',
      password: 'CustomerPassword123!',
    });
    customerToken = customerRes.body.data.token;
    customerUser = customerRes.body.data.user;

    // 4. Create Category
    const catRes = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Snacks & Beverages', description: 'Chips and sodas' });

    // 5. Create Product
    const prodRes = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        name: 'Gourmet Potato Chips 150g',
        description: 'Crispy salted potato chips',
        brand: 'CrispyCo',
        category: catRes.body.data.category._id,
        unit: 'pack',
        status: 'ACTIVE',
      });
    product = prodRes.body.data.product;

    // 6. Create Batch
    const now = new Date();
    batch = await Batch.create({
      productId: product._id,
      storeId: store._id,
      sellerId: sellerUser._id,
      batchNumber: 'LOT-CHIPS-101',
      manufacturingDate: new Date(now.getTime() - 10 * 86400000),
      expiryDate: new Date(now.getTime() + 10 * 86400000),
      remainingDays: 10,
      initialQuantity: 50,
      quantity: 50,
      reservedQuantity: 0,
      soldQuantity: 0,
      originalPrice: 60,
      currentPrice: 45,
      discountPercentage: 25,
      status: BATCH_STATUS.NORMAL,
      isPurchasable: true,
    });

    // 7. Customer puts 2 items in cart and places order
    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId: product._id.toString(), quantity: 2 });

    const orderRes = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ fulfillmentType: 'PICKUP' });

    order = orderRes.body.data;
  });

  afterAll(async () => {
    await clearTestDB();
    await disconnectTestDB();
  });

  // --------------------------------------------------------------------------
  // 17. PAYMENT PROCESSING, IDEMPOTENCY & REFUNDS
  // --------------------------------------------------------------------------
  describe('17. Payment Processing, Idempotency, Failure Simulation & Refunds', () => {
    let completedPaymentId;

    it('Given an active order, When customer processes payment with unique idempotencyKey, Then captures payment as SUCCESS and updates order paymentStatus to PAID', async () => {
      // Given
      const payload = {
        orderId: order._id,
        method: PAYMENT_METHOD.MOCK_PAYMENT,
        idempotencyKey: 'IDEM-PAY-TEST-0001',
        paymentDetails: {},
      };

      // When
      const res = await request(app)
        .post('/api/v1/payments/process')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(payload);

      // Then
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.payment).toBeDefined();
      expect(res.body.data.payment.status).toBe(PAYMENT_STATUS.SUCCESS);
      expect(res.body.data.payment.amount).toBe(order.pricingSummary.finalTotal);
      expect(res.body.data.payment.paidAt).toBeDefined();

      completedPaymentId = res.body.data.payment._id;

      // Verify order updated in DB
      const updatedOrder = await Order.findById(order._id);
      expect(updatedOrder.paymentStatus).toBe('PAID');
    });

    it('Given duplicate payment request with the same idempotencyKey, Then returns cached payment result (isIdempotentReplay=true) without double-charging', async () => {
      // Given: exact same idempotencyKey
      const payload = {
        orderId: order._id,
        method: PAYMENT_METHOD.MOCK_PAYMENT,
        idempotencyKey: 'IDEM-PAY-TEST-0001',
        paymentDetails: {},
      };

      // When
      const res = await request(app)
        .post('/api/v1/payments/process')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(payload);

      // Then
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isIdempotentReplay).toBe(true);
      expect(res.body.data.payment._id.toString()).toBe(completedPaymentId.toString());

      // Confirm only 1 payment record exists for this idempotency key
      const count = await Payment.countDocuments({ idempotencyKey: 'IDEM-PAY-TEST-0001' });
      expect(count).toBe(1);
    });

    it('Given payment failure simulation (simulateFailure=true), When processing payment on a second order, Then records payment status as FAILED', async () => {
      // Place a second order to test failure
      await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ productId: product._id.toString(), quantity: 1 });

      const secondOrderRes = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ fulfillmentType: 'PICKUP' });
      const secondOrder = secondOrderRes.body.data;

      // When
      const failRes = await request(app)
        .post('/api/v1/payments/process')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          orderId: secondOrder._id,
          method: PAYMENT_METHOD.MOCK_PAYMENT,
          idempotencyKey: 'IDEM-FAIL-TEST-0002',
          paymentDetails: {
            simulateFailure: true,
            failureReason: 'Card declined - Insufficient funds',
          },
        });

      // Then
      expect(failRes.status).toBe(200);
      expect(failRes.body.data.payment.status).toBe(PAYMENT_STATUS.FAILED);
      expect(failRes.body.data.payment.failureReason).toMatch(/declined/i);

      const dbOrder = await Order.findById(secondOrder._id);
      expect(dbOrder.paymentStatus).toBe('FAILED');
    });

    it('Given a completed payment, When admin/seller issues refund via POST /api/v1/payments/:id/refund, Then marks payment as REFUNDED', async () => {
      // When
      const res = await request(app)
        .post(`/api/v1/payments/${completedPaymentId}/refund`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ reason: 'Customer requested refund at pickup counter' });

      // Then
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(PAYMENT_STATUS.REFUNDED);
      expect(res.body.data.refundDetails.refundId).toBeDefined();

      const dbOrder = await Order.findById(order._id);
      expect(dbOrder.paymentStatus).toBe('REFUNDED');
    });
  });

  // --------------------------------------------------------------------------
  // 18. QR BATCH VERIFICATION & SECURITY
  // --------------------------------------------------------------------------
  describe('18. QR Batch Verification, Expiry Integrity & Revocation', () => {
    let validQrToken;

    it('Given an approved seller, When requesting QR generation via POST /api/v1/qr/batch/:batchId, Then generates signed QR token and data URL', async () => {
      // When
      const res = await request(app)
        .post(`/api/v1/qr/batch/${batch._id}`)
        .set('Authorization', `Bearer ${sellerToken}`);

      // Then
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.qrDataUrl).toBeDefined();
      expect(res.body.data.status).toBe(QR_STATUS.ACTIVE);
      expect(res.body.data.batchNumber).toBe('LOT-CHIPS-101');

      validQrToken = res.body.data.token;
    });

    it('Given a valid QR token, When public user verifies via POST /api/v1/qr/verify, Then validates signature, queries MongoDB for batch, and returns live expiry information', async () => {
      // When
      const res = await request(app)
        .post('/api/v1/qr/verify')
        .send({ token: validQrToken });

      // Then: Returns verified live data from MongoDB (NOT trusting payload claims)
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.verificationStatus).toMatch(/GENUINE/);
      expect(res.body.data.product.name).toBe('Gourmet Potato Chips 150g');
      expect(res.body.data.brand).toBe('CrispyCo');
      expect(res.body.data.batchNumber).toBe('LOT-CHIPS-101');
      expect(res.body.data.store.storeName).toBe('PayMart Express');
      expect(res.body.data.expiryDate).toBeDefined();
    });

    it('Given a tampered QR token (corrupted signature), When verification is attempted, Then rejects with 400 Bad Request', async () => {
      // Given: Alter signature at the end of token
      const tamperedToken = validQrToken.slice(0, -6) + 'XXXXXX';

      // When
      const res = await request(app)
        .post('/api/v1/qr/verify')
        .send({ token: tamperedToken });

      // Then
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('INVALID_QR_SIGNATURE');
    });

    it('Given a batch QR revoked by seller, When public verification is attempted, Then returns verificationStatus REVOKED', async () => {
      // Given: Revoke the QR
      const revokeRes = await request(app)
        .post(`/api/v1/qr/batch/${batch._id}/revoke`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ reason: 'Manufacturer product recall' });

      expect(revokeRes.status).toBe(200);
      expect(revokeRes.body.data.status).toBe(QR_STATUS.REVOKED);

      // When: User scans the revoked QR
      const verifyRes = await request(app)
        .post('/api/v1/qr/verify')
        .send({ token: validQrToken });

      // Then
      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.data.verificationStatus).toBe('REVOKED');
      expect(verifyRes.body.data.message).toMatch(/revoked/i);
    });
  });

  // --------------------------------------------------------------------------
  // 19. NOTIFICATIONS & INBOX MANAGEMENT
  // --------------------------------------------------------------------------
  describe('19. NearExpiry Notifications, Deduplication & Read State', () => {
    let orderNotification;

    it('Given an order placed event, When notifyCustomerOrderConfirmed is called, Then creates notification in customer inbox', async () => {
      // When
      const result = await notifyCustomerOrderConfirmed({
        customerId: customerUser._id,
        order,
        store,
      });

      // Then
      expect(result).toBeDefined();
      expect(result.notification).toBeDefined();
      expect(result.notification.type).toBe(NOTIFICATION_TYPES.ORDER_CONFIRMED);
      expect(result.notification.recipient.toString()).toBe(customerUser._id.toString());
      expect(result.notification.isRead).toBe(false);

      orderNotification = result.notification;
    });

    it('Given unread notifications, When customer queries GET /api/v1/notifications/unread-count, Then returns accurate unread count', async () => {
      // When
      const res = await request(app)
        .get('/api/v1/notifications/unread-count')
        .set('Authorization', `Bearer ${customerToken}`);

      // Then
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.unreadCount).toBeGreaterThanOrEqual(1);
    });

    it('Given identical event with same dedupKey dispatched again, Then suppresses duplicate notification', async () => {
      // When: dispatch exact same notification again
      const result2 = await notifyCustomerOrderConfirmed({
        customerId: customerUser._id,
        order,
        store,
      });

      // Then: duplicate suppressed
      expect(result2.isDuplicate).toBe(true);
      expect(result2.message).toMatch(/duplicate/i);

      // Check DB count for this exact dedupKey
      const count = await Notification.countDocuments({
        dedupKey: `ORDER_CONFIRMED:${order._id}`,
      });
      expect(count).toBe(1); // Still exactly 1, no duplicate written
    });

    it('Given unread notifications, When customer calls PATCH /api/v1/notifications/mark-all-read, Then marks all as read and unread-count becomes 0', async () => {
      // When
      const markRes = await request(app)
        .patch('/api/v1/notifications/mark-all-read')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(markRes.status).toBe(200);
      expect(markRes.body.success).toBe(true);

      // Verify unread count is now 0
      const countRes = await request(app)
        .get('/api/v1/notifications/unread-count')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(countRes.status).toBe(200);
      expect(countRes.body.data.unreadCount).toBe(0);
    });
  });
});
