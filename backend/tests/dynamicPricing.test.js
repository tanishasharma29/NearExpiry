import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import app from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { evaluateDynamicPricingAlgorithm } from '../src/services/pricing.service.js';
import { INITIAL_SEED_PRICE_RULES } from '../src/services/priceRule.service.js';

const mockDbRules = INITIAL_SEED_PRICE_RULES.map((r, i) => ({
  _id: `rule_${i}`,
  ...r,
  categoryId: null,
  isActive: true,
}));

describe('NearExpiry Dynamic Pricing Engine — Unit & API Test Suite', () => {
  // =========================================================================
  // PART 1: PURE PRICING ALGORITHM UNIT TESTS (Zero DB Latency)
  // =========================================================================
  describe('1. Unit Tests: evaluateDynamicPricingAlgorithm()', () => {
    it('applies 0% discount for 61+ remaining days (status: NORMAL)', () => {
      const res = evaluateDynamicPricingAlgorithm({
        originalPrice: 200,
        remainingDays: 75,
        quantity: 10,
        rules: mockDbRules,
      });
      assert.equal(res.discountPercentage, 0);
      assert.equal(res.finalPrice, 200);
      assert.equal(res.status, 'NORMAL');
      assert.equal(res.isPurchasable, true);
    });

    it('applies 10% discount for 31–60 remaining days (status: NORMAL)', () => {
      const res = evaluateDynamicPricingAlgorithm({
        originalPrice: 200,
        remainingDays: 45,
        quantity: 10,
        rules: mockDbRules,
      });
      assert.equal(res.discountPercentage, 10);
      assert.equal(res.finalPrice, 180);
      assert.equal(res.status, 'NORMAL');
    });

    it('applies 25% discount for 16–30 remaining days (status: APPROACHING_EXPIRY)', () => {
      const res = evaluateDynamicPricingAlgorithm({
        originalPrice: 200,
        remainingDays: 20,
        quantity: 10,
        rules: mockDbRules,
      });
      assert.equal(res.discountPercentage, 25);
      assert.equal(res.finalPrice, 150);
      assert.equal(res.status, 'APPROACHING_EXPIRY');
    });

    it('applies 40% discount for 8–15 remaining days (status: APPROACHING_EXPIRY)', () => {
      const res = evaluateDynamicPricingAlgorithm({
        originalPrice: 200,
        remainingDays: 10,
        quantity: 10,
        rules: mockDbRules,
      });
      assert.equal(res.discountPercentage, 40);
      assert.equal(res.finalPrice, 120);
      assert.equal(res.status, 'APPROACHING_EXPIRY');
    });

    it('applies 60% discount for 3–7 remaining days (status: CRITICAL)', () => {
      const res = evaluateDynamicPricingAlgorithm({
        originalPrice: 200,
        remainingDays: 5,
        quantity: 10,
        rules: mockDbRules,
      });
      assert.equal(res.discountPercentage, 60);
      assert.equal(res.finalPrice, 80);
      assert.equal(res.status, 'CRITICAL');
    });

    it('applies 75% discount for 0–2 remaining days (status: CRITICAL)', () => {
      const res = evaluateDynamicPricingAlgorithm({
        originalPrice: 200,
        remainingDays: 1,
        quantity: 10,
        rules: mockDbRules,
      });
      assert.equal(res.discountPercentage, 75);
      assert.equal(res.finalPrice, 50);
      assert.equal(res.status, 'CRITICAL');
    });

    it('locks out expired products (remainingDays < 0 -> status: EXPIRED, isPurchasable: false)', () => {
      const res = evaluateDynamicPricingAlgorithm({
        originalPrice: 200,
        remainingDays: -1,
        quantity: 10,
        rules: mockDbRules,
      });
      assert.equal(res.status, 'EXPIRED');
      assert.equal(res.isPurchasable, false);
      assert.equal(res.discountPercentage, 0);
    });

    it('rejects invalid discount percentages (> 100% or < 0%) and negative originalPrice', () => {
      assert.throws(() => {
        evaluateDynamicPricingAlgorithm({
          originalPrice: -50,
          remainingDays: 10,
          rules: mockDbRules,
        });
      });

      assert.throws(() => {
        evaluateDynamicPricingAlgorithm({
          originalPrice: 100,
          remainingDays: 10,
          rules: [{ minDays: 0, maxDays: 30, discountPercentage: 120, isActive: true }],
        });
      });
    });
  });

  // =========================================================================
  // PART 2: LIVE REST API & MONGODB INTEGRATION TESTS
  // =========================================================================
  describe('2. Live API Integration Tests: Database Rules, Admin Rule Edits & Audit Logs', () => {
    let server;
    let baseUrl;
    let adminToken;
    let sellerToken;
    let batch5DaysId;
    let rule3To7Id;

    before(async () => {
      await connectDB();
      server = http.createServer(app);
      await new Promise((resolve) => server.listen(0, resolve));
      baseUrl = `http://localhost:${server.address().port}/api/v1`;
      const ts = Date.now();

      // Register Admin
      const adminRes = await fetch(`${baseUrl}/auth/register/admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Pricing Admin',
          email: `padmin.${ts}@nearexpiry.com`,
          password: 'Password123!',
        }),
      });
      adminToken = (await adminRes.json()).data.token;

      // Seed default 6-tier rules in MongoDB
      await fetch(`${baseUrl}/pricing/rules/seed-defaults`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      // Create Category, Seller, Store, and Product
      const catRes = await fetch(`${baseUrl}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ name: `Cosmetics ${ts}`, status: 'ACTIVE' }),
      });
      const categoryId = (await catRes.json()).data.category._id;

      const sRes = await fetch(`${baseUrl}/auth/register/seller`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Seller Pricing',
          email: `pseller.${ts}@store.com`,
          phone: '9876543210',
          password: 'Password123!',
          storeName: `GlowStore ${ts}`,
        }),
      });
      sellerToken = (await sRes.json()).data.token;

      await fetch(`${baseUrl}/stores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
        body: JSON.stringify({
          storeName: `GlowStore ${ts}`,
          contactPhone: '9876543210',
          address: { street: 'Brigade Rd', city: 'Bengaluru', state: 'Karnataka', pincode: '560001' },
          latitude: 12.9716,
          longitude: 77.5946,
        }),
      });

      const prodRes = await fetch(`${baseUrl}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
        body: JSON.stringify({
          name: 'Vitamin C Serum 30ml',
          description: 'Brightening serum',
          brand: 'Minimalist',
          category: categoryId,
          unit: 'ml',
        }),
      });
      const productId = (await prodRes.json()).data.product._id;

      // Create a Batch with 5 days remaining (originalPrice: 500 -> should auto-price to 60% off = 200)
      const exp5Days = new Date(Date.now() + 5 * 86400000).toISOString();
      const mfgDate = new Date(Date.now() - 60 * 86400000).toISOString();
      const batchRes = await fetch(`${baseUrl}/batches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
        body: JSON.stringify({
          productId,
          batchNumber: 'SERUM-5D-LOT',
          manufacturingDate: mfgDate,
          expiryDate: exp5Days,
          quantity: 10,
          originalPrice: 500,
        }),
      });
      const batchData = (await batchRes.json()).data.batch;
      batch5DaysId = batchData._id;
    });

    after(async () => {
      if (server) server.close();
      await disconnectDB();
    });

    it('GET /api/v1/pricing/rules returns the 6 database-configured priceRules', async () => {
      const res = await fetch(`${baseUrl}/pricing/rules`);
      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.data.rules.length, 6);
      const rule3To7 = body.data.rules.find((r) => r.minDays === 3 && r.maxDays === 7);
      assert.ok(rule3To7);
      assert.equal(rule3To7.discountPercentage, 60);
      rule3To7Id = rule3To7._id;
    });

    it('automatically computes 60% discount (finalPrice: 200) when Seller creates a 5-day batch', async () => {
      const res = await fetch(`${baseUrl}/pricing/batch/${batch5DaysId}`);
      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.data.pricing.originalPrice, 500);
      assert.equal(body.data.pricing.discountPercentage, 60);
      assert.equal(body.data.pricing.finalPrice, 200);
      assert.equal(body.data.pricing.status, 'CRITICAL');
    });

    it('allows Admin to change 3–7 days rule from 60% to 65% and automatically updates batch finalPrice to 175 with Audit Log', async () => {
      const patchRes = await fetch(`${baseUrl}/pricing/rules/${rule3To7Id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ discountPercentage: 65 }),
      });
      const patchBody = await patchRes.json();
      assert.equal(patchRes.status, 200);
      assert.equal(patchBody.data.rule.discountPercentage, 65);

      // Verify batch price automatically updated to 175 (65% off 500)
      const batchRes = await fetch(`${baseUrl}/batches/${batch5DaysId}`);
      const batchBody = await batchRes.json();
      assert.equal(batchBody.data.batch.discountPercentage, 65);
      assert.equal(batchBody.data.batch.currentPrice, 175);

      // Verify PriceAuditLog recorded the change
      const auditRes = await fetch(`${baseUrl}/pricing/audit-logs?batchId=${batch5DaysId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const auditBody = await auditRes.json();
      assert.equal(auditRes.status, 200);
      assert.ok(auditBody.data.count >= 2);
      assert.equal(auditBody.data.logs[0].newDiscountPercentage, 65);
      assert.equal(auditBody.data.logs[0].newFinalPrice, 175);
    });

    it('captures an immutable purchase-time price snapshot for Orders', async () => {
      const snapRes = await fetch(`${baseUrl}/pricing/purchase-snapshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ batchId: batch5DaysId, quantity: 3 }),
      });
      const snapBody = await snapRes.json();
      assert.equal(snapRes.status, 200);
      assert.equal(snapBody.data.snapshot.originalPrice, 500);
      assert.equal(snapBody.data.snapshot.discountPercentage, 65);
      assert.equal(snapBody.data.snapshot.finalPrice, 175);
      assert.equal(snapBody.data.snapshot.lineFinalTotal, 525);
    });
  });
});
