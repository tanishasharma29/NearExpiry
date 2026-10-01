import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import mongoose from 'mongoose';
import app from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User, USER_ROLES } from '../src/models/user.model.js';
import { Store } from '../src/models/store.model.js';
import { Category } from '../src/models/category.model.js';
import { Product } from '../src/models/product.model.js';
import { Batch, BATCH_STATUS } from '../src/models/batch.model.js';
import { Order, ORDER_STATUS } from '../src/models/order.model.js';
import { Payment, PAYMENT_STATUS, PAYMENT_METHOD } from '../src/models/payment.model.js';
import { resetDefaultPriceRulesService } from '../src/services/priceRule.service.js';

describe("NearExpiry Analytics Module Test Suite (MongoDB Aggregations)", () => {
  let server;
  let baseUrl;
  let adminToken;
  let adminUser;
  let sellerToken;
  let sellerUser;
  let customerToken;
  let customerUser;
  let storeId;
  let categoryId;
  let productId;
  let batchId1;
  let batchId2;
  let batchId3;
  let batchId4;
  let batchIdExpired;
  let orderId;
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
        name: 'Analytics Admin',
        email: `admin.analytics.${ts}@nearexpiry.test`,
        phone: '9876570001',
        password: 'Password123!',
      }),
    });
    const adminData = await adminRes.json();
    adminToken = adminData.data.token;
    adminUser = adminData.data.user;
    await resetDefaultPriceRulesService(adminUser._id);

    // 2. Seller & Store
    const sRes = await fetch(`${baseUrl}/auth/register/seller`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Analytics Seller',
        email: `seller.analytics.${ts}@nearexpiry.test`,
        phone: '9876570002',
        password: 'Password123!',
        storeName: `Analytics Supermarket ${ts}`,
      }),
    });
    const sData = await sRes.json();
    sellerToken = sData.data.token;
    sellerUser = sData.data.user;

    const stRes = await fetch(`${baseUrl}/stores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
      body: JSON.stringify({
        storeName: `Analytics Supermarket ${ts}`,
        contactPhone: '9876570002',
        address: { street: 'Koramangala 4th Block', city: 'Bengaluru', state: 'Karnataka', pincode: '560034' },
        latitude: 12.9352,
        longitude: 77.6245,
      }),
    });
    storeId = (await stRes.json()).data.store._id;
    await Store.findByIdAndUpdate(storeId, { verificationStatus: 'APPROVED', isActive: true });

    // 3. Customer
    const cRes = await fetch(`${baseUrl}/auth/register/customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Analytics Customer',
        email: `cust.analytics.${ts}@nearexpiry.test`,
        phone: '9876570003',
        password: 'Password123!',
      }),
    });
    const cData = await cRes.json();
    customerToken = cData.data.token;
    customerUser = cData.data.user;

    // 4. Category
    const catRes = await fetch(`${baseUrl}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: `Dairy & Cheese ${ts}`, status: 'ACTIVE' }),
    });
    categoryId = (await catRes.json()).data.category._id;

    // 5. Product
    const pRes = await fetch(`${baseUrl}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
      body: JSON.stringify({
        name: `Organic Cheddar Cheese ${ts}`,
        brand: 'Heritage Farm',
        category: categoryId,
        description: 'Aged farm fresh cheddar cheese block',
        unit: 'pack',
      }),
    });
    productId = (await pRes.json()).data.product._id;

    // 6. Batches with distinct expiry horizons
    // Batch 1: Critical (1 day remaining: <= 2 -> 0-2 Days bucket)
    const exp1 = new Date();
    exp1.setDate(exp1.getDate() + 1);
    const b1Res = await fetch(`${baseUrl}/batches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
      body: JSON.stringify({
        productId,
        batchNumber: `BATCH-CRIT-${ts}`,
        manufacturingDate: '2026-08-01T00:00:00.000Z',
        expiryDate: exp1.toISOString(),
        quantity: 15,
        originalPrice: 200,
      }),
    });
    batchId1 = (await b1Res.json()).data.batch._id;

    // Batch 2: Urgent (5 days remaining: 3-7 Days bucket)
    const exp2 = new Date();
    exp2.setDate(exp2.getDate() + 5);
    const b2Res = await fetch(`${baseUrl}/batches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
      body: JSON.stringify({
        productId,
        batchNumber: `BATCH-URG-${ts}`,
        manufacturingDate: '2026-08-10T00:00:00.000Z',
        expiryDate: exp2.toISOString(),
        quantity: 20,
        originalPrice: 200,
      }),
    });
    batchId2 = (await b2Res.json()).data.batch._id;

    // Batch 3: Approaching (12 days remaining: 8-15 Days bucket, APPROACHING_EXPIRY status)
    const exp3 = new Date();
    exp3.setDate(exp3.getDate() + 12);
    const b3Res = await fetch(`${baseUrl}/batches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
      body: JSON.stringify({
        productId,
        batchNumber: `BATCH-APP-${ts}`,
        manufacturingDate: '2026-08-15T00:00:00.000Z',
        expiryDate: exp3.toISOString(),
        quantity: 25,
        originalPrice: 200,
      }),
    });
    batchId3 = (await b3Res.json()).data.batch._id;

    // Batch 4: Safe (45 days remaining: 31+ Days bucket, NORMAL status)
    const exp4 = new Date();
    exp4.setDate(exp4.getDate() + 45);
    const b4Res = await fetch(`${baseUrl}/batches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
      body: JSON.stringify({
        productId,
        batchNumber: `BATCH-SAFE-${ts}`,
        manufacturingDate: '2026-09-01T00:00:00.000Z',
        expiryDate: exp4.toISOString(),
        quantity: 40,
        originalPrice: 200,
      }),
    });
    batchId4 = (await b4Res.json()).data.batch._id;

    // Batch 5: Expired (created directly via Mongoose model)
    const expExp = new Date();
    expExp.setDate(expExp.getDate() - 2);
    const bExp = await Batch.create({
      productId,
      storeId,
      sellerId: sellerUser._id,
      batchNumber: `BATCH-EXP-${ts}`,
      manufacturingDate: new Date('2026-07-01'),
      expiryDate: expExp,
      initialQuantity: 8,
      quantity: 8,
      originalPrice: 200,
      currentPrice: 200,
      discountPercentage: 0,
      remainingDays: -2,
      status: BATCH_STATUS.EXPIRED,
      isExpired: true,
    });
    batchIdExpired = bExp._id;

    // 7. Place Order via Cart & Order API
    await fetch(`${baseUrl}/cart/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ productId, quantity: 5 }),
    });

    const oRes = await fetch(`${baseUrl}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ fulfillmentType: 'PICKUP' }),
    });
    const orderData = await oRes.json();
    orderId = orderData.data._id;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await disconnectDB();
  });

  describe("Seller Analytics Pipeline", () => {
    it("should reject customer access with 403 Forbidden", async () => {
      const res = await fetch(`${baseUrl}/analytics/seller`, {
        headers: { Authorization: `Bearer ${customerToken}` },
      });
      assert.equal(res.status, 403);
      const data = await res.json();
      assert.equal(data.success, false);
      assert.ok(data.message);
    });

    it("should retrieve comprehensive seller KPIs aggregated strictly in MongoDB", async () => {
      const res = await fetch(`${baseUrl}/analytics/seller?period=30d`, {
        headers: { Authorization: `Bearer ${sellerToken}` },
      });
      assert.equal(res.status, 200);
      const { data } = await res.json();

      assert.ok(data.store);
      assert.equal(data.store._id.toString(), storeId.toString());

      // KPIs
      const { kpis } = data;
      // 5 units were allocated from batch 1 (initial 15 -> remaining 10)
      assert.ok(kpis.totalInventory >= 90);
      assert.ok(kpis.criticalInventory >= 10);
      assert.ok(kpis.expiringInventory >= 25);
      assert.ok(kpis.expiredInventory >= 8);
      assert.equal(kpis.unitsSold, 5);
      assert.ok(kpis.revenue > 0);
      assert.ok(kpis.gmv > 0);
      assert.ok(kpis.discountAmount > 0);
      assert.ok(kpis.ordersCount >= 1);
      assert.ok(kpis.inventoryValuation > 0);

      // Waste Prevented
      assert.equal(kpis.wastePrevented.unitsRescued, 5);
      assert.ok(kpis.wastePrevented.customerSavingsAmount > 0);
      assert.ok(kpis.wastePrevented.estimatedKgSaved > 0);
      assert.ok(kpis.wastePrevented.co2EquivalentKg > 0);
    });

    it("should return chart-friendly Recharts data for Sales Over Time", async () => {
      const res = await fetch(`${baseUrl}/analytics/seller?period=30d`, {
        headers: { Authorization: `Bearer ${sellerToken}` },
      });
      assert.equal(res.status, 200);
      const { data } = await res.json();
      const { salesOverTime } = data.charts;

      assert.ok(Array.isArray(salesOverTime));
      assert.ok(salesOverTime.length >= 1);
      const todayEntry = salesOverTime[0];
      assert.ok(todayEntry.date);
      assert.ok(todayEntry.revenue > 0);
      assert.ok(todayEntry.discountAmount > 0);
      assert.equal(todayEntry.unitsSold, 5);
      assert.ok(todayEntry.orderCount >= 1);
    });

    it("should return chart-friendly Recharts data for Expiry Distribution histogram", async () => {
      const res = await fetch(`${baseUrl}/analytics/seller?period=30d`, {
        headers: { Authorization: `Bearer ${sellerToken}` },
      });
      assert.equal(res.status, 200);
      const { data } = await res.json();
      const { expiryDistribution } = data.charts;

      assert.ok(Array.isArray(expiryDistribution));
      assert.equal(expiryDistribution.length, 6);

      // Verify all 6 buckets exist in standard order
      const buckets = expiryDistribution.map((d) => d.bucket);
      assert.deepEqual(buckets, [
        '0-2 Days (Critical)',
        '3-7 Days (Urgent)',
        '8-15 Days (Approaching)',
        '16-30 Days (Moderate)',
        '31+ Days (Safe)',
        'Expired',
      ]);

      const criticalBucket = expiryDistribution.find((d) => d.bucket === '0-2 Days (Critical)');
      assert.ok(criticalBucket.units >= 10);
      assert.ok(criticalBucket.lotCount >= 1);

      const urgentBucket = expiryDistribution.find((d) => d.bucket === '3-7 Days (Urgent)');
      assert.ok(urgentBucket.units >= 20);

      const approachingBucket = expiryDistribution.find((d) => d.bucket === '8-15 Days (Approaching)');
      assert.ok(approachingBucket.units >= 25);

      const safeBucket = expiryDistribution.find((d) => d.bucket === '31+ Days (Safe)');
      assert.ok(safeBucket.units >= 40);

      const expiredBucket = expiryDistribution.find((d) => d.bucket === 'Expired');
      assert.ok(expiredBucket.units >= 8);
    });

    it("should return chart-friendly Recharts data for Category Performance", async () => {
      const res = await fetch(`${baseUrl}/analytics/seller?period=30d`, {
        headers: { Authorization: `Bearer ${sellerToken}` },
      });
      assert.equal(res.status, 200);
      const { data } = await res.json();
      const { categoryPerformance } = data.charts;

      assert.ok(Array.isArray(categoryPerformance));
      assert.ok(categoryPerformance.length >= 1);
      const categoryEntry = categoryPerformance[0];
      assert.ok(categoryEntry.name);
      assert.ok(categoryEntry.revenue > 0);
      assert.equal(categoryEntry.unitsSold, 5);
      assert.ok(categoryEntry.discountAmount > 0);
    });

    it("should support period filters (7d, 30d, 90d, all)", async () => {
      for (const p of ['7d', '30d', '90d', 'all']) {
        const res = await fetch(`${baseUrl}/analytics/seller?period=${p}`, {
          headers: { Authorization: `Bearer ${sellerToken}` },
        });
        assert.equal(res.status, 200);
        const { data } = await res.json();
        assert.equal(data.period, p);
      }
    });
  });

  describe("Admin Analytics Pipeline", () => {
    it("should reject seller access with 403 Forbidden", async () => {
      const res = await fetch(`${baseUrl}/analytics/admin`, {
        headers: { Authorization: `Bearer ${sellerToken}` },
      });
      assert.equal(res.status, 403);
      const data = await res.json();
      assert.equal(data.success, false);
      assert.ok(data.message);
    });

    it("should reject customer access with 403 Forbidden", async () => {
      const res = await fetch(`${baseUrl}/analytics/admin`, {
        headers: { Authorization: `Bearer ${customerToken}` },
      });
      assert.equal(res.status, 403);
      const data = await res.json();
      assert.equal(data.success, false);
      assert.ok(data.message);
    });

    it("should retrieve platform-wide KPIs aggregated strictly in MongoDB", async () => {
      const res = await fetch(`${baseUrl}/analytics/admin?period=30d`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(res.status, 200);
      const { data } = await res.json();

      const { kpis } = data;
      // Users & Sellers
      assert.ok(kpis.users.totalCustomers >= 1);
      assert.ok(kpis.users.totalSellers >= 1);
      assert.ok(kpis.sellers.total >= 1);

      // Stores
      assert.ok(kpis.stores.total >= 1);
      assert.ok(kpis.stores.approved >= 1);

      // Orders, GMV, Revenue, Waste Prevented
      assert.ok(kpis.orders.total >= 1);
      assert.ok(kpis.gmv > 0);
      assert.ok(kpis.revenue > 0);
      assert.ok(kpis.rescuedInventory >= 5);
      assert.ok(kpis.wastePrevented.rescuedInventory >= 5);
      assert.ok(kpis.wastePrevented.estimatedKgSaved > 0);
      assert.ok(kpis.wastePrevented.customerSavingsAmount > 0);
      assert.ok(kpis.wastePrevented.carbonOffsetEquivalentKg > 0);
    });

    it("should return chart-friendly Recharts data for Admin sales time-series", async () => {
      const res = await fetch(`${baseUrl}/analytics/admin?period=30d`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(res.status, 200);
      const { data } = await res.json();
      const { salesOverTime } = data.charts;

      assert.ok(Array.isArray(salesOverTime));
      assert.ok(salesOverTime.length >= 1);
      const day = salesOverTime[0];
      assert.ok(day.date);
      assert.ok(day.gmv > 0);
      assert.ok(day.revenue > 0);
      assert.ok(day.discounts > 0);
      assert.ok(day.rescuedUnits >= 5);
      assert.ok(day.orderCount >= 1);
    });

    it("should return chart-friendly Recharts data for Platform Category Performance", async () => {
      const res = await fetch(`${baseUrl}/analytics/admin?period=30d`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(res.status, 200);
      const { data } = await res.json();
      const { categoryPerformance } = data.charts;

      assert.ok(Array.isArray(categoryPerformance));
      assert.ok(categoryPerformance.length >= 1);
      const cat = categoryPerformance[0];
      assert.ok(cat.name);
      assert.ok(cat.category);
      assert.ok(cat.revenue > 0);
      assert.ok(cat.gmv > 0);
      assert.ok(cat.unitsRescued >= 5);
      assert.ok(cat.discountSavings > 0);
    });

    it("should return chart-friendly Recharts data for Expiry Urgency Distribution and Trends", async () => {
      const res = await fetch(`${baseUrl}/analytics/admin?period=30d`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(res.status, 200);
      const { data } = await res.json();
      const { expiryUrgencyDistribution, expiryTrends } = data.charts;

      assert.ok(Array.isArray(expiryUrgencyDistribution));
      assert.equal(expiryUrgencyDistribution.length, 6);
      const criticalTier = expiryUrgencyDistribution.find((t) => t.tier === '0-2 Days (Critical)');
      assert.ok(criticalTier.units >= 10);

      assert.ok(Array.isArray(expiryTrends));
      const criticalStatus = expiryTrends.find((s) => s.status === 'CRITICAL');
      assert.ok(criticalStatus);
      assert.ok(criticalStatus.units >= 10);
      assert.ok(criticalStatus.valuation > 0);
    });
  });
});
