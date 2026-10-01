import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../../src/app.js';
import { connectTestDB, clearTestDB, disconnectTestDB } from '../setup/testDb.js';
import { User, USER_ROLES, VERIFICATION_STATUS } from '../../../src/models/user.model.js';
import { Store } from '../../../src/models/store.model.js';
import { Category } from '../../../src/models/category.model.js';
import { Product, PRODUCT_STATUS } from '../../../src/models/product.model.js';
import { Batch, BATCH_STATUS } from '../../../src/models/batch.model.js';
import { Cart } from '../../../src/models/cart.model.js';
import { Order, ORDER_STATUS } from '../../../src/models/order.model.js';

describe('Integration Tests: Cart, Checkout Validation, FEFO & Concurrency', () => {
  let adminToken;
  let sellerToken;
  let customer1Token;
  let customer2Token;

  let sellerUser;
  let sellerStore;
  let customer1User;
  let customer2User;
  let category;

  let productA;
  let batchA1; // Expiring soon (3 days)
  let batchA2; // Expiring later (15 days)

  beforeAll(async () => {
    await connectTestDB();
    await clearTestDB();

    // 1. Seed Admin
    const adminRes = await request(app).post('/api/v1/auth/register/admin').send({
      name: 'Admin User',
      email: 'admin.cart@nearexpiry.com',
      password: 'AdminPassword123!',
      adminSecret: 'super-admin-root-key',
    });
    adminToken = adminRes.body.data.token;

    // 2. Seed Approved Seller
    const sellerRes = await request(app).post('/api/v1/auth/register/seller').send({
      name: 'Cart Test Seller',
      email: 'seller.cart@nearexpiry.com',
      password: 'SellerPassword123!',
      storeName: 'FEFO Grocery Mart',
      businessType: 'GROCERY',
      address: {
        street: '456 Market St',
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

    sellerStore = await Store.findOne({ ownerId: sellerUser._id });

    // 3. Seed Customers 1 & 2
    const c1Res = await request(app).post('/api/v1/auth/register/customer').send({
      name: 'Customer One',
      email: 'customer1@nearexpiry.com',
      password: 'CustomerPassword123!',
    });
    customer1Token = c1Res.body.data.token;
    customer1User = c1Res.body.data.user;

    const c2Res = await request(app).post('/api/v1/auth/register/customer').send({
      name: 'Customer Two',
      email: 'customer2@nearexpiry.com',
      password: 'CustomerPassword123!',
    });
    customer2Token = c2Res.body.data.token;
    customer2User = c2Res.body.data.user;

    // 4. Create Category
    const catRes = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Bakery & Bread',
        description: 'Fresh bread and pastries',
      });
    category = catRes.body.data.category;

    // 5. Create Product
    const pRes = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        name: 'Artisan Sourdough Loaf',
        description: 'Naturally fermented artisan sourdough bread',
        brand: 'BakeHouse',
        category: category._id,
        unit: 'pcs',
        status: 'ACTIVE',
      });
    productA = pRes.body.data.product;

    // 6. Create Two Batches with different expiry dates (FEFO setup)
    const now = new Date();

    // Batch A1: Expires in 3 days, stock = 5, original = 100, current = 60 (steep discount)
    batchA1 = await Batch.create({
      productId: productA._id,
      storeId: sellerStore._id,
      sellerId: sellerUser._id,
      batchNumber: 'LOT-SOURDOUGH-SOON',
      manufacturingDate: new Date(now.getTime() - 4 * 86400000),
      expiryDate: new Date(now.getTime() + 3 * 86400000),
      remainingDays: 3,
      initialQuantity: 5,
      quantity: 5,
      reservedQuantity: 0,
      soldQuantity: 0,
      originalPrice: 100,
      currentPrice: 60,
      discountPercentage: 40,
      status: BATCH_STATUS.APPROACHING_EXPIRY,
      isPurchasable: true,
    });

    // Batch A2: Expires in 15 days, stock = 20, original = 100, current = 90
    batchA2 = await Batch.create({
      productId: productA._id,
      storeId: sellerStore._id,
      sellerId: sellerUser._id,
      batchNumber: 'LOT-SOURDOUGH-LATER',
      manufacturingDate: new Date(now.getTime() - 1 * 86400000),
      expiryDate: new Date(now.getTime() + 15 * 86400000),
      remainingDays: 15,
      initialQuantity: 20,
      quantity: 20,
      reservedQuantity: 0,
      soldQuantity: 0,
      originalPrice: 100,
      currentPrice: 90,
      discountPercentage: 10,
      status: BATCH_STATUS.NORMAL,
      isPurchasable: true,
    });
  });

  afterAll(async () => {
    await clearTestDB();
    await disconnectTestDB();
  });

  // --------------------------------------------------------------------------
  // 13. CART OPERATIONS & PRICING INTEGRITY
  // --------------------------------------------------------------------------
  describe('13. Cart CRUD Operations & Backend Pricing Integrity', () => {
    it('Given an empty cart, When customer adds 2 units of product, Then backend recalculates pricing and returns cart summary', async () => {
      // When
      const res = await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({
          productId: productA._id.toString(),
          quantity: 2,
        });

      // Then
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.items[0].requestedQuantity).toBe(2);
      expect(res.body.data.canCheckout).toBe(true);
      // Because batchA1 has 5 units @ 60, 2 units come entirely from batchA1: 2 * 60 = 120
      expect(res.body.data.pricingSummary.finalTotal).toBe(120);
    });

    it('Given item in cart, When customer updates quantity via PUT /api/v1/cart/items/:productId, Then recalculates cart total', async () => {
      // When
      const res = await request(app)
        .put(`/api/v1/cart/items/${productA._id}`)
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({ quantity: 4 });

      // Then
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items[0].requestedQuantity).toBe(4);
      // 4 units @ 60 = 240
      expect(res.body.data.pricingSummary.finalTotal).toBe(240);
    });

    it('Given customer retrieves cart via GET /api/v1/cart, Then returns accurate items and store details', async () => {
      // When
      const res = await request(app)
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${customer1Token}`);

      // Then
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.store).toBeDefined();
      expect(res.body.data.items.length).toBe(1);
    });

    it('Given item in cart, When customer removes item via DELETE /api/v1/cart/items/:productId, Then cart is updated and item removed', async () => {
      // When
      const res = await request(app)
        .delete(`/api/v1/cart/items/${productA._id}`)
        .set('Authorization', `Bearer ${customer1Token}`);

      // Then
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items.length).toBe(0);
      expect(res.body.data.pricingSummary.finalTotal).toBe(0);
    });

    it('Given customer clears cart via DELETE /api/v1/cart, Then cart items are emptied', async () => {
      // First add an item back
      await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({ productId: productA._id.toString(), quantity: 1 });

      // When
      const res = await request(app)
        .delete('/api/v1/cart')
        .set('Authorization', `Bearer ${customer1Token}`);

      // Then
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items.length).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // 14. CHECKOUT VALIDATION
  // --------------------------------------------------------------------------
  describe('14. Checkout Pre-flight Validation Gates', () => {
    it('Given cart with available inventory, When POST /api/v1/cart/checkout-validate, Then returns canCheckout true with breakdown', async () => {
      // Given: add 3 units
      await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({ productId: productA._id.toString(), quantity: 3 });

      // When
      const res = await request(app)
        .post('/api/v1/cart/checkout-validate')
        .set('Authorization', `Bearer ${customer1Token}`);

      // Then
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.canProceed).toBe(true);
      expect(res.body.data.items.length).toBe(1);
    });

    it('Given requested quantity exceeds total available active stock, When checkout-validate is called, Then rejects with 422 Unprocessable and blocking issues', async () => {
      // Given: update quantity to 90 (total available across both batches is 5 + 20 = 25)
      await request(app)
        .put(`/api/v1/cart/items/${productA._id}`)
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({ quantity: 90 });

      // When
      const res = await request(app)
        .post('/api/v1/cart/checkout-validate')
        .set('Authorization', `Bearer ${customer1Token}`);

      // Then
      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('CHECKOUT_VALIDATION_FAILED');
      expect(res.body.message).toMatch(/no longer purchasable/i);
    });
  });

  // --------------------------------------------------------------------------
  // 15. STRICT FEFO (FIRST-EXPIRED, FIRST-OUT) LOT ALLOCATION
  // --------------------------------------------------------------------------
  describe('15. Strict FEFO Multi-Batch Lot Allocation', () => {
    it('Given Batch A1 (stock=5, exp=3d, price=60) and Batch A2 (stock=20, exp=15d, price=90), When customer orders 7 units, Then allocates 5 from A1 and 2 from A2, updating inventory status', async () => {
      // Given: Set cart quantity to 7
      await request(app)
        .put(`/api/v1/cart/items/${productA._id}`)
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({ quantity: 7 });

      // When: Customer places order
      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({ fulfillmentType: 'PICKUP' });

      // Then
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.orderNumber).toBeDefined();
      expect(res.body.data.status).toBe(ORDER_STATUS.PLACED);

      const orderedItem = res.body.data.items[0];
      expect(orderedItem.requestedQuantity).toBe(7);
      expect(orderedItem.batchAllocations.length).toBe(2);

      // Allocation 1: From Batch A1 (expiring sooner)
      const alloc1 = orderedItem.batchAllocations.find(
        (a) => a.batchId.toString() === batchA1._id.toString()
      );
      expect(alloc1).toBeDefined();
      expect(alloc1.allocatedQuantity).toBe(5);
      expect(alloc1.discountedUnitPrice).toBe(60);

      // Allocation 2: From Batch A2 (expiring later)
      const alloc2 = orderedItem.batchAllocations.find(
        (a) => a.batchId.toString() === batchA2._id.toString()
      );
      expect(alloc2).toBeDefined();
      expect(alloc2.allocatedQuantity).toBe(2);
      expect(alloc2.discountedUnitPrice).toBe(90);

      // Blended total check: (5 * 60) + (2 * 90) = 300 + 180 = 480
      expect(res.body.data.pricingSummary.finalTotal).toBe(480);

      // Verify DB batch quantities after order
      const updatedBatchA1 = await Batch.findById(batchA1._id);
      expect(updatedBatchA1.quantity).toBe(0);
      expect(updatedBatchA1.soldQuantity).toBe(5);
      expect(updatedBatchA1.status).toBe(BATCH_STATUS.OUT_OF_STOCK);

      const updatedBatchA2 = await Batch.findById(batchA2._id);
      expect(updatedBatchA2.quantity).toBe(18); // 20 - 2
      expect(updatedBatchA2.soldQuantity).toBe(2);

      // Verify cart was cleared after successful order
      const cartAfter = await Cart.findOne({ userId: customer1User._id });
      expect(cartAfter.items.length).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // 16. CONCURRENT ORDERS RACE CONDITIONS
  // --------------------------------------------------------------------------
  describe('16. Concurrent Orders Race Conditions & Inventory Lock', () => {
    let scarceBatch;
    let scarceProduct;

    beforeAll(async () => {
      const now = new Date();

      // Create product with only 3 units in stock
      const pRes = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          name: 'Scarce Croissant Box',
          description: 'Limited edition butter croissants',
          brand: 'BakeHouse',
          category: category._id,
          unit: 'box',
          status: 'ACTIVE',
        });
      scarceProduct = pRes.body.data.product;

      scarceBatch = await Batch.create({
        productId: scarceProduct._id,
        storeId: sellerStore._id,
        sellerId: sellerUser._id,
        batchNumber: 'LOT-SCARCE-001',
        manufacturingDate: new Date(now.getTime() - 1 * 86400000),
        expiryDate: new Date(now.getTime() + 5 * 86400000),
        remainingDays: 5,
        initialQuantity: 3,
        quantity: 3, // EXACTLY 3 UNITS AVAILABLE
        reservedQuantity: 0,
        soldQuantity: 0,
        originalPrice: 150,
        currentPrice: 120,
        discountPercentage: 20,
        status: BATCH_STATUS.APPROACHING_EXPIRY,
        isPurchasable: true,
      });

      // Both Customer 1 and Customer 2 put all 3 units in their cart
      await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${customer1Token}`)
        .send({ productId: scarceProduct._id.toString(), quantity: 3, replaceCart: true });

      await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${customer2Token}`)
        .send({ productId: scarceProduct._id.toString(), quantity: 3, replaceCart: true });
    });

    it('Given only 3 units in stock, When Customer 1 and Customer 2 checkout concurrently for 3 units each, Then exactly one succeeds and the other fails with 409 Conflict, preventing negative stock', async () => {
      // When: Both customers checkout concurrently at the exact same moment
      const [res1, res2] = await Promise.all([
        request(app)
          .post('/api/v1/orders')
          .set('Authorization', `Bearer ${customer1Token}`)
          .send({ fulfillmentType: 'PICKUP' }),
        request(app)
          .post('/api/v1/orders')
          .set('Authorization', `Bearer ${customer2Token}`)
          .send({ fulfillmentType: 'PICKUP' }),
      ]);

      const responses = [res1, res2];
      const successCount = responses.filter((r) => r.status === 201).length;
      const failureCount = responses.filter((r) => r.status === 409).length;

      // Then: Exactly one customer secured the stock, one was safely rejected
      expect(successCount).toBe(1);
      expect(failureCount).toBe(1);

      // Verify the failing response received a concurrency/stock conflict error
      const failedRes = responses.find((r) => r.status === 409);
      expect(failedRes.body.success).toBe(false);
      expect([
        'INSUFFICIENT_STOCK_OR_EXPIRED',
        'CONCURRENT_CHECKOUT_CONFLICT',
      ]).toContain(failedRes.body.errorCode);

      // Check DB: Stock must be exactly 0, never negative
      const finalBatch = await Batch.findById(scarceBatch._id);
      expect(finalBatch.quantity).toBe(0);
      expect(finalBatch.soldQuantity).toBe(3);
      expect(finalBatch.status).toBe(BATCH_STATUS.OUT_OF_STOCK);
    });
  });
});
