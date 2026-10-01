import { describe, it, before, after } from 'node:test';
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
import { resetDefaultPriceRulesService } from '../src/services/priceRule.service.js';

describe('NearExpiry Admin Module Test Suite', () => {
  let server;
  let baseUrl;
  let adminToken;
  let adminUser;
  let sellerToken;
  let sellerUser;
  let pendingSellerToken;
  let pendingSellerUser;
  let customerToken;
  let customerUser;
  let categoryId;
  let storeId;
  let pendingStoreId;
  let productId;
  let batchId;
  let testOrderId;
  let ts;

  before(async () => {
    await connectDB();

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}/api/v1`;

    ts = Date.now().toString().slice(-6);

    // 1. Admin Account
    const adminRes = await fetch(`${baseUrl}/auth/register/admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Super Admin',
        email: `admin.mod.${ts}@nearexpiry.test`,
        phone: '9876560001',
        password: 'Password123!',
      }),
    });
    const adminData = await adminRes.json();
    adminToken = adminData.data.token;
    adminUser = adminData.data.user;
    await resetDefaultPriceRulesService(adminUser._id);

    // 2. Active Seller & Store
    const sRes = await fetch(`${baseUrl}/auth/register/seller`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Active Super Seller',
        email: `seller.active.${ts}@nearexpiry.test`,
        phone: '9876560002',
        password: 'Password123!',
        storeName: `AdminMart Flagship ${ts}`,
      }),
    });
    const sData = await sRes.json();
    sellerToken = sData.data.token;
    sellerUser = sData.data.user;

    const stRes = await fetch(`${baseUrl}/stores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
      body: JSON.stringify({
        storeName: `AdminMart Flagship ${ts}`,
        contactPhone: '9876560002',
        address: { street: 'MG Road Hub', city: 'Bengaluru', state: 'Karnataka', pincode: '560001' },
        latitude: 12.9716,
        longitude: 77.5946,
      }),
    });
    storeId = (await stRes.json()).data.store._id;
    await Store.findByIdAndUpdate(storeId, { verificationStatus: 'APPROVED', isActive: true });

    // 3. Pending Seller & Store for Approval workflow
    const pendRes = await fetch(`${baseUrl}/auth/register/seller`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Pending Applicant Seller',
        email: `seller.pending.${ts}@nearexpiry.test`,
        phone: '9876560003',
        password: 'Password123!',
        storeName: `Pending Corner Store ${ts}`,
      }),
    });
    const pendData = await pendRes.json();
    pendingSellerToken = pendData.data.token;
    pendingSellerUser = pendData.data.user;

    const pendStRes = await fetch(`${baseUrl}/stores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pendingSellerToken}` },
      body: JSON.stringify({
        storeName: `Pending Corner Store ${ts}`,
        contactPhone: '9876560003',
        address: { street: 'Outer Ring Rd', city: 'Bengaluru', state: 'Karnataka', pincode: '560103' },
        latitude: 12.9279,
        longitude: 77.6271,
      }),
    });
    pendingStoreId = (await pendStRes.json()).data.store._id;

    // 4. Customer
    const cRes = await fetch(`${baseUrl}/auth/register/customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Shopper One',
        email: `cust.admin.${ts}@nearexpiry.test`,
        phone: '9876560004',
        password: 'Password123!',
      }),
    });
    const cData = await cRes.json();
    customerToken = cData.data.token;
    customerUser = cData.data.user;

    // 5. Category & Product
    const catRes = await fetch(`${baseUrl}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: `Admin Category ${ts}`, status: 'ACTIVE' }),
    });
    categoryId = (await catRes.json()).data.category._id;

    const pRes = await fetch(`${baseUrl}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
      body: JSON.stringify({
        name: `Artisan Sourdough Loaf ${ts}`,
        description: 'Freshly baked naturally leavened sourdough bread',
        brand: 'TheBaker',
        category: categoryId,
        unit: 'pcs',
      }),
    });
    productId = (await pRes.json()).data.product._id;

    // 6. Batches
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);

    const bRes = await fetch(`${baseUrl}/batches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
      body: JSON.stringify({
        productId,
        batchNumber: `ADM-LOT-${ts}`,
        manufacturingDate: '2026-09-01T00:00:00.000Z',
        expiryDate: futureDate.toISOString(),
        quantity: 20,
        originalPrice: 100,
      }),
    });
    batchId = (await bRes.json()).data.batch._id;

    // 7. Place an Order for testing
    await fetch(`${baseUrl}/cart/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ productId, quantity: 2 }),
    });

    const oRes = await fetch(`${baseUrl}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ fulfillmentType: 'PICKUP' }),
    });
    testOrderId = (await oRes.json()).data._id;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await disconnectDB();
  });

  describe('1. Role-Based Middleware Protection', () => {
    it('should reject unauthenticated request to /admin/dashboard with 401', async () => {
      const res = await fetch(`${baseUrl}/admin/dashboard`);
      assert.equal(res.status, 401);
    });

    it('should reject customer access to /admin/dashboard with 403 Forbidden', async () => {
      const res = await fetch(`${baseUrl}/admin/dashboard`, {
        headers: { Authorization: `Bearer ${customerToken}` },
      });
      assert.equal(res.status, 403);
    });

    it('should reject seller access to /admin/dashboard with 403 Forbidden', async () => {
      const res = await fetch(`${baseUrl}/admin/dashboard`, {
        headers: { Authorization: `Bearer ${sellerToken}` },
      });
      assert.equal(res.status, 403);
    });

    it('should allow admin access to /admin/dashboard with 200 OK', async () => {
      const res = await fetch(`${baseUrl}/admin/dashboard`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(res.status, 200);
    });
  });

  describe('2. Admin Dashboard Metrics', () => {
    it('should return all required platform metrics in the dashboard response', async () => {
      const res = await fetch(`${baseUrl}/admin/dashboard`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.success, true);
      const m = body.data;

      assert.ok(typeof m.totalCustomers === 'number' && m.totalCustomers >= 1, 'Must report total customers');
      assert.ok(typeof m.totalSellers === 'number' && m.totalSellers >= 2, 'Must report total sellers');
      assert.ok(typeof m.activeStores === 'number' && m.activeStores >= 1, 'Must report active stores');
      assert.ok(typeof m.products.total === 'number' && m.products.total >= 1, 'Must report products count');
      assert.ok(typeof m.nearExpiryInventory === 'object', 'Must report near-expiry inventory');
      assert.ok(typeof m.criticalInventory === 'object', 'Must report critical inventory');
      assert.ok(typeof m.expiredInventory === 'object', 'Must report expired inventory');
      assert.ok(typeof m.orders.total === 'number' && m.orders.total >= 1, 'Must report total orders');
      assert.ok(typeof m.revenue === 'number', 'Must report total revenue');
      assert.ok(typeof m.inventoryRescued.totalRescuedUnits === 'number', 'Must report inventory rescued');
      assert.ok(typeof m.wastePrevented.estimatedKgSaved === 'number', 'Must report waste prevented');
      assert.ok(typeof m.wastePrevented.customerSavingsAmount === 'number', 'Must report customer savings amount');
    });
  });

  describe('3. Seller Approval and Rejection', () => {
    it('should list sellers including pending applicants', async () => {
      const res = await fetch(`${baseUrl}/admin/sellers?verificationStatus=PENDING`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      const body = await res.json();
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(body.data.sellers));
      assert.ok(body.data.sellers.some((s) => s._id.toString() === pendingSellerUser._id.toString()));
    });

    it('should approve a pending seller and activate their store lot', async () => {
      const res = await fetch(`${baseUrl}/admin/sellers/${pendingSellerUser._id}/approval`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ status: 'APPROVED' }),
      });

      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.data.seller.verificationStatus, 'APPROVED');
      assert.equal(body.data.store.verificationStatus, 'APPROVED');
      assert.equal(body.data.store.isActive, true);
    });

    it('should reject a seller with a mandatory reason note', async () => {
      const res = await fetch(`${baseUrl}/admin/sellers/${pendingSellerUser._id}/approval`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          status: 'REJECTED',
          rejectionReason: 'Invalid business license documents submitted',
        }),
      });

      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.data.seller.verificationStatus, 'REJECTED');
      assert.equal(body.data.seller.sellerProfile.rejectionReason, 'Invalid business license documents submitted');
    });
  });

  describe('4. User Management', () => {
    it('should list users with pagination, role filter, and search', async () => {
      const res = await fetch(`${baseUrl}/admin/users?role=CUSTOMER`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      const body = await res.json();
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(body.data.users));
      assert.ok(body.data.users.every((u) => u.role === 'CUSTOMER'));
    });

    it('should get detailed user profile with order metrics', async () => {
      const res = await fetch(`${baseUrl}/admin/users/${customerUser._id}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.data.user._id.toString(), customerUser._id.toString());
      assert.ok(body.data.ordersCount >= 1);
    });

    it('should allow admin to toggle user active status (suspend/reactivate)', async () => {
      const res = await fetch(`${baseUrl}/admin/users/${customerUser._id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ isActive: false, reason: 'Suspended for investigation' }),
      });

      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.data.isActive, false);

      // Re-enable for subsequent tests
      await fetch(`${baseUrl}/admin/users/${customerUser._id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ isActive: true }),
      });
    });

    it('should prevent admin from deactivating their own account', async () => {
      const res = await fetch(`${baseUrl}/admin/users/${adminUser._id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ isActive: false }),
      });

      const body = await res.json();
      assert.equal(res.status, 400);
      assert.equal(body.errorCode, 'CANNOT_SELF_DEACTIVATE');
    });
  });

  describe('5. Store Management', () => {
    it('should list all stores with owner details and status', async () => {
      const res = await fetch(`${baseUrl}/admin/stores`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      const body = await res.json();
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(body.data.stores));
      assert.ok(body.data.stores.length >= 1);
    });

    it('should retrieve individual store details and performance stats', async () => {
      const res = await fetch(`${baseUrl}/admin/stores/${storeId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.data.store._id.toString(), storeId.toString());
      assert.ok(body.data.productCount >= 1);
    });

    it('should update store active status and verification status', async () => {
      const res = await fetch(`${baseUrl}/admin/stores/${storeId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ isActive: true, verificationStatus: 'APPROVED' }),
      });

      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.data.isActive, true);
    });
  });

  describe('6. Product Moderation & Category Management', () => {
    it('should list catalog products across stores with populated category and store details', async () => {
      const res = await fetch(`${baseUrl}/admin/products`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      const body = await res.json();
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(body.data.products));
      assert.ok(body.data.products.some((p) => p._id.toString() === productId.toString()));
    });

    it('should moderate product status by archiving or delisting', async () => {
      const res = await fetch(`${baseUrl}/admin/products/${productId}/moderation`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ status: 'ARCHIVED', moderationNote: 'Seasonal rotation' }),
      });

      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.data.status, 'ARCHIVED');

      // Restore to ACTIVE for downstream tests
      await fetch(`${baseUrl}/admin/products/${productId}/moderation`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ status: 'ACTIVE' }),
      });
    });

    it('should list categories with product counts', async () => {
      const res = await fetch(`${baseUrl}/admin/categories`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      const body = await res.json();
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(body.data));
      const targetCat = body.data.find((c) => c._id.toString() === categoryId.toString());
      assert.ok(targetCat, 'Target category must exist');
      assert.ok(targetCat.productCount >= 1, 'Target category should have product count');
    });
  });

  describe('7. Pricing Rules Management', () => {
    it('should list all system pricing rules', async () => {
      const res = await fetch(`${baseUrl}/admin/pricing-rules`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      const body = await res.json();
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(body.data.rules));
      assert.ok(body.data.rules.length >= 5);
    });

    it('should reset pricing rules to default tiers via /pricing-rules/reset-defaults', async () => {
      const res = await fetch(`${baseUrl}/admin/pricing-rules/reset-defaults`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      const body = await res.json();
      assert.equal(res.status, 200);
      assert.ok(body.data.rules.length >= 6);
    });

    it('should trigger manual dynamic pricing & expiry sweep via /pricing-rules/trigger-sweep', async () => {
      const res = await fetch(`${baseUrl}/admin/pricing-rules/trigger-sweep`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      const body = await res.json();
      assert.equal(res.status, 200);
      assert.ok(body.data.executionLogId || body.data.batchesProcessed !== undefined);
    });
  });

  describe('8. Inventory & Expiry Monitoring', () => {
    it('should retrieve global inventory monitoring report with valuations', async () => {
      const res = await fetch(`${baseUrl}/admin/inventory`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      const body = await res.json();
      assert.equal(res.status, 200);
      assert.ok(body.data.summary);
      assert.ok(typeof body.data.summary.totalUnits === 'number');
      assert.ok(typeof body.data.summary.totalCurrentValuation === 'number');
      assert.ok(Array.isArray(body.data.batches));
    });

    it('should retrieve expiry monitoring radar with critical and approaching lots', async () => {
      const res = await fetch(`${baseUrl}/admin/expiry`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      const body = await res.json();
      assert.equal(res.status, 200);
      assert.ok(body.data.approachingLots);
      assert.ok(body.data.criticalLots);
      assert.ok(Array.isArray(body.data.urgentClearanceLots));
    });
  });

  describe('9. Order Monitoring', () => {
    it('should list cross-store orders with customer and store metadata', async () => {
      const res = await fetch(`${baseUrl}/admin/orders`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      const body = await res.json();
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(body.data.orders));
      assert.ok(body.data.orders.length >= 1);
    });

    it('should get full details of a specific order lot allocations', async () => {
      const res = await fetch(`${baseUrl}/admin/orders/${testOrderId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.data._id.toString(), testOrderId.toString());
      assert.ok(body.data.items);
      assert.ok(body.data.storeId);
    });
  });

  describe('10. Reports & Audit Logs', () => {
    it('should generate overview report', async () => {
      const res = await fetch(`${baseUrl}/admin/reports?type=overview`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.data.type, 'overview');
      assert.ok(body.data.metrics.totalCustomers >= 1);
    });

    it('should generate waste-prevention analytical report', async () => {
      const res = await fetch(`${baseUrl}/admin/reports?type=waste-prevention`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.data.type, 'waste-prevention');
      assert.ok(typeof body.data.totalItemsRescued === 'number');
      assert.ok(typeof body.data.estimatedKgSaved === 'number');
    });

    it('should generate store-leaderboard performance report', async () => {
      const res = await fetch(`${baseUrl}/admin/reports?type=store-leaderboard`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.data.type, 'store-leaderboard');
      assert.ok(Array.isArray(body.data.leaderboard));
    });

    it('should query inventory audit logs via /admin/audit-logs?logType=inventory', async () => {
      const res = await fetch(`${baseUrl}/admin/audit-logs?logType=inventory`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.data.logType, 'inventory');
      assert.ok(Array.isArray(body.data.logs));
      assert.ok(body.data.logs.length >= 1);
    });

    it('should query price audit logs via /admin/audit-logs?logType=price', async () => {
      const res = await fetch(`${baseUrl}/admin/audit-logs?logType=price`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.data.logType, 'price');
      assert.ok(Array.isArray(body.data.logs));
    });
  });
});
