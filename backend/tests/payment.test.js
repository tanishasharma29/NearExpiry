import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import app from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/user.model.js';
import { Store } from '../src/models/store.model.js';
import { Category } from '../src/models/category.model.js';
import { Product } from '../src/models/product.model.js';
import { Batch } from '../src/models/batch.model.js';
import { Cart } from '../src/models/cart.model.js';
import { Order } from '../src/models/order.model.js';
import { Payment, PAYMENT_STATUS, PAYMENT_METHOD } from '../src/models/payment.model.js';
import { InventoryAudit } from '../src/models/inventory.model.js';
import { resetDefaultPriceRulesService } from '../src/services/priceRule.service.js';

describe('NearExpiry Payment Module & Provider Abstraction Suite', () => {
  let server;
  let baseUrl;
  let adminToken;
  let sellerToken;
  let customerToken;
  let otherCustomerToken;
  let categoryId;
  let storeId;
  let productId;
  let batchId;
  let order1;
  let order2;
  let orderCod;
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
        name: 'Payment Admin',
        email: `pay.admin.${ts}@nearexpiry.test`,
        phone: '9876530001',
        password: 'Password123!',
      }),
    });
    adminToken = (await adminRes.json()).data.token;
    await resetDefaultPriceRulesService(null);

    // 2. Customers
    const cRes = await fetch(`${baseUrl}/auth/register/customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Payment Customer',
        email: `pay.cust.${ts}@nearexpiry.test`,
        phone: '9876530002',
        password: 'Password123!',
      }),
    });
    customerToken = (await cRes.json()).data.token;

    const cOtherRes = await fetch(`${baseUrl}/auth/register/customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Other Customer',
        email: `other.cust.${ts}@nearexpiry.test`,
        phone: '9876530003',
        password: 'Password123!',
      }),
    });
    otherCustomerToken = (await cOtherRes.json()).data.token;

    // 3. Category & Seller
    const catRes = await fetch(`${baseUrl}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: `Payment Category ${ts}`, status: 'ACTIVE' }),
    });
    categoryId = (await catRes.json()).data.category._id;

    const sRes = await fetch(`${baseUrl}/auth/register/seller`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Payment Seller',
        email: `pay.seller.${ts}@nearexpiry.test`,
        phone: '9876530004',
        password: 'Password123!',
        storeName: `PayMart SuperStore ${ts}`,
      }),
    });
    sellerToken = (await sRes.json()).data.token;

    const stRes = await fetch(`${baseUrl}/stores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
      body: JSON.stringify({
        storeName: `PayMart SuperStore ${ts}`,
        contactPhone: '9876530004',
        address: { street: 'Indiranagar 100ft', city: 'Bengaluru', state: 'Karnataka', pincode: '560038' },
        latitude: 12.9784,
        longitude: 77.6408,
      }),
    });
    storeId = (await stRes.json()).data.store._id;
    await Store.findByIdAndUpdate(storeId, { verificationStatus: 'APPROVED', isActive: true });

    // 4. Product & Batch (20 units in stock)
    const pRes = await fetch(`${baseUrl}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
      body: JSON.stringify({
        name: `Payment Test Artisan Granola ${ts}`,
        description: 'High protein rolled oats',
        brand: 'WholeTruth',
        category: categoryId,
        unit: 'pcs',
      }),
    });
    productId = (await pRes.json()).data.product._id;

    const bRes = await fetch(`${baseUrl}/batches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
      body: JSON.stringify({
        productId,
        batchNumber: `PAY-LOT-${ts}`,
        manufacturingDate: '2026-09-01T00:00:00.000Z',
        expiryDate: '2026-11-01T00:00:00.000Z',
        quantity: 20,
        originalPrice: 200,
      }),
    });
    batchId = (await bRes.json()).data.batch._id;

    // Helper to create order for customer
    const createTestOrder = async () => {
      await fetch(`${baseUrl}/cart/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
        body: JSON.stringify({ productId, quantity: 1 }),
      });

      const oRes = await fetch(`${baseUrl}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
        body: JSON.stringify({ fulfillmentType: 'PICKUP' }),
      });
      return (await oRes.json()).data;
    };

    order1 = await createTestOrder();
    order2 = await createTestOrder();
    orderCod = await createTestOrder();
  });

  after(async () => {
    await Payment.deleteMany({});
    await Order.deleteMany({});
    await Cart.deleteMany({});
    await InventoryAudit.deleteMany({ productId });
    await Batch.deleteMany({ productId });
    await Product.deleteMany({ _id: productId });
    await Category.deleteMany({ _id: categoryId });
    await Store.deleteMany({ _id: storeId });
    await User.deleteMany({ email: /@nearexpiry\.test$/ });

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await disconnectDB();
  });

  it('1. Successfully processes MOCK_PAYMENT, updates order paymentStatus to PAID, and preserves zero sensitive card data', async () => {
    const key = `IDEMP-MOCK-SUCCESS-${ts}`;
    const res = await fetch(`${baseUrl}/payments/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        orderId: order1._id,
        method: PAYMENT_METHOD.MOCK_PAYMENT,
        idempotencyKey: key,
        paymentDetails: {
          note: 'Customer paying via instant mock payment',
        },
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.isIdempotentReplay, false);

    const payment = body.data.payment;
    assert.equal(payment.status, PAYMENT_STATUS.SUCCESS);
    assert.equal(payment.method, PAYMENT_METHOD.MOCK_PAYMENT);
    assert.ok(payment.transactionReference.startsWith('MOCK-TXN-'));
    assert.ok(payment.paidAt !== null);

    // SECURITY CHECK: Verify payment doc in MongoDB does NOT store card numbers, cvvs, or cardholder credentials
    const rawDoc = await Payment.findById(payment._id).lean();
    assert.equal(rawDoc.cardNumber, undefined);
    assert.equal(rawDoc.cvv, undefined);
    assert.equal(rawDoc.cardExpiry, undefined);
    assert.equal(rawDoc.pin, undefined);

    // Verify linked order was updated to paymentStatus: 'PAID'
    const updatedOrder = await Order.findById(order1._id).lean();
    assert.equal(updatedOrder.paymentStatus, 'PAID');
    assert.equal(updatedOrder.paymentMethod, PAYMENT_METHOD.MOCK_PAYMENT);
    assert.equal(updatedOrder.paymentId.toString(), payment._id.toString());
  });

  it('2. Idempotency: Repeated call with the exact same idempotencyKey returns original payment without double-billing', async () => {
    const key = `IDEMP-MOCK-SUCCESS-${ts}`;
    const res = await fetch(`${baseUrl}/payments/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        orderId: order1._id,
        method: PAYMENT_METHOD.MOCK_PAYMENT,
        idempotencyKey: key,
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.isIdempotentReplay, true);
    assert.equal(body.data.payment.idempotencyKey, key);

    // Verify only 1 payment record exists in MongoDB for this idempotency key
    const count = await Payment.countDocuments({ idempotencyKey: key });
    assert.equal(count, 1);
  });

  it('3. Rejects new payment attempt for an order that is already PAID', async () => {
    const res = await fetch(`${baseUrl}/payments/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        orderId: order1._id,
        method: PAYMENT_METHOD.MOCK_PAYMENT,
        idempotencyKey: `NEW-KEY-FOR-PAID-ORDER-${ts}`,
      }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.errorCode, 'ORDER_ALREADY_PAID');
  });

  it('4. Handles simulated payment failure gracefully without corrupting order state', async () => {
    const key = `IDEMP-MOCK-FAIL-${ts}`;
    const res = await fetch(`${baseUrl}/payments/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        orderId: order2._id,
        method: PAYMENT_METHOD.MOCK_PAYMENT,
        idempotencyKey: key,
        paymentDetails: {
          simulateFailure: true,
          failureReason: 'Card expired or insufficient balance',
        },
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.payment.status, PAYMENT_STATUS.FAILED);
    assert.equal(body.data.payment.failureReason, 'Card expired or insufficient balance');

    // Order status reflects FAILED
    const failedOrder = await Order.findById(order2._id).lean();
    assert.equal(failedOrder.paymentStatus, 'FAILED');
  });

  it('5. Cash on Delivery (COD) workflow: Starts PENDING and transitions to SUCCESS when seller confirms cash collection', async () => {
    const key = `IDEMP-COD-${ts}`;
    // 1. Customer initiates COD payment
    const initRes = await fetch(`${baseUrl}/payments/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        orderId: orderCod._id,
        method: PAYMENT_METHOD.CASH_ON_DELIVERY,
        idempotencyKey: key,
      }),
    });

    assert.equal(initRes.status, 200);
    const initBody = await initRes.json();
    const codPayment = initBody.data.payment;
    assert.equal(codPayment.status, PAYMENT_STATUS.PENDING);
    assert.equal(codPayment.method, PAYMENT_METHOD.CASH_ON_DELIVERY);

    const orderPending = await Order.findById(orderCod._id).lean();
    assert.equal(orderPending.paymentStatus, 'PENDING');
    assert.equal(orderPending.paymentMethod, PAYMENT_METHOD.CASH_ON_DELIVERY);

    // 2. Seller confirms cash received at physical pickup/handover
    const confirmRes = await fetch(`${baseUrl}/payments/${codPayment._id}/confirm-cod`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sellerToken}`,
      },
      body: JSON.stringify({ notes: 'Cash currency notes verified and accepted' }),
    });

    assert.equal(confirmRes.status, 200);
    const confirmBody = await confirmRes.json();
    assert.equal(confirmBody.data.status, PAYMENT_STATUS.SUCCESS);
    assert.ok(confirmBody.data.paidAt !== null);

    const orderPaid = await Order.findById(orderCod._id).lean();
    assert.equal(orderPaid.paymentStatus, 'PAID');
  });

  it('6. Refund processing: Seller/Admin issues refund for a SUCCESS payment', async () => {
    // order1 was paid via MOCK_PAYMENT
    const payment = await Payment.findOne({ orderId: order1._id, status: PAYMENT_STATUS.SUCCESS });
    assert.ok(payment);

    const refundRes = await fetch(`${baseUrl}/payments/${payment._id}/refund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sellerToken}`,
      },
      body: JSON.stringify({
        reason: 'Customer requested order return / refund',
      }),
    });

    assert.equal(refundRes.status, 200);
    const refundBody = await refundRes.json();
    assert.equal(refundBody.data.status, PAYMENT_STATUS.REFUNDED);
    assert.ok(refundBody.data.refundDetails.refundId.startsWith('MOCK-REF-'));
    assert.equal(refundBody.data.refundDetails.amount, payment.amount);

    const refundedOrder = await Order.findById(order1._id).lean();
    assert.equal(refundedOrder.paymentStatus, 'REFUNDED');

    // Attempting duplicate refund should fail
    const dupRefundRes = await fetch(`${baseUrl}/payments/${payment._id}/refund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sellerToken}`,
      },
      body: JSON.stringify({ reason: 'Duplicate refund attempt' }),
    });
    assert.equal(dupRefundRes.status, 400);
  });

  it('7. Enforces authorization when retrieving payment details', async () => {
    const payment = await Payment.findOne({ orderId: order1._id });

    // Customer who placed order can retrieve payment
    const ownRes = await fetch(`${baseUrl}/payments/${payment._id}`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert.equal(ownRes.status, 200);

    // Other customer cannot retrieve payment (HTTP 403 Forbidden)
    const unauthorizedRes = await fetch(`${baseUrl}/payments/${payment._id}`, {
      headers: { Authorization: `Bearer ${otherCustomerToken}` },
    });
    assert.equal(unauthorizedRes.status, 403);
  });
});
