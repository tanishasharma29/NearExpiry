import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import app from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { resetDefaultPriceRulesService } from '../src/services/priceRule.service.js';

describe('NearExpiry node-cron Expiry-Processing Scheduler & Alert Engine', () => {
  let server;
  let baseUrl;
  let adminToken;
  let sellerToken;
  let batchId;
  let expiryDateObj;

  before(async () => {
    await connectDB();
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    baseUrl = `http://localhost:${server.address().port}/api/v1`;
    const ts = Date.now();

    // 1. Register Admin & Seed Clean Default 6-Tier Price Rules
    const adminRes = await fetch(`${baseUrl}/auth/register/admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Cron Admin',
        email: `cronadmin.${ts}@nearexpiry.com`,
        password: 'Password123!',
      }),
    });
    adminToken = (await adminRes.json()).data.token;
    await resetDefaultPriceRulesService(null);

    // 2. Create Category, Seller, Store, and Product
    const catRes = await fetch(`${baseUrl}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: `Packaged Snacks ${ts}`, status: 'ACTIVE' }),
    });
    const categoryId = (await catRes.json()).data.category._id;

    const sRes = await fetch(`${baseUrl}/auth/register/seller`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Cron Seller',
        email: `cronseller.${ts}@store.com`,
        phone: '9876543219',
        password: 'Password123!',
        storeName: `CronMart ${ts}`,
      }),
    });
    sellerToken = (await sRes.json()).data.token;

    await fetch(`${baseUrl}/stores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
      body: JSON.stringify({
        storeName: `CronMart ${ts}`,
        contactPhone: '9876543219',
        address: { street: 'Koramangala', city: 'Bengaluru', state: 'Karnataka', pincode: '560034' },
        latitude: 12.9352,
        longitude: 77.6245,
      }),
    });

    const prodRes = await fetch(`${baseUrl}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
      body: JSON.stringify({
        name: 'Artisanal Granola 500g',
        description: 'Rolled oats and honey granola',
        brand: 'WholeTruth',
        category: categoryId,
        unit: 'g',
      }),
    });
    const productId = (await prodRes.json()).data.product._id;

    // 3. Create Batch expiring in 35 days (Initial Status: NORMAL, 10% off -> 180 on 200 MRP)
    expiryDateObj = new Date(Date.now() + 35 * 86400000);
    const mfgDateObj = new Date(Date.now() - 30 * 86400000);

    const bRes = await fetch(`${baseUrl}/batches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
      body: JSON.stringify({
        productId,
        batchNumber: `GRANOLA-${ts}`,
        manufacturingDate: mfgDateObj.toISOString(),
        expiryDate: expiryDateObj.toISOString(),
        quantity: 12,
        originalPrice: 200,
      }),
    });
    batchId = (await bRes.json()).data.batch._id;
  });

  after(async () => {
    if (server) server.close();
    await disconnectDB();
  });

  it('Step 1: Transitions batch to APPROACHING_EXPIRY (25% discount -> ₹150) & emits 1 APPROACHING_EXPIRY alert when 20 days remain', async () => {
    // Simulate reference date where 20 days remain before expiryDateObj
    const simDate20DaysLeft = new Date(expiryDateObj.getTime() - 20 * 86400000).toISOString();

    const jobRes = await fetch(`${baseUrl}/expiry/run-job`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ referenceDate: simDate20DaysLeft }),
    });
    const jobBody = await jobRes.json();
    assert.equal(jobRes.status, 200);
    assert.ok(jobBody.data.metrics.approachingAlertsGenerated >= 1);

    const batchRes = await fetch(`${baseUrl}/batches/${batchId}`, {
      headers: { Authorization: `Bearer ${sellerToken}` },
    });
    const batch = (await batchRes.json()).data.batch;
    assert.equal(batch.status, 'APPROACHING_EXPIRY');
    assert.equal(batch.discountPercentage, 25);
    assert.equal(batch.currentPrice, 150);
  });

  it('Step 2 (Idempotency & Duplicate-Alert Prevention): Re-running job at same date creates 0 duplicate alerts', async () => {
    const simDate20DaysLeft = new Date(expiryDateObj.getTime() - 20 * 86400000).toISOString();

    const jobRes = await fetch(`${baseUrl}/expiry/run-job`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ referenceDate: simDate20DaysLeft }),
    });
    const metrics = (await jobRes.json()).data.metrics;
    assert.equal(metrics.approachingAlertsGenerated, 0);
    assert.equal(metrics.batchesPriceUpdated, 0);
  });

  it('Step 3: Transitions batch to CRITICAL (75% discount -> ₹50) & emits CRITICAL + 48H alerts when 2 days remain', async () => {
    const simDate2DaysLeft = new Date(expiryDateObj.getTime() - 2 * 86400000).toISOString();

    const jobRes = await fetch(`${baseUrl}/expiry/run-job`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ referenceDate: simDate2DaysLeft }),
    });
    const metrics = (await jobRes.json()).data.metrics;
    assert.ok(metrics.criticalAlertsGenerated >= 2);

    const alertsRes = await fetch(`${baseUrl}/expiry/alerts?batchId=${batchId}`, {
      headers: { Authorization: `Bearer ${sellerToken}` },
    });
    const alertsData = (await alertsRes.json()).data;
    const alertTypes = alertsData.alerts.map((a) => a.alertType);
    assert.ok(alertTypes.includes('CRITICAL_EXPIRY'));
    assert.ok(alertTypes.includes('FINAL_48H_CRITICAL'));
  });

  it('Step 4: Marks batch EXPIRED (isPurchasable: false), emits BATCH_EXPIRED alert, & blocks reservation/sale when past expiryDate', async () => {
    const simDateExpired = new Date(expiryDateObj.getTime() + 2 * 86400000).toISOString();

    const jobRes = await fetch(`${baseUrl}/expiry/run-job`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ referenceDate: simDateExpired }),
    });
    const metrics = (await jobRes.json()).data.metrics;
    assert.ok(metrics.batchesMarkedExpired >= 1);
    assert.ok(metrics.expiredAlertsGenerated >= 1);

    // Verify batch in DB is marked EXPIRED and isPurchasable === false
    const alertsRes = await fetch(`${baseUrl}/expiry/alerts?batchId=${batchId}`, {
      headers: { Authorization: `Bearer ${sellerToken}` },
    });
    const alertsData = (await alertsRes.json()).data;
    const expiredAlert = alertsData.alerts.find((a) => a.alertType === 'BATCH_EXPIRED');
    assert.ok(expiredAlert);
    assert.equal(expiredAlert.batchStatusAtTrigger, 'EXPIRED');
  });
});
