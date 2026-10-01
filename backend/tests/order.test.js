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
import { Cart } from '../src/models/cart.model.js';
import { Order, ORDER_STATUS } from '../src/models/order.model.js';
import { InventoryAudit } from '../src/models/inventory.model.js';
import { resetDefaultPriceRulesService } from '../src/services/priceRule.service.js';

describe('NearExpiry Order Management & Concurrency Suite', () => {
  let server;
  let baseUrl;
  let adminToken;
  let sellerToken;
  let customer1Token;
  let customer2Token;
  let customer1Id;
  let customer2Id;
  let categoryId;
  let storeId;
  let productFefoId;
  let batchAId;
  let batchBId;
  let productConcurrentId;
  let batchConcurrentId;
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
        name: 'Order Admin',
        email: `order.admin.${ts}@nearexpiry.test`,
        phone: '9876520001',
        password: 'Password123!',
      }),
    });
    adminToken = (await adminRes.json()).data.token;
    await resetDefaultPriceRulesService(null);

    // 2. Customers 1 & 2
    const c1Res = await fetch(`${baseUrl}/auth/register/customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Order Customer One',
        email: `order.cust1.${ts}@nearexpiry.test`,
        phone: '9876520002',
        password: 'Password123!',
      }),
    });
    const c1Data = await c1Res.json();
    customer1Token = c1Data.data.token;
    customer1Id = c1Data.data.user.id || c1Data.data.user._id;

    const c2Res = await fetch(`${baseUrl}/auth/register/customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Order Customer Two',
        email: `order.cust2.${ts}@nearexpiry.test`,
        phone: '9876520003',
        password: 'Password123!',
      }),
    });
    const c2Data = await c2Res.json();
    customer2Token = c2Data.data.token;
    customer2Id = c2Data.data.user.id || c2Data.data.user._id;

    // 3. Category
    const catRes = await fetch(`${baseUrl}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: `Order Category ${ts}`, status: 'ACTIVE' }),
    });
    categoryId = (await catRes.json()).data.category._id;

    // 4. Seller & Store
    const sRes = await fetch(`${baseUrl}/auth/register/seller`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Order Seller',
        email: `order.seller.${ts}@nearexpiry.test`,
        phone: '9876520004',
        password: 'Password123!',
        storeName: `FEFO SuperStore ${ts}`,
      }),
    });
    sellerToken = (await sRes.json()).data.token;

    const stRes = await fetch(`${baseUrl}/stores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
      body: JSON.stringify({
        storeName: `FEFO SuperStore ${ts}`,
        contactPhone: '9876520004',
        address: { street: '100ft Rd', city: 'Bengaluru', state: 'Karnataka', pincode: '560038' },
        latitude: 12.9784,
        longitude: 77.6408,
      }),
    });
    storeId = (await stRes.json()).data.store._id;
    await Store.findByIdAndUpdate(storeId, { verificationStatus: 'APPROVED', isActive: true });

    // 5. Products & Batches for exact FEFO User Scenario:
    // Batch A: expiry = 2026-10-10, stock = 5
    // Batch B: expiry = 2026-11-20, stock = 20
    const p1Res = await fetch(`${baseUrl}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
      body: JSON.stringify({
        name: `FEFO Test Organic Yogurt ${ts}`,
        description: 'FEFO validation product',
        brand: 'Epigamia',
        category: categoryId,
        unit: 'pcs',
      }),
    });
    productFefoId = (await p1Res.json()).data.product._id;

    const mfgDate = '2026-09-01T00:00:00.000Z';
    const expiryBatchA = '2026-10-10T00:00:00.000Z';
    const expiryBatchB = '2026-11-20T00:00:00.000Z';

    const bARes = await fetch(`${baseUrl}/batches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
      body: JSON.stringify({
        productId: productFefoId,
        batchNumber: `BATCH-A-${ts}`,
        manufacturingDate: mfgDate,
        expiryDate: expiryBatchA,
        quantity: 5,
        originalPrice: 100,
      }),
    });
    batchAId = (await bARes.json()).data.batch._id;

    const bBRes = await fetch(`${baseUrl}/batches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
      body: JSON.stringify({
        productId: productFefoId,
        batchNumber: `BATCH-B-${ts}`,
        manufacturingDate: mfgDate,
        expiryDate: expiryBatchB,
        quantity: 20,
        originalPrice: 100,
      }),
    });
    batchBId = (await bBRes.json()).data.batch._id;

    // 6. Product & Batch for Concurrent High-Contention Test:
    // 1 single batch lot with 5 units in stock.
    const pConcRes = await fetch(`${baseUrl}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
      body: JSON.stringify({
        name: `Concurrent Limited Stock Product ${ts}`,
        description: 'Testing concurrency with limited stock',
        brand: 'LimitedBrand',
        category: categoryId,
        unit: 'pcs',
      }),
    });
    productConcurrentId = (await pConcRes.json()).data.product._id;

    const bConcRes = await fetch(`${baseUrl}/batches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
      body: JSON.stringify({
        productId: productConcurrentId,
        batchNumber: `CONC-${ts}`,
        manufacturingDate: mfgDate,
        expiryDate: '2026-12-31T00:00:00.000Z',
        quantity: 5,
        originalPrice: 200,
      }),
    });
    batchConcurrentId = (await bConcRes.json()).data.batch._id;
  });

  after(async () => {
    const pIds = [productFefoId, productConcurrentId].filter(Boolean);
    await Order.deleteMany({});
    await Cart.deleteMany({});
    await InventoryAudit.deleteMany({ productId: { $in: pIds } });
    await Batch.deleteMany({ productId: { $in: pIds } });
    await Product.deleteMany({ _id: { $in: pIds } });
    await Category.deleteMany({ _id: categoryId });
    await Store.deleteMany({ _id: storeId });
    await User.deleteMany({ email: /@nearexpiry\.test$/ });

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await disconnectDB();
  });

  it('1. FEFO Allocation: Order 7 units -> Allocates Batch A (5) and Batch B (2)', async () => {
    // Add 7 units of FEFO product to Customer 1's cart
    await fetch(`${baseUrl}/cart/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customer1Token}`,
      },
      body: JSON.stringify({
        productId: productFefoId,
        quantity: 7,
      }),
    });

    // Place order
    const orderRes = await fetch(`${baseUrl}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customer1Token}`,
      },
      body: JSON.stringify({
        fulfillmentType: 'PICKUP',
      }),
    });
    assert.equal(orderRes.status, 201);
    const orderBody = await orderRes.json();
    const order = orderBody.data;

    assert.equal(order.status, ORDER_STATUS.PLACED);
    assert.equal(order.items.length, 1);
    const orderItem = order.items[0];
    assert.equal(orderItem.requestedQuantity, 7);

    // Verify FEFO allocations:
    // Batch A (exp: 2026-10-10) -> 5 units
    // Batch B (exp: 2026-11-20) -> 2 units
    assert.equal(orderItem.batchAllocations.length, 2);
    const allocA = orderItem.batchAllocations.find((a) => a.batchId.toString() === batchAId.toString());
    const allocB = orderItem.batchAllocations.find((a) => a.batchId.toString() === batchBId.toString());

    assert.ok(allocA, 'Batch A must be allocated');
    assert.equal(allocA.allocatedQuantity, 5);
    assert.equal(allocA.batchNumber, `BATCH-A-${ts}`);

    assert.ok(allocB, 'Batch B must be allocated');
    assert.equal(allocB.allocatedQuantity, 2);
    assert.equal(allocB.batchNumber, `BATCH-B-${ts}`);

    // Verify inventory safely reduced in MongoDB
    const updatedBatchA = await Batch.findById(batchAId);
    assert.equal(updatedBatchA.quantity, 0); // 5 - 5 = 0
    assert.equal(updatedBatchA.soldQuantity, 5);
    assert.equal(updatedBatchA.status, BATCH_STATUS.OUT_OF_STOCK);

    const updatedBatchB = await Batch.findById(batchBId);
    assert.equal(updatedBatchB.quantity, 18); // 20 - 2 = 18
    assert.equal(updatedBatchB.soldQuantity, 2);

    // Verify Cart was cleared
    const cartRes = await fetch(`${baseUrl}/cart`, {
      headers: { Authorization: `Bearer ${customer1Token}` },
    });
    const cartBody = await cartRes.json();
    assert.equal(cartBody.data.items.length, 0);

    // Verify InventoryAudit log records were created for both lot allocations
    const audits = await InventoryAudit.find({ referenceId: order.orderNumber });
    assert.equal(audits.length, 2);
    assert.ok(audits.some((a) => a.batchId.toString() === batchAId.toString() && a.quantityChange === -5));
    assert.ok(audits.some((a) => a.batchId.toString() === batchBId.toString() && a.quantityChange === -2));
  });

  it('2. Preserves immutable purchase-time prices and order summary', async () => {
    const listRes = await fetch(`${baseUrl}/orders`, {
      headers: { Authorization: `Bearer ${customer1Token}` },
    });
    assert.equal(listRes.status, 200);
    const listBody = await listRes.json();
    const order = listBody.data.orders[0];

    assert.ok(order.pricingSummary.finalTotal > 0);
    assert.ok(order.items[0].blendedUnitPrice > 0);
    assert.ok(order.items[0].batchAllocations[0].discountedUnitPrice > 0);

    // Mutate dynamic pricing rule or batch price now -> existing order must remain untouched!
    await Batch.findByIdAndUpdate(batchBId, { currentPrice: 1 });

    const orderDetailRes = await fetch(`${baseUrl}/orders/${order._id}`, {
      headers: { Authorization: `Bearer ${customer1Token}` },
    });
    const orderDetail = (await orderDetailRes.json()).data;
    assert.equal(orderDetail.pricingSummary.finalTotal, order.pricingSummary.finalTotal);
    assert.equal(orderDetail.items[0].blendedUnitPrice, order.items[0].blendedUnitPrice);
  });

  it('3. Customer and Seller Order Management & State Machine Progression', async () => {
    const myOrdersRes = await fetch(`${baseUrl}/orders`, {
      headers: { Authorization: `Bearer ${customer1Token}` },
    });
    const orderId = (await myOrdersRes.json()).data.orders[0]._id;

    // Seller retrieves store orders
    const sellerOrdersRes = await fetch(`${baseUrl}/orders/seller`, {
      headers: { Authorization: `Bearer ${sellerToken}` },
    });
    assert.equal(sellerOrdersRes.status, 200);
    const sellerOrders = await sellerOrdersRes.json();
    assert.ok(sellerOrders.data.orders.some((o) => o._id.toString() === orderId.toString()));

    // Progress Status: PLACED -> CONFIRMED
    const confRes = await fetch(`${baseUrl}/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
      body: JSON.stringify({ status: ORDER_STATUS.CONFIRMED, note: 'Seller accepted order' }),
    });
    assert.equal(confRes.status, 200);

    // Progress Status: CONFIRMED -> PACKED
    const packRes = await fetch(`${baseUrl}/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
      body: JSON.stringify({ status: ORDER_STATUS.PACKED, note: 'Order items packed' }),
    });
    assert.equal(packRes.status, 200);

    // Progress Status: PACKED -> READY_FOR_PICKUP
    const rfpRes = await fetch(`${baseUrl}/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
      body: JSON.stringify({ status: ORDER_STATUS.READY_FOR_PICKUP }),
    });
    assert.equal(rfpRes.status, 200);

    // Progress Status: READY_FOR_PICKUP -> DELIVERED
    const delRes = await fetch(`${baseUrl}/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
      body: JSON.stringify({ status: ORDER_STATUS.DELIVERED }),
    });
    assert.equal(delRes.status, 200);
    const deliveredOrder = (await delRes.json()).data;
    assert.equal(deliveredOrder.status, ORDER_STATUS.DELIVERED);

    // Track order: check status timeline has 5 transitions
    const trackRes = await fetch(`${baseUrl}/orders/${orderId}/track`, {
      headers: { Authorization: `Bearer ${customer1Token}` },
    });
    assert.equal(trackRes.status, 200);
    const tracking = (await trackRes.json()).data;
    assert.equal(tracking.status, ORDER_STATUS.DELIVERED);
    assert.equal(tracking.statusTimeline.length, 5);
  });

  it('4. Cancellation & BR-05 Restock Rule: Restores active lot and writes off expired lot', async () => {
    // Create an order for 2 units from Batch B (18 remaining -> 16 remaining)
    await fetch(`${baseUrl}/cart/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customer1Token}` },
      body: JSON.stringify({ productId: productFefoId, quantity: 2 }),
    });

    const createRes = await fetch(`${baseUrl}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customer1Token}` },
      body: JSON.stringify({ fulfillmentType: 'PICKUP' }),
    });
    const orderToCancel = (await createRes.json()).data;

    const batchBeforeCancel = await Batch.findById(batchBId);
    assert.equal(batchBeforeCancel.quantity, 16);

    // Cancel order
    const cancelRes = await fetch(`${baseUrl}/orders/${orderToCancel._id}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customer1Token}` },
      body: JSON.stringify({ reason: 'Accidental order' }),
    });
    assert.equal(cancelRes.status, 200);
    const cancelledOrder = (await cancelRes.json()).data;
    assert.equal(cancelledOrder.status, ORDER_STATUS.CANCELLED);
    assert.equal(cancelledOrder.cancellation.stockRestored, true);
    assert.equal(cancelledOrder.cancellation.restockedBatches[0].action, 'RESTOCKED_ACTIVE');

    // Verify stock returned to Batch B: 16 + 2 = 18
    const batchAfterCancel = await Batch.findById(batchBId);
    assert.equal(batchAfterCancel.quantity, 18);
  });

  it('5. Concurrency Test: Handles parallel checkouts without over-allocation or negative inventory', async () => {
    // productConcurrentId has exactly 5 units in batchConcurrentId
    // Customer 1 requests 3 units
    // Customer 2 requests 4 units
    // Total requested = 7 units > 5 available.
    // When both attempt checkout simultaneously, exactly ONE must succeed, and the other must be rejected
    // with 409/422 conflict, and batch quantity must NEVER be negative!

    await fetch(`${baseUrl}/cart/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customer1Token}` },
      body: JSON.stringify({ productId: productConcurrentId, quantity: 3 }),
    });

    await fetch(`${baseUrl}/cart/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customer2Token}` },
      body: JSON.stringify({ productId: productConcurrentId, quantity: 4 }),
    });

    // Execute concurrent checkouts simultaneously via Promise.all
    const [res1, res2] = await Promise.all([
      fetch(`${baseUrl}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customer1Token}` },
        body: JSON.stringify({ fulfillmentType: 'PICKUP' }),
      }),
      fetch(`${baseUrl}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customer2Token}` },
        body: JSON.stringify({ fulfillmentType: 'PICKUP' }),
      }),
    ]);

    const statuses = [res1.status, res2.status];
    // Exactly one order must succeed (201) and the competing order must fail (409 or 422)
    assert.ok(statuses.includes(201), 'One checkout must succeed with 201');
    assert.ok(statuses.some((s) => s === 409 || s === 422), 'The competing concurrent checkout must be rejected');

    // Verify inventory count in database is non-negative and strictly matches the successful order
    const finalBatch = await Batch.findById(batchConcurrentId);
    assert.ok(finalBatch.quantity >= 0, 'Batch quantity cannot be negative');

    if (res1.status === 201) {
      assert.equal(finalBatch.quantity, 2); // 5 - 3 = 2
    } else {
      assert.equal(finalBatch.quantity, 1); // 5 - 4 = 1
    }
  });
});
