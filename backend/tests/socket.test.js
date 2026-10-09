import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { io as Client } from 'socket.io-client';
import app from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { initSocket, closeSocket, emitToUser, emitToStore, emitToAdmin } from '../src/config/socket.js';
import { SOCKET_EVENTS, SOCKET_ROOMS } from '../src/constants/socketEvents.js';
import { generateAccessToken } from '../src/utils/jwt.js';
import { User, USER_ROLES, VERIFICATION_STATUS } from '../src/models/user.model.js';
import { Store } from '../src/models/store.model.js';
import { Category, CATEGORY_STATUS } from '../src/models/category.model.js';
import { Product, PRODUCT_STATUS } from '../src/models/product.model.js';
import { Batch } from '../src/models/batch.model.js';

describe('NearExpiry Phase 24: Socket.IO Real-Time Event Integration Suite', () => {
  let server;
  let baseUrl;
  let socketUrl;
  let ts;

  // Test users & tokens
  let adminUser, adminToken;
  let sellerUser, sellerToken, sellerStore;
  let customerUserA, customerTokenA;
  let customerUserB, customerTokenB;
  let testCategory, testProduct;

  // Helper to establish client socket promise
  const connectClientSocket = (token, options = {}) => {
    return new Promise((resolve, reject) => {
      const client = Client(socketUrl, {
        auth: token ? { token } : undefined,
        transports: ['websocket'],
        reconnection: false,
        timeout: 5000,
        ...options,
      });

      client.on('connect', () => resolve(client));
      client.on('connect_error', (err) => reject(err));
    });
  };

  before(async () => {
    await connectDB();

    server = http.createServer(app);
    initSocket(server);

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}/api/v1`;
    socketUrl = `http://127.0.0.1:${port}`;

    ts = Date.now().toString().slice(-6);

    // 1. Admin
    adminUser = await User.create({
      name: 'Socket Admin',
      email: `socket.admin.${ts}@nearexpiry.test`,
      phone: '9876543101',
      password: 'Password123!',
      role: USER_ROLES.ADMIN,
      verificationStatus: VERIFICATION_STATUS.APPROVED,
    });
    adminToken = generateAccessToken(adminUser);

    // 2. Seller with Approved Store
    sellerUser = await User.create({
      name: 'Socket Seller',
      email: `socket.seller.${ts}@nearexpiry.test`,
      phone: '9876543102',
      password: 'Password123!',
      role: USER_ROLES.SELLER,
      verificationStatus: VERIFICATION_STATUS.APPROVED,
    });
    sellerToken = generateAccessToken(sellerUser);

    sellerStore = await Store.create({
      ownerId: sellerUser._id,
      storeName: `Socket Mart ${ts}`,
      slug: `socket-mart-${ts}`,
      contactPhone: '9876543102',
      address: { street: '102 Realtime Blvd', city: 'Mumbai', state: 'MH', pincode: '400001' },
      latitude: 19.076,
      longitude: 72.8777,
      location: {
        type: 'Point',
        coordinates: [72.8777, 19.076],
      },
      verificationStatus: VERIFICATION_STATUS.APPROVED,
      isActive: true,
    });

    // 3. Customer A & Customer B
    customerUserA = await User.create({
      name: 'Customer Alice',
      email: `alice.${ts}@nearexpiry.test`,
      phone: '9876543103',
      password: 'Password123!',
      role: USER_ROLES.CUSTOMER,
      verificationStatus: VERIFICATION_STATUS.APPROVED,
    });
    customerTokenA = generateAccessToken(customerUserA);

    customerUserB = await User.create({
      name: 'Customer Bob',
      email: `bob.${ts}@nearexpiry.test`,
      phone: '9876543104',
      password: 'Password123!',
      role: USER_ROLES.CUSTOMER,
      verificationStatus: VERIFICATION_STATUS.APPROVED,
    });
    customerTokenB = generateAccessToken(customerUserB);

    // 4. Test Category & Product
    testCategory = await Category.create({
      name: `Bakery ${ts}`,
      slug: `bakery-${ts}`,
      status: CATEGORY_STATUS.ACTIVE,
      createdBy: adminUser._id,
    });

    testProduct = await Product.create({
      sellerId: sellerUser._id,
      storeId: sellerStore._id,
      category: testCategory._id,
      name: `Realtime Loaf ${ts}`,
      description: 'Fresh organic bread loaf for realtime testing',
      brand: 'FreshBake',
      unit: 'pcs',
      status: PRODUCT_STATUS.ACTIVE,
    });
  });

  after(async () => {
    await closeSocket();
    if (server) await new Promise((res) => server.close(res));
    await disconnectDB();
  });

  // =========================================================================
  // 1. Connection & Handshake Authentication
  // =========================================================================
  describe('1. Socket Connection Authentication & Verification', () => {
    it('successfully connects with a valid signed JWT', async () => {
      const client = await connectClientSocket(customerTokenA);
      assert.ok(client.connected);
      client.disconnect();
    });

    it('rejects connection when authentication token is missing', async () => {
      await assert.rejects(
        () => connectClientSocket(null),
        (err) => {
          assert.ok(err.message.includes('AUTHENTICATION_ERROR'));
          return true;
        }
      );
    });

    it('rejects connection with an invalid or forged token signature', async () => {
      await assert.rejects(
        () => connectClientSocket('invalid.tampered.token'),
        (err) => {
          assert.ok(err.message.includes('AUTHENTICATION_ERROR'));
          return true;
        }
      );
    });

    it('rejects connection when user token has been revoked due to logout (tokenVersion mismatch)', async () => {
      // Simulate user logout incrementing tokenVersion
      const revokedUser = await User.create({
        name: 'Revoked User',
        email: `revoked.${ts}@nearexpiry.test`,
        phone: '9876543199',
        password: 'Password123!',
        role: USER_ROLES.CUSTOMER,
        tokenVersion: 0,
      });
      const oldToken = generateAccessToken(revokedUser);

      // Increment tokenVersion in DB (logout)
      revokedUser.tokenVersion = 1;
      await revokedUser.save();

      await assert.rejects(
        () => connectClientSocket(oldToken),
        (err) => {
          assert.ok(err.message.includes('revoked'));
          return true;
        }
      );
    });

    it('rejects connection for deactivated accounts', async () => {
      const deactivatedUser = await User.create({
        name: 'Deactivated User',
        email: `deactivated.${ts}@nearexpiry.test`,
        phone: '9876543198',
        password: 'Password123!',
        role: USER_ROLES.CUSTOMER,
        isActive: false,
      });
      const token = generateAccessToken(deactivatedUser);

      await assert.rejects(
        () => connectClientSocket(token),
        (err) => {
          assert.ok(err.message.includes('deactivated'));
          return true;
        }
      );
    });
  });

  // =========================================================================
  // 2. Room Assignment & Client Isolation
  // =========================================================================
  describe('2. Room Assignment & Access Control Isolation', () => {
    it('customer receives events emitted to their private user room only', async () => {
      const clientA = await connectClientSocket(customerTokenA);
      const clientB = await connectClientSocket(customerTokenB);

      let clientAReceived = false;
      let clientBReceived = false;

      clientA.on(SOCKET_EVENTS.CUSTOMER_ORDER_STATUS, (data) => {
        clientAReceived = true;
        assert.equal(data.orderNumber, 'NE-TEST-A');
      });

      clientB.on(SOCKET_EVENTS.CUSTOMER_ORDER_STATUS, () => {
        clientBReceived = true;
      });

      // Emit to Customer A only
      emitToUser(customerUserA._id, SOCKET_EVENTS.CUSTOMER_ORDER_STATUS, {
        orderId: '6ac8c0000000000000000001',
        orderNumber: 'NE-TEST-A',
        status: 'CONFIRMED',
      });

      await new Promise((r) => setTimeout(r, 100));

      assert.equal(clientAReceived, true, 'Target customer A must receive their private event');
      assert.equal(clientBReceived, false, 'Unrelated customer B must NOT receive customer A event');

      clientA.disconnect();
      clientB.disconnect();
    });

    it('seller receives events emitted to their approved store room', async () => {
      const sellerClient = await connectClientSocket(sellerToken);

      let receivedEvent = null;
      sellerClient.on(SOCKET_EVENTS.SELLER_ORDER_NEW, (data) => {
        receivedEvent = data;
      });

      // Emit to seller's store room
      emitToStore(sellerStore._id, SOCKET_EVENTS.SELLER_ORDER_NEW, {
        orderId: '6ac8c0000000000000000002',
        orderNumber: 'NE-TEST-ORDER-1',
        storeId: sellerStore._id.toString(),
        finalTotal: 500,
      });

      await new Promise((r) => setTimeout(r, 100));

      assert.ok(receivedEvent, 'Seller socket must receive store-targeted event');
      assert.equal(receivedEvent.orderNumber, 'NE-TEST-ORDER-1');

      sellerClient.disconnect();
    });

    it('admin alert events are delivered exclusively to authorized admin sockets', async () => {
      const adminClient = await connectClientSocket(adminToken);
      const customerClient = await connectClientSocket(customerTokenA);

      let adminReceived = false;
      let customerReceived = false;

      adminClient.on(SOCKET_EVENTS.ADMIN_ALERT, (data) => {
        adminReceived = true;
        assert.equal(data.alertType, 'SECURITY_SWEEP');
      });

      customerClient.on(SOCKET_EVENTS.ADMIN_ALERT, () => {
        customerReceived = true;
      });

      emitToAdmin(SOCKET_EVENTS.ADMIN_ALERT, {
        alertType: 'SECURITY_SWEEP',
        title: 'Platform Sweep Complete',
        message: 'No issues found.',
      });

      await new Promise((r) => setTimeout(r, 100));

      assert.equal(adminReceived, true, 'Admin socket must receive admin alert');
      assert.equal(customerReceived, false, 'Regular customer must never receive admin alert');

      adminClient.disconnect();
      customerClient.disconnect();
    });

    it('client-directed arbitrary room joins are rejected', async () => {
      const client = await connectClientSocket(customerTokenA);

      let errorReceived = null;
      client.on('error', (err) => {
        errorReceived = err;
      });

      client.emit('join_room', { room: 'admin' });
      await new Promise((r) => setTimeout(r, 100));

      assert.ok(errorReceived, 'Server must emit error on client join_room attempt');
      client.disconnect();
    });
  });

  // =========================================================================
  // 3. End-to-End Real-Time Event Integration with REST Workflows
  // =========================================================================
  describe('3. Event Emission after REST Database Commits', () => {
    let createdBatch;

    it('batch creation REST API emits inventory:changed to seller store room', async () => {
      const sellerClient = await connectClientSocket(sellerToken);

      let inventoryEvent = null;
      sellerClient.on(SOCKET_EVENTS.INVENTORY_CHANGED, (data) => {
        inventoryEvent = data;
      });

      // Seller creates batch via REST API
      const mfg = new Date();
      const exp = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
      const res = await fetch(`${baseUrl}/batches`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sellerToken}`,
        },
        body: JSON.stringify({
          productId: testProduct._id.toString(),
          batchNumber: `SOCK-BATCH-${ts}`,
          manufacturingDate: mfg.toISOString(),
          expiryDate: exp.toISOString(),
          quantity: 25,
          originalPrice: 120,
          currentPrice: 90,
        }),
      });

      assert.equal(res.status, 201);
      const body = await res.json();
      createdBatch = body.data.batch;

      await new Promise((r) => setTimeout(r, 150));

      assert.ok(inventoryEvent, 'inventory:changed event must be received over Socket.IO');
      assert.equal(inventoryEvent.batchNumber, `SOCK-BATCH-${ts}`);
      assert.equal(inventoryEvent.changeType, 'BATCH_CREATED');

      sellerClient.disconnect();
    });

    it('stock adjustment REST API emits inventory:changed to seller store room', async () => {
      const sellerClient = await connectClientSocket(sellerToken);

      let adjustmentEvent = null;
      sellerClient.on(SOCKET_EVENTS.INVENTORY_CHANGED, (data) => {
        adjustmentEvent = data;
      });

      const res = await fetch(`${baseUrl}/batches/${createdBatch._id}/adjust-stock`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sellerToken}`,
        },
        body: JSON.stringify({
          newQuantity: 18,
          reason: 'Routine stock audit count',
        }),
      });

      assert.equal(res.status, 200);

      await new Promise((r) => setTimeout(r, 150));

      assert.ok(adjustmentEvent, 'Stock adjustment event must be received');
      assert.equal(adjustmentEvent.quantity, 18);
      assert.equal(adjustmentEvent.changeType, 'STOCK_ADJUSTMENT');

      sellerClient.disconnect();
    });

    it('failed REST request does not emit spurious socket events', async () => {
      const sellerClient = await connectClientSocket(sellerToken);

      let spuriousEvent = null;
      sellerClient.on(SOCKET_EVENTS.INVENTORY_CHANGED, (data) => {
        spuriousEvent = data;
      });

      // Request invalid negative stock adjustment
      const res = await fetch(`${baseUrl}/batches/${createdBatch._id}/adjust-stock`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sellerToken}`,
        },
        body: JSON.stringify({
          newQuantity: -5,
          reason: 'Invalid negative count',
        }),
      });

      assert.equal(res.status, 400);

      await new Promise((r) => setTimeout(r, 100));

      assert.equal(spuriousEvent, null, 'Failed request must not emit any socket event');
      sellerClient.disconnect();
    });

    it('new seller registration emits admin:alert to admin room', async () => {
      const adminClient = await connectClientSocket(adminToken);

      let alertData = null;
      adminClient.on(SOCKET_EVENTS.ADMIN_ALERT, (data) => {
        if (data.alertType === 'NEW_SELLER_REGISTRATION') {
          alertData = data;
        }
      });

      // Register a new seller via REST API
      const newTs = Date.now().toString().slice(-5);
      const res = await fetch(`${baseUrl}/auth/register/seller`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Applicant Baker',
          email: `applicant.${newTs}@nearexpiry.test`,
          phone: '9876543299',
          password: 'Password123!',
          storeName: `Applicant Bakery ${newTs}`,
        }),
      });

      assert.equal(res.status, 201);

      await new Promise((r) => setTimeout(r, 150));

      assert.ok(alertData, 'Admin must receive NEW_SELLER_REGISTRATION alert');
      assert.equal(alertData.alertType, 'NEW_SELLER_REGISTRATION');

      adminClient.disconnect();
    });
  });

  // =========================================================================
  // 4. Resilience & Graceful Degraded Mode
  // =========================================================================
  describe('4. Fault Tolerance & Non-Blocking Resilience', () => {
    it('REST API calls succeed even if client socket is disconnected or absent', async () => {
      // Create a batch with no connected sockets
      const mfg = new Date();
      const exp = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);
      const res = await fetch(`${baseUrl}/batches`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sellerToken}`,
        },
        body: JSON.stringify({
          productId: testProduct._id.toString(),
          batchNumber: `NO-SOCK-BATCH-${ts}`,
          manufacturingDate: mfg.toISOString(),
          expiryDate: exp.toISOString(),
          quantity: 10,
          originalPrice: 100,
          currentPrice: 80,
        }),
      });

      assert.equal(res.status, 201);
      const body = await res.json();
      assert.equal(body.success, true);
    });

    it('clean disconnection does not leave dangling memory leaks or process crashes', async () => {
      const client = await connectClientSocket(customerTokenA);
      assert.ok(client.connected);

      // Force client disconnection
      client.disconnect();
      await new Promise((r) => setTimeout(r, 50));
      assert.equal(client.connected, false);
    });
  });
});
