import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import app from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/user.model.js';
import { Store } from '../src/models/store.model.js';
import { Category } from '../src/models/category.model.js';
import { Product } from '../src/models/product.model.js';
import { Batch, BATCH_STATUS } from '../src/models/batch.model.js';
import { QrVerification, QR_STATUS } from '../src/models/qrVerification.model.js';
import { resetDefaultPriceRulesService } from '../src/services/priceRule.service.js';

describe('NearExpiry QR Batch Verification Module Test Suite', () => {
  let server;
  let baseUrl;
  let adminToken;
  let sellerToken;
  let seller2Token;
  let customerToken;
  let categoryId;
  let storeId;
  let store2Id;
  let productId;
  let activeBatchId;
  let expiredBatchId;
  let activeQrToken;
  let ts;

  before(async () => {
    await connectDB();

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}/api/v1`;

    ts = Date.now().toString().slice(-6);

    // 1. Register Admin
    const adminRes = await fetch(`${baseUrl}/auth/register/admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'QR Admin',
        email: `qr.admin.${ts}@nearexpiry.test`,
        phone: '9876540001',
        password: 'Password123!',
      }),
    });
    adminToken = (await adminRes.json()).data.token;
    await resetDefaultPriceRulesService(null);

    // 2. Register Seller 1
    const s1Res = await fetch(`${baseUrl}/auth/register/seller`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'QR Primary Seller',
        email: `qr.seller1.${ts}@nearexpiry.test`,
        phone: '9876540002',
        password: 'Password123!',
        storeName: `Organic Pantry ${ts}`,
      }),
    });
    sellerToken = (await s1Res.json()).data.token;

    const st1Res = await fetch(`${baseUrl}/stores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
      body: JSON.stringify({
        storeName: `Organic Pantry ${ts}`,
        contactPhone: '9876540002',
        address: { street: 'Koramangala 4th Block', city: 'Bengaluru', state: 'Karnataka', pincode: '560034' },
        latitude: 12.9352,
        longitude: 77.6245,
      }),
    });
    storeId = (await st1Res.json()).data.store._id;
    await Store.findByIdAndUpdate(storeId, { verificationStatus: 'APPROVED', isActive: true });

    // 3. Register Seller 2 (for authorization tests)
    const s2Res = await fetch(`${baseUrl}/auth/register/seller`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'QR Other Seller',
        email: `qr.seller2.${ts}@nearexpiry.test`,
        phone: '9876540003',
        password: 'Password123!',
        storeName: `Green Grocers ${ts}`,
      }),
    });
    seller2Token = (await s2Res.json()).data.token;

    const st2Res = await fetch(`${baseUrl}/stores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${seller2Token}` },
      body: JSON.stringify({
        storeName: `Green Grocers ${ts}`,
        contactPhone: '9876540003',
        address: { street: 'HSR Layout Sector 1', city: 'Bengaluru', state: 'Karnataka', pincode: '560102' },
        latitude: 12.9121,
        longitude: 77.6446,
      }),
    });
    store2Id = (await st2Res.json()).data.store._id;
    await Store.findByIdAndUpdate(store2Id, { verificationStatus: 'APPROVED', isActive: true });

    // 4. Register Customer
    const cRes = await fetch(`${baseUrl}/auth/register/customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'QR Scanner Shopper',
        email: `qr.shopper.${ts}@nearexpiry.test`,
        phone: '9876540004',
        password: 'Password123!',
      }),
    });
    customerToken = (await cRes.json()).data.token;

    // 5. Category
    const catRes = await fetch(`${baseUrl}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: `QR Dairy Foods ${ts}`, status: 'ACTIVE' }),
    });
    categoryId = (await catRes.json()).data.category._id;

    // 6. Product
    const pRes = await fetch(`${baseUrl}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
      body: JSON.stringify({
        name: `Farm Fresh Greek Yogurt ${ts}`,
        description: 'Rich probiotic unsweetened greek yogurt 400g',
        brand: 'Epigamia',
        category: categoryId,
        unit: 'pack',
      }),
    });
    productId = (await pRes.json()).data.product._id;

    // 7. Active Batch (Valid shelf life: expires in 45 days)
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 45);

    const b1Res = await fetch(`${baseUrl}/batches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
      body: JSON.stringify({
        productId,
        batchNumber: `QR-ACT-${ts}`,
        manufacturingDate: '2026-09-01T00:00:00.000Z',
        expiryDate: futureDate.toISOString(),
        quantity: 25,
        originalPrice: 150,
      }),
    });
    activeBatchId = (await b1Res.json()).data.batch._id;

    // 8. Expired Batch (Expired 10 days ago)
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 10);

    const b2Res = await fetch(`${baseUrl}/batches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
      body: JSON.stringify({
        productId,
        batchNumber: `QR-EXP-${ts}`,
        manufacturingDate: '2026-08-01T00:00:00.000Z',
        expiryDate: futureDate.toISOString(),
        quantity: 10,
        originalPrice: 150,
      }),
    });
    expiredBatchId = (await b2Res.json()).data.batch._id;
    await Batch.findByIdAndUpdate(expiredBatchId, {
      expiryDate: pastDate,
      remainingDays: -10,
      status: BATCH_STATUS.EXPIRED,
      isPurchasable: false,
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await disconnectDB();
  });

  describe('1. Secure QR Generation', () => {
    it('should generate a secure QR code and cryptographic token for a batch by store seller', async () => {
      const res = await fetch(`${baseUrl}/qr/batch/${activeBatchId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sellerToken}`,
        },
      });

      const body = await res.json();
      assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(body)}`);
      assert.equal(body.success, true);
      assert.ok(body.data.token, 'Should return secure cryptographic token');
      assert.ok(body.data.token.includes('.'), 'Token must be composed of signed segments');
      assert.ok(body.data.qrDataUrl.startsWith('data:image/png;base64,'), 'QR data URL should be PNG base64');
      assert.ok(body.data.verificationUrl.includes(body.data.token), 'Verification URL must embed token');
      assert.equal(body.data.status, 'ACTIVE');
      assert.equal(body.data.batchId, activeBatchId);
      assert.ok(body.data.productName.includes('Greek Yogurt'));

      activeQrToken = body.data.token;

      // Verify MongoDB persistence
      const qrDoc = await QrVerification.findOne({ batchId: activeBatchId });
      assert.ok(qrDoc, 'QrVerification document should be stored in MongoDB');
      assert.equal(qrDoc.status, QR_STATUS.ACTIVE);
      assert.ok(qrDoc.tokenNonce, 'Document must store cryptographic nonce');
      assert.ok(qrDoc.tokenHash, 'Document must store SHA-256 token hash');
    });

    it('should forbid unauthorized seller from generating QR for another store lot', async () => {
      const res = await fetch(`${baseUrl}/qr/batch/${activeBatchId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${seller2Token}`,
        },
      });

      const body = await res.json();
      assert.equal(res.status, 403);
      assert.equal(body.errorCode, 'FORBIDDEN');
    });

    it('should return 404 for non-existent batch ID', async () => {
      const fakeId = '66f7ffffffffffffffffffff';
      const res = await fetch(`${baseUrl}/qr/batch/${fakeId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sellerToken}`,
        },
      });

      const body = await res.json();
      assert.equal(res.status, 404);
      assert.equal(body.errorCode, 'BATCH_NOT_FOUND');
    });
  });

  describe('2. Public QR Verification & Live MongoDB Resolution', () => {
    it('should verify genuine active QR token via GET and resolve true live data from MongoDB', async () => {
      const res = await fetch(`${baseUrl}/qr/verify?token=${encodeURIComponent(activeQrToken)}`, {
        method: 'GET',
        headers: { 'User-Agent': 'TestMobileScanner/1.0' },
      });

      const body = await res.json();
      assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(body)}`);
      assert.equal(body.success, true);
      const data = body.data;

      // Required verification payload assertions
      assert.equal(data.isValid, true);
      assert.equal(data.verificationStatus, 'GENUINE_ACTIVE');
      assert.ok(data.product, 'Must return product details');
      assert.ok(data.product.name.includes('Greek Yogurt'));
      assert.equal(data.brand, 'Epigamia', 'Must return brand');
      assert.ok(data.batchNumber.startsWith('QR-ACT-'), 'Must return batch number');
      assert.ok(data.store, 'Must return store information');
      assert.ok(data.store.storeName.includes('Organic Pantry'));
      assert.ok(data.expiryDate, 'Must return live expiryDate from MongoDB');
      assert.ok(data.remainingDays > 0, 'Remaining days must be positive');
      assert.equal(data.isPurchasable, true);
    });

    it('should verify genuine active QR token via POST with JSON body', async () => {
      const res = await fetch(`${baseUrl}/qr/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'NearExpiryCustomerApp/2.4',
        },
        body: JSON.stringify({ token: activeQrToken }),
      });

      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.data.isValid, true);
      assert.equal(body.data.verificationStatus, 'GENUINE_ACTIVE');
    });

    it('should resolve expired status from MongoDB for expired batch (Never trust QR)', async () => {
      // Generate QR for the expired batch
      const genRes = await fetch(`${baseUrl}/qr/batch/${expiredBatchId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sellerToken}`,
        },
      });
      const genBody = await genRes.json();
      const expiredToken = genBody.data.token;

      // Verify the expired batch token
      const verifyRes = await fetch(`${baseUrl}/qr/verify?token=${encodeURIComponent(expiredToken)}`);
      const verifyBody = await verifyRes.json();

      assert.equal(verifyRes.status, 200);
      assert.equal(verifyBody.data.isValid, true);
      assert.equal(
        verifyBody.data.verificationStatus,
        'GENUINE_BUT_EXPIRED',
        'Verification status must accurately reflect expired lot'
      );
      assert.equal(verifyBody.data.isPurchasable, false, 'Expired lot cannot be purchased');
      assert.ok(new Date(verifyBody.data.expiryDate) < new Date(), 'Expiry date must be in the past');
    });
  });

  describe('3. Cryptographic Forgery & Invalid QR Handling', () => {
    it('should reject tampered or forged token signature with 400 INVALID_QR_SIGNATURE', async () => {
      // Tamper signature by changing the last character
      const tamperedToken = activeQrToken.slice(0, -1) + (activeQrToken.endsWith('a') ? 'b' : 'a');

      const res = await fetch(`${baseUrl}/qr/verify?token=${encodeURIComponent(tamperedToken)}`);
      const body = await res.json();

      assert.equal(res.status, 400);
      assert.equal(body.errorCode, 'INVALID_QR_SIGNATURE');
    });

    it('should reject malformed token format with 400 MALFORMED_QR_TOKEN', async () => {
      const res = await fetch(`${baseUrl}/qr/verify?token=not-a-valid-three-part-token`);
      const body = await res.json();

      assert.equal(res.status, 400);
      assert.equal(body.errorCode, 'MALFORMED_QR_TOKEN');
    });

    it('should reject empty or missing token with 400', async () => {
      const res = await fetch(`${baseUrl}/qr/verify`);
      const body = await res.json();

      assert.equal(res.status, 400);
    });

    it('should return 404 for validly signed token with unregistered nonce in MongoDB', async () => {
      // Craft a token that has valid format and signature with a new random nonce
      const { generateSecureQrToken } = await import('../src/utils/qrToken.js');
      const { token: ghostToken } = generateSecureQrToken(activeBatchId);

      const res = await fetch(`${baseUrl}/qr/verify?token=${encodeURIComponent(ghostToken)}`);
      const body = await res.json();

      assert.equal(res.status, 404);
      assert.equal(body.errorCode, 'QR_TOKEN_NOT_REGISTERED');
    });
  });

  describe('4. Revocation Workflow', () => {
    it('should allow authorized seller to revoke QR code with mandatory reason', async () => {
      const revokeRes = await fetch(`${baseUrl}/qr/batch/${activeBatchId}/revoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sellerToken}`,
        },
        body: JSON.stringify({
          reason: 'Packaging seal integrity compromised during cold-storage transit',
        }),
      });

      const body = await revokeRes.json();
      assert.equal(revokeRes.status, 200);
      assert.equal(body.data.status, 'REVOKED');
      assert.equal(body.data.revokedReason, 'Packaging seal integrity compromised during cold-storage transit');
      assert.ok(body.data.revokedAt);
    });

    it('should forbid unauthorized seller from revoking another store QR code', async () => {
      const res = await fetch(`${baseUrl}/qr/batch/${activeBatchId}/revoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${seller2Token}`,
        },
        body: JSON.stringify({ reason: 'Malicious revocation attempt' }),
      });

      const body = await res.json();
      assert.equal(res.status, 403);
      assert.equal(body.errorCode, 'FORBIDDEN');
    });

    it('should reject public verification of a revoked QR and return REVOKED status', async () => {
      const res = await fetch(`${baseUrl}/qr/verify?token=${encodeURIComponent(activeQrToken)}`, {
        headers: { 'User-Agent': 'CustomerVerifier/1.0' },
      });

      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.data.isValid, false);
      assert.equal(body.data.verificationStatus, 'REVOKED');
      assert.ok(body.data.message.includes('revoked'));
      assert.equal(body.data.revokedReason, 'Packaging seal integrity compromised during cold-storage transit');
      assert.ok(body.data.revokedAt);
      assert.ok(body.data.brand);
      assert.ok(body.data.batchNumber);
    });
  });

  describe('5. Scan Audit Logging', () => {
    it('should record complete audit history for all verification attempts', async () => {
      const res = await fetch(`${baseUrl}/qr/batch/${activeBatchId}/audit`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${sellerToken}`,
        },
      });

      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.success, true);
      const audit = body.data;

      assert.equal(audit.status, 'REVOKED');
      assert.ok(audit.totalScans >= 3, 'Must record multiple scan events');
      assert.ok(Array.isArray(audit.scanHistory));

      // Scan history should include REVOKED entry and SUCCESS entries
      const scanResults = audit.scanHistory.map((s) => s.result);
      assert.ok(scanResults.includes('REVOKED'), 'Scan history must capture REVOKED scan attempt');
      assert.ok(scanResults.includes('SUCCESS'), 'Scan history must capture SUCCESS scan attempts');

      // Verify audit entry attributes
      const firstEntry = audit.scanHistory[0];
      assert.ok(firstEntry.scannedAt);
      assert.ok(firstEntry.ipAddress);
      assert.ok(firstEntry.userAgent);
      assert.ok(firstEntry.verificationStatus);
    });

    it('should forbid regular customers from viewing internal batch QR audit logs', async () => {
      const res = await fetch(`${baseUrl}/qr/batch/${activeBatchId}/audit`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${customerToken}`,
        },
      });

      const body = await res.json();
      assert.equal(res.status, 403);
    });
  });
});
