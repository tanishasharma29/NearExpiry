import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../../src/app.js';
import { connectTestDB, clearTestDB, disconnectTestDB } from '../setup/testDb.js';
import { User, USER_ROLES, VERIFICATION_STATUS } from '../../../src/models/user.model.js';
import { Store } from '../../../src/models/store.model.js';
import { Category } from '../../../src/models/category.model.js';
import { Product, PRODUCT_STATUS } from '../../../src/models/product.model.js';
import { Batch, BATCH_STATUS } from '../../../src/models/batch.model.js';
import { InventoryAudit } from '../../../src/models/inventory.model.js';
import { runExpiryProcessingJob } from '../../../src/services/expiryScheduler.service.js';

describe('Integration Tests: Catalog, Inventory & Expiry Scheduler', () => {
  let adminToken;
  let sellerToken;
  let unapprovedSellerToken;
  let customerToken;

  let adminUser;
  let approvedSellerUser;
  let unapprovedSellerUser;
  let sellerStore;
  let categoryId;
  let activeProductId;

  beforeAll(async () => {
    await connectTestDB();
    await clearTestDB();

    // 1. Seed Admin
    const adminRes = await request(app).post('/api/v1/auth/register/admin').send({
      name: 'Super Admin',
      email: 'admin.catalog@nearexpiry.com',
      password: 'AdminPassword123!',
      adminSecret: 'super-admin-root-key',
    });
    adminToken = adminRes.body.data.token;
    adminUser = adminRes.body.data.user;

    // 2. Seed Approved Seller
    const sellerRes = await request(app).post('/api/v1/auth/register/seller').send({
      name: 'Approved Seller',
      email: 'approved.seller@nearexpiry.com',
      password: 'SellerPassword123!',
      storeName: 'Fresh Mart Green',
      businessType: 'GROCERY',
      address: {
        street: '100 Market St',
        city: 'Metropolis',
        state: 'State',
        pincode: '123456',
      },
    });
    sellerToken = sellerRes.body.data.token;
    approvedSellerUser = sellerRes.body.data.user;

    // Admin approves seller
    await request(app)
      .patch(`/api/v1/admin/sellers/${approvedSellerUser._id}/approval`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'APPROVED' });

    sellerStore = await Store.findOne({ ownerId: approvedSellerUser._id });

    // 3. Seed Unapproved Seller (PENDING)
    const unapprovedRes = await request(app).post('/api/v1/auth/register/seller').send({
      name: 'Pending Seller',
      email: 'pending.seller@nearexpiry.com',
      password: 'SellerPassword123!',
      storeName: 'Unapproved Mart',
      businessType: 'BAKERY',
      address: {
        street: '200 Market St',
        city: 'Metropolis',
        state: 'State',
        pincode: '123456',
      },
    });
    unapprovedSellerToken = unapprovedRes.body.data.token;
    unapprovedSellerUser = unapprovedRes.body.data.user;

    // 4. Seed Customer
    const customerRes = await request(app).post('/api/v1/auth/register/customer').send({
      name: 'Test Customer',
      email: 'customer.catalog@nearexpiry.com',
      password: 'CustomerPassword123!',
    });
    customerToken = customerRes.body.data.token;

    // 5. Admin creates Category
    const catRes = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Dairy & Eggs',
        description: 'Milk, cheese, yogurt and eggs',
      });
    categoryId = catRes.body.data.category._id;
  });

  afterAll(async () => {
    await clearTestDB();
    await disconnectTestDB();
  });

  // --------------------------------------------------------------------------
  // 6. PRODUCT CREATION & VALIDATION
  // --------------------------------------------------------------------------
  describe('6. Product Creation & Separation from Batches', () => {
    it('Given an approved seller, When POST /api/v1/products with valid catalog details, Then creates product in ACTIVE state without batch fields', async () => {
      // Given
      const payload = {
        name: 'Organic Whole Milk 1L',
        description: 'Fresh organic pasteurized whole milk',
        brand: 'FarmFresh',
        category: categoryId,
        unit: 'l',
        status: 'ACTIVE',
      };

      // When
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send(payload);

      // Then
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.product._id).toBeDefined();
      expect(res.body.data.product.name).toBe('Organic Whole Milk 1L');
      expect(res.body.data.product.status).toBe(PRODUCT_STATUS.ACTIVE);
      expect(res.body.data.product.sellerId.toString()).toBe(approvedSellerUser._id);
      activeProductId = res.body.data.product._id;
    });

    it('Given batch-specific fields (e.g., expiryDate, quantity), When seller attempts POST /api/v1/products, Then rejects with 400 validation error enforcing Product/Batch separation', async () => {
      // Given: payload containing forbidden batch-level fields
      const payload = {
        name: 'Violating Milk',
        description: 'Milk with batch fields embedded',
        brand: 'BadBrand',
        category: categoryId,
        unit: 'l',
        expiryDate: new Date(Date.now() + 86400000 * 5).toISOString(),
        quantity: 50,
      };

      // When
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send(payload);

      // Then
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body.errors)).toMatch(/belongs to the Batch entity/i);
    });

    it('Given a CUSTOMER user, When attempting to create product via POST /api/v1/products, Then rejects with 403 Forbidden', async () => {
      // Given
      const payload = {
        name: 'Customer Milk Attempt',
        description: 'Should fail with 403',
        brand: 'CustomerBrand',
        category: categoryId,
        unit: 'l',
      };

      // When
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(payload);

      // Then
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('FORBIDDEN_ROLE');
    });
  });

  // --------------------------------------------------------------------------
  // 7. BATCH CREATION & INVENTORY INITIALIZATION
  // --------------------------------------------------------------------------
  describe('7. Batch Creation & Shelf Life / Pricing Initialization', () => {
    let createdBatchId;

    it('Given an active product and future dates, When seller creates batch via POST /api/v1/batches, Then initializes stock, remainingDays, status, and immutable audit trail', async () => {
      // Given
      const now = new Date();
      const mfgDate = new Date(now.getTime() - 2 * 86400000); // 2 days ago
      const expDate = new Date(now.getTime() + 15 * 86400000); // 15 days in future

      const payload = {
        productId: activeProductId,
        batchNumber: 'LOT-MILK-001',
        manufacturingDate: mfgDate.toISOString(),
        expiryDate: expDate.toISOString(),
        quantity: 25,
        originalPrice: 100,
      };

      // When
      const res = await request(app)
        .post('/api/v1/batches')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send(payload);

      // Then
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.batch.batchNumber).toBe('LOT-MILK-001');
      expect(res.body.data.batch.quantity).toBe(25);
      expect(res.body.data.batch.originalPrice).toBe(100);
      expect(res.body.data.batch.currentPrice).toBeLessThanOrEqual(100);
      expect(res.body.data.batch.remainingDays).toBeGreaterThan(0);
      expect(res.body.data.batch.isPurchasable).toBe(true);

      createdBatchId = res.body.data.batch._id;

      // Verify immutable audit log recorded
      const auditLog = await InventoryAudit.findOne({ batchId: createdBatchId });
      expect(auditLog).toBeDefined();
      expect(auditLog.actionType).toBe('INITIAL_STOCK');
      expect(auditLog.quantityChange).toBe(25);
      expect(auditLog.newQuantity).toBe(25);
    });

    it('Given an already-expired date, When seller attempts to create batch, Then rejects with 400 Bad Request', async () => {
      // Given
      const now = new Date();
      const mfgDate = new Date(now.getTime() - 10 * 86400000);
      const expDate = new Date(now.getTime() - 2 * 86400000); // Already expired

      const payload = {
        productId: activeProductId,
        batchNumber: 'LOT-EXPIRED-TEST',
        manufacturingDate: mfgDate.toISOString(),
        expiryDate: expDate.toISOString(),
        quantity: 10,
        originalPrice: 80,
      };

      // When
      const res = await request(app)
        .post('/api/v1/batches')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send(payload);

      // Then
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body.errors)).toMatch(/expiryDate has already passed/i);
    });

    it('Given manufacturingDate is after expiryDate, When seller attempts to create batch, Then rejects with 400 validation error', async () => {
      // Given
      const now = new Date();
      const mfgDate = new Date(now.getTime() + 10 * 86400000);
      const expDate = new Date(now.getTime() + 2 * 86400000); // Mfg > Exp

      const payload = {
        productId: activeProductId,
        batchNumber: 'LOT-INVERTED-DATES',
        manufacturingDate: mfgDate.toISOString(),
        expiryDate: expDate.toISOString(),
        quantity: 10,
        originalPrice: 80,
      };

      // When
      const res = await request(app)
        .post('/api/v1/batches')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send(payload);

      // Then
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body.errors)).toMatch(/strictly later than manufacturingDate/i);
    });
  });

  // --------------------------------------------------------------------------
  // 10. EXPIRY SCHEDULER & 11. EXPIRED PRODUCT PREVENTION
  // --------------------------------------------------------------------------
  describe('10. Expiry Scheduler & 11. Expired-Product Prevention in Marketplace', () => {
    let expiredBatchId;
    let approachingBatchId;

    beforeAll(async () => {
      const now = new Date();

      // Seed a batch that will simulate expiring today/past
      const expiredBatch = await Batch.create({
        productId: activeProductId,
        storeId: sellerStore._id,
        sellerId: approvedSellerUser._id,
        batchNumber: 'LOT-EXPIRE-SOON',
        manufacturingDate: new Date(now.getTime() - 20 * 86400000),
        expiryDate: new Date(now.getTime() - 1 * 86400000), // 1 day in the past
        remainingDays: -1,
        initialQuantity: 10,
        quantity: 10,
        reservedQuantity: 0,
        soldQuantity: 0,
        originalPrice: 120,
        currentPrice: 120,
        status: BATCH_STATUS.NORMAL, // scheduler must detect and mark EXPIRED
        isPurchasable: true,
      });
      expiredBatchId = expiredBatch._id;

      // Seed a batch approaching expiry (2 days left -> CRITICAL tier)
      const approachingBatch = await Batch.create({
        productId: activeProductId,
        storeId: sellerStore._id,
        sellerId: approvedSellerUser._id,
        batchNumber: 'LOT-CRITICAL-48H',
        manufacturingDate: new Date(now.getTime() - 10 * 86400000),
        expiryDate: new Date(now.getTime() + 2 * 86400000), // 2 days left
        remainingDays: 2,
        initialQuantity: 15,
        quantity: 15,
        reservedQuantity: 0,
        soldQuantity: 0,
        originalPrice: 100,
        currentPrice: 100,
        status: BATCH_STATUS.NORMAL,
        isPurchasable: true,
      });
      approachingBatchId = approachingBatch._id;
    });

    it('Given batches with past and critical expiry dates, When scheduler job runs (runExpiryProcessingJob), Then marks past batch EXPIRED, updates dynamic discount, and sets isPurchasable false', async () => {
      // When
      const summary = await runExpiryProcessingJob({ dryRun: false });

      // Then
      expect(summary.status).toBe('SUCCESS');
      expect(summary.batchesScanned).toBeGreaterThan(0);

      // Verify the past batch was locked out
      const updatedExpired = await Batch.findById(expiredBatchId);
      expect(updatedExpired.status).toBe(BATCH_STATUS.EXPIRED);
      expect(updatedExpired.isPurchasable).toBe(false);
      expect(updatedExpired.remainingDays).toBeLessThan(0);

      // Verify the critical batch got steep discount
      const updatedCritical = await Batch.findById(approachingBatchId);
      expect([BATCH_STATUS.CRITICAL, BATCH_STATUS.APPROACHING_EXPIRY]).toContain(updatedCritical.status);
      expect(updatedCritical.currentPrice).toBeLessThan(updatedCritical.originalPrice);
      expect(updatedCritical.discountPercentage).toBeGreaterThanOrEqual(40); // 2 days left >= 40%
    });

    it('Given an EXPIRED batch, When public customer queries batches via GET /api/v1/batches, Then expired batch is strictly filtered out', async () => {
      // When
      const res = await request(app).get('/api/v1/batches');

      // Then
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const returnedBatchIds = res.body.data.batches.map((b) => b._id.toString());
      expect(returnedBatchIds).not.toContain(expiredBatchId.toString());
      expect(returnedBatchIds).toContain(approachingBatchId.toString());
    });

    it('Given ADMIN credentials, When triggering manual sweep via POST /api/v1/admin/pricing-rules/trigger-sweep, Then returns 200 with sweep metrics', async () => {
      // When
      const res = await request(app)
        .post('/api/v1/admin/pricing-rules/trigger-sweep')
        .set('Authorization', `Bearer ${adminToken}`);

      // Then
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.batchesScanned).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // 12. INVENTORY MONITORING & AUDIT LOGS
  // --------------------------------------------------------------------------
  describe('12. Inventory Monitoring, Stock Adjustments & Immutable Audits', () => {
    let testBatch;

    beforeAll(async () => {
      const now = new Date();
      testBatch = await Batch.create({
        productId: activeProductId,
        storeId: sellerStore._id,
        sellerId: approvedSellerUser._id,
        batchNumber: 'LOT-AUDIT-TEST',
        manufacturingDate: new Date(now.getTime() - 5 * 86400000),
        expiryDate: new Date(now.getTime() + 10 * 86400000),
        remainingDays: 10,
        initialQuantity: 50,
        quantity: 50,
        reservedQuantity: 0,
        soldQuantity: 0,
        originalPrice: 200,
        currentPrice: 180,
        status: BATCH_STATUS.NORMAL,
        isPurchasable: true,
      });
    });

    it('Given an approved seller, When requesting my inventory via GET /api/v1/inventory/my-inventory, Then returns accurate stock breakdown', async () => {
      // When
      const res = await request(app)
        .get('/api/v1/inventory/my-inventory')
        .set('Authorization', `Bearer ${sellerToken}`);

      // Then
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.batches)).toBe(true);
      expect(res.body.data.batches.length).toBeGreaterThan(0);
    });

    it('Given a valid stock adjustment with audit reason, When POST /api/v1/inventory/adjust, Then updates batch quantity and writes InventoryAudit log', async () => {
      // Given
      const adjustmentPayload = {
        batchId: testBatch._id.toString(),
        quantityChange: -10, // Stock correction (e.g. damaged goods)
        reason: 'Damaged packaging during shelf stocking',
      };

      // When
      const res = await request(app)
        .post('/api/v1/inventory/adjust')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send(adjustmentPayload);

      // Then
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.batch.quantity).toBe(40);

      // Check audit logs endpoint
      const logRes = await request(app)
        .get(`/api/v1/inventory/logs?batchId=${testBatch._id}`)
        .set('Authorization', `Bearer ${sellerToken}`);

      expect(logRes.status).toBe(200);
      expect(logRes.body.success).toBe(true);
      const adjustmentLog = logRes.body.data.logs.find(
        (l) => l.reason === 'Damaged packaging during shelf stocking'
      );
      expect(adjustmentLog).toBeDefined();
      expect(adjustmentLog.quantityChange).toBe(-10);
      expect(adjustmentLog.newQuantity).toBe(40);
    });

    it('Given an adjustment resulting in negative inventory, When POST /api/v1/inventory/adjust, Then rejects with 400 Bad Request to prevent negative stock', async () => {
      // Given
      const invalidAdjustment = {
        batchId: testBatch._id.toString(),
        quantityChange: -100, // Current is 40, 40 - 100 < 0
        reason: 'Over-reduction attempt',
      };

      // When
      const res = await request(app)
        .post('/api/v1/inventory/adjust')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send(invalidAdjustment);

      // Then
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/cannot be negative/i);
    });
  });
});
