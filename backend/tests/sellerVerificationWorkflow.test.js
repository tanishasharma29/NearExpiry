import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import app from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User, USER_ROLES, VERIFICATION_STATUS } from '../src/models/user.model.js';
import { Store } from '../src/models/store.model.js';
import { Category } from '../src/models/category.model.js';
import { Product } from '../src/models/product.model.js';
import { Batch } from '../src/models/batch.model.js';
import { Notification, NOTIFICATION_TYPES } from '../src/models/notification.model.js';

describe('NearExpiry Seller Verification & Store Access Control Workflow', () => {
  let server;
  let baseUrl;
  let adminToken;
  let pendingSellerToken;
  let pendingSellerId;
  let pendingStoreId;
  let rejectedSellerToken;
  let rejectedSellerId;
  let approvedSellerToken;
  let approvedSellerId;
  let approvedStoreId;
  let approvedProductId;
  let customerToken;
  let activeCategoryId;
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
        name: 'Workflow Admin',
        email: `workflow.admin.${ts}@nearexpiry.test`,
        phone: '9876599001',
        password: 'Password123!',
      }),
    });
    const adminData = await adminRes.json();
    adminToken = adminData.data.token;

    // 2. Register Active Category
    const catRes = await fetch(`${baseUrl}/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: `Workflow Cat ${ts}`,
        status: 'ACTIVE',
      }),
    });
    const catData = await catRes.json();
    activeCategoryId = catData.data.category._id;

    // 3. Register Customer
    const custRes = await fetch(`${baseUrl}/auth/register/customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Workflow Customer',
        email: `workflow.cust.${ts}@nearexpiry.test`,
        phone: '9876599002',
        password: 'Password123!',
      }),
    });
    const custData = await custRes.json();
    customerToken = custData.data.token;

    // 4. Register Pending Seller (never approved initially)
    const pendingRes = await fetch(`${baseUrl}/auth/register/seller`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Pending Seller',
        email: `workflow.pending.${ts}@nearexpiry.test`,
        phone: '9876599003',
        password: 'Password123!',
        storeName: `Pending Mart ${ts}`,
      }),
    });
    const pendingData = await pendingRes.json();
    pendingSellerToken = pendingData.data.token;
    pendingSellerId = pendingData.data.user.id || pendingData.data.user._id;

    // Create Store for Pending Seller
    const storePRes = await fetch(`${baseUrl}/stores`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${pendingSellerToken}`,
      },
      body: JSON.stringify({
        storeName: `Pending Mart ${ts}`,
        contactPhone: '9876599003',
        address: { street: '12 MG Road', city: 'Bengaluru', state: 'Karnataka', pincode: '560001' },
        latitude: 12.9716,
        longitude: 77.5946,
      }),
    });
    const storePData = await storePRes.json();
    pendingStoreId = storePData.data.store._id;

    // 5. Register Rejected Seller
    const rejRes = await fetch(`${baseUrl}/auth/register/seller`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Rejected Seller',
        email: `workflow.rej.${ts}@nearexpiry.test`,
        phone: '9876599004',
        password: 'Password123!',
        storeName: `Rejected Shop ${ts}`,
      }),
    });
    const rejData = await rejRes.json();
    rejectedSellerToken = rejData.data.token;
    rejectedSellerId = rejData.data.user.id || rejData.data.user._id;

    await fetch(`${baseUrl}/stores`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rejectedSellerToken}`,
      },
      body: JSON.stringify({
        storeName: `Rejected Shop ${ts}`,
        contactPhone: '9876599004',
        address: { street: '88 Brigade Road', city: 'Bengaluru', state: 'Karnataka', pincode: '560025' },
        latitude: 12.9719,
        longitude: 77.5950,
      }),
    });

    // 6. Register Approved Seller
    const appRes = await fetch(`${baseUrl}/auth/register/seller`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Approved Seller',
        email: `workflow.approved.${ts}@nearexpiry.test`,
        phone: '9876599005',
        password: 'Password123!',
        storeName: `Approved SuperMart ${ts}`,
      }),
    });
    const appData = await appRes.json();
    approvedSellerToken = appData.data.token;
    approvedSellerId = appData.data.user.id || appData.data.user._id;

    const storeAppRes = await fetch(`${baseUrl}/stores`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${approvedSellerToken}`,
      },
      body: JSON.stringify({
        storeName: `Approved SuperMart ${ts}`,
        contactPhone: '9876599005',
        address: { street: '44 Residency Road', city: 'Bengaluru', state: 'Karnataka', pincode: '560025' },
        latitude: 12.9725,
        longitude: 77.5960,
      }),
    });
    const storeAppData = await storeAppRes.json();
    approvedStoreId = storeAppData.data.store._id;
  });

  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    await disconnectDB();
  });

  describe('1. Role Authorization & RBAC Boundaries', () => {
    it('should reject unauthenticated calls to admin seller approval endpoint with 401', async () => {
      const res = await fetch(`${baseUrl}/admin/sellers/${pendingSellerId}/approval`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'APPROVED' }),
      });
      assert.strictEqual(res.status, 401);
    });

    it('should reject customer calls to admin seller approval endpoint with 403', async () => {
      const res = await fetch(`${baseUrl}/admin/sellers/${pendingSellerId}/approval`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${customerToken}`,
        },
        body: JSON.stringify({ status: 'APPROVED' }),
      });
      assert.strictEqual(res.status, 403);
    });

    it('should reject seller calls to admin seller approval endpoint with 403', async () => {
      const res = await fetch(`${baseUrl}/admin/sellers/${pendingSellerId}/approval`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${pendingSellerToken}`,
        },
        body: JSON.stringify({ status: 'APPROVED' }),
      });
      assert.strictEqual(res.status, 403);
    });
  });

  describe('2. Pending Seller Access Restrictions (Blocked Operational Endpoints)', () => {
    it('should forbid pending seller from creating a product with 403 SELLER_NOT_APPROVED', async () => {
      const res = await fetch(`${baseUrl}/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${pendingSellerToken}`,
        },
        body: JSON.stringify({
          name: `Pending Product ${ts}`,
          description: 'A genuine organic product in testing',
          category: activeCategoryId,
          brand: 'Organic Farm',
          mrp: 120,
          unit: 'PIECE',
        }),
      });
      const data = await res.json();
      assert.strictEqual(res.status, 403);
      assert.strictEqual(data.errorCode, 'SELLER_NOT_APPROVED');
    });

    it('should forbid pending seller from creating a batch with 403 SELLER_NOT_APPROVED', async () => {
      const res = await fetch(`${baseUrl}/batches`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${pendingSellerToken}`,
        },
        body: JSON.stringify({
          productId: '600000000000000000000001',
          batchNumber: `BAT-PENDING-${ts}`,
          expiryDate: new Date(Date.now() + 86400000 * 10).toISOString(),
          quantity: 20,
          purchasePrice: 60,
          sellingPrice: 100,
        }),
      });
      const data = await res.json();
      assert.strictEqual(res.status, 403);
      assert.strictEqual(data.errorCode, 'SELLER_NOT_APPROVED');
    });

    it('should forbid pending seller from adjusting inventory stock with 403 SELLER_NOT_APPROVED', async () => {
      const res = await fetch(`${baseUrl}/inventory/adjust`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${pendingSellerToken}`,
        },
        body: JSON.stringify({
          batchId: '600000000000000000000001',
          quantityDelta: 5,
          reason: 'MANUAL_COUNT_ADJUSTMENT',
        }),
      });
      const data = await res.json();
      assert.strictEqual(res.status, 403);
      assert.strictEqual(data.errorCode, 'SELLER_NOT_APPROVED');
    });

    it('should forbid pending seller from updating order status with 403 SELLER_NOT_APPROVED', async () => {
      const res = await fetch(`${baseUrl}/orders/600000000000000000000001/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${pendingSellerToken}`,
        },
        body: JSON.stringify({
          status: 'READY_FOR_PICKUP',
        }),
      });
      const data = await res.json();
      assert.strictEqual(res.status, 403);
      assert.strictEqual(data.errorCode, 'SELLER_NOT_APPROVED');
    });

    it('should forbid pending seller from verifying pickup QR with 403 SELLER_NOT_APPROVED', async () => {
      const res = await fetch(`${baseUrl}/qr/pickup/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${pendingSellerToken}`,
        },
        body: JSON.stringify({
          pickupToken: 'mock-token',
        }),
      });
      const data = await res.json();
      assert.strictEqual(res.status, 403);
      assert.strictEqual(data.errorCode, 'SELLER_NOT_APPROVED');
    });

    it('should allow pending seller to view their own profile and application status', async () => {
      const res = await fetch(`${baseUrl}/sellers/verification-status`, {
        headers: { Authorization: `Bearer ${pendingSellerToken}` },
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.data.verificationStatus, 'PENDING');
      assert.strictEqual(data.data.isApproved, false);
      assert.strictEqual(data.data.isPending, true);
    });
  });

  describe('3. Admin Approval Workflow & In-App Notification', () => {
    it('should successfully approve a seller, update MongoDB status, and dispatch in-app notification', async () => {
      const res = await fetch(`${baseUrl}/admin/sellers/${approvedSellerId}/approval`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ status: 'APPROVED' }),
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.data.seller.verificationStatus, 'APPROVED');
      assert.strictEqual(data.data.store.verificationStatus, 'APPROVED');
      assert.strictEqual(data.data.store.isActive, true);

      // Verify MongoDB documents
      const sellerDoc = await User.findById(approvedSellerId);
      assert.strictEqual(sellerDoc.verificationStatus, 'APPROVED');
      const storeDoc = await Store.findById(approvedStoreId);
      assert.strictEqual(storeDoc.verificationStatus, 'APPROVED');
      assert.strictEqual(storeDoc.isActive, true);

      // Verify Real In-App Notification was persisted in MongoDB
      const notifs = await Notification.find({
        recipient: approvedSellerId,
        type: NOTIFICATION_TYPES.STORE_APPROVED,
      });
      assert.strictEqual(notifs.length, 1);
      assert.strictEqual(notifs[0].title, 'Your Store Has Been Approved');
      assert.ok(notifs[0].message.includes('Congratulations! Your store has been approved'));
      assert.strictEqual(notifs[0].isRead, false);
    });

    it('should deduplicate repeated Admin approval clicks via deterministic dedupKey', async () => {
      // Re-trigger approval for the same seller
      const res = await fetch(`${baseUrl}/admin/sellers/${approvedSellerId}/approval`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ status: 'APPROVED' }),
      });
      assert.strictEqual(res.status, 200);

      // Verify no duplicate notification was created
      const notifs = await Notification.find({
        recipient: approvedSellerId,
        type: NOTIFICATION_TYPES.STORE_APPROVED,
      });
      assert.strictEqual(notifs.length, 1);
    });

    it('should allow the approved seller to operate their store and create products', async () => {
      const res = await fetch(`${baseUrl}/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${approvedSellerToken}`,
        },
        body: JSON.stringify({
          name: `Approved Mango Yogurt ${ts}`,
          description: 'Delicious creamy yogurt nearing optimal freshness',
          category: activeCategoryId,
          brand: 'FreshFarm',
          mrp: 150,
          unit: 'pcs',
        }),
      });
      const data = await res.json();
      assert.strictEqual(res.status, 201);
      assert.ok(data.data.product._id);
      approvedProductId = data.data.product._id;
    });

    it('should allow the approved seller to retrieve their in-app notifications', async () => {
      const res = await fetch(`${baseUrl}/notifications`, {
        headers: { Authorization: `Bearer ${approvedSellerToken}` },
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      const list = data.data.notifications;
      const approvalNotif = list.find((n) => n.type === 'STORE_APPROVED');
      assert.ok(approvalNotif);
      assert.strictEqual(approvalNotif.title, 'Your Store Has Been Approved');
    });

    it('should allow the approved seller to mark notification as read', async () => {
      const notifs = await Notification.find({ recipient: approvedSellerId });
      const notifId = notifs[0]._id;

      const res = await fetch(`${baseUrl}/notifications/${notifId}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${approvedSellerToken}` },
      });
      assert.strictEqual(res.status, 200);

      const updated = await Notification.findById(notifId);
      assert.strictEqual(updated.isRead, true);
    });
  });

  describe('4. Admin Rejection Workflow & In-App Notification', () => {
    it('should reject a seller, persist safe public reason, and dispatch rejection notification', async () => {
      const rejectionReason = 'Incomplete business tax license documents';
      const res = await fetch(`${baseUrl}/admin/sellers/${rejectedSellerId}/approval`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          status: 'REJECTED',
          rejectionReason,
        }),
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.data.seller.verificationStatus, 'REJECTED');

      // Check DB persistence
      const sellerDoc = await User.findById(rejectedSellerId);
      assert.strictEqual(sellerDoc.verificationStatus, 'REJECTED');
      assert.strictEqual(sellerDoc.sellerProfile.rejectionReason, rejectionReason);

      // Verify in-app rejection notification
      const notifs = await Notification.find({
        recipient: rejectedSellerId,
        type: NOTIFICATION_TYPES.STORE_REJECTED,
      });
      assert.strictEqual(notifs.length, 1);
      assert.strictEqual(notifs[0].title, 'Store Application Update');
      assert.ok(notifs[0].message.includes(rejectionReason));
    });

    it('should deduplicate repeated rejection clicks via deterministic dedupKey', async () => {
      const res = await fetch(`${baseUrl}/admin/sellers/${rejectedSellerId}/approval`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          status: 'REJECTED',
          rejectionReason: 'Incomplete business tax license documents',
        }),
      });
      assert.strictEqual(res.status, 200);

      const notifs = await Notification.find({
        recipient: rejectedSellerId,
        type: NOTIFICATION_TYPES.STORE_REJECTED,
      });
      assert.strictEqual(notifs.length, 1);
    });

    it('should block rejected seller from creating products with 403 STORE_REJECTED', async () => {
      const res = await fetch(`${baseUrl}/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${rejectedSellerToken}`,
        },
        body: JSON.stringify({
          name: `Rejected Product ${ts}`,
          description: 'A rejected product test description',
          category: activeCategoryId,
          brand: 'Blocked Brand',
          mrp: 99,
          unit: 'PIECE',
        }),
      });
      const data = await res.json();
      assert.strictEqual(res.status, 403);
      assert.strictEqual(data.errorCode, 'STORE_REJECTED');
    });

    it('should block rejected seller from creating batches with 403 STORE_REJECTED', async () => {
      const res = await fetch(`${baseUrl}/batches`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${rejectedSellerToken}`,
        },
        body: JSON.stringify({
          productId: approvedProductId,
          batchNumber: `BAT-REJ-${ts}`,
          expiryDate: new Date(Date.now() + 86400000 * 5).toISOString(),
          quantity: 10,
          purchasePrice: 40,
          sellingPrice: 80,
        }),
      });
      const data = await res.json();
      assert.strictEqual(res.status, 403);
      assert.strictEqual(data.errorCode, 'STORE_REJECTED');
    });

    it('should allow rejected seller to view safe rejection status and reason', async () => {
      const res = await fetch(`${baseUrl}/sellers/verification-status`, {
        headers: { Authorization: `Bearer ${rejectedSellerToken}` },
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.data.verificationStatus, 'REJECTED');
      assert.strictEqual(data.data.isApproved, false);
      assert.strictEqual(data.data.isRejected, true);
      assert.strictEqual(data.data.rejectionReason, 'Incomplete business tax license documents');
    });
  });

  describe('5. Cross-Seller Isolation & Ownership Boundaries', () => {
    it('should forbid approved Seller A from modifying Seller B products', async () => {
      // Pending seller attempts to update approved seller product
      const res = await fetch(`${baseUrl}/products/${approvedProductId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${pendingSellerToken}`,
        },
        body: JSON.stringify({
          name: 'Hacked Product Name',
        }),
      });
      assert.strictEqual(res.status, 403);
    });
  });
});
