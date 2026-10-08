import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import app from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User, USER_ROLES } from '../src/models/user.model.js';
import { Store, STORE_OPERATIONAL_STATUS } from '../src/models/store.model.js';
import { Category } from '../src/models/category.model.js';
import { Product } from '../src/models/product.model.js';
import { Batch, BATCH_STATUS } from '../src/models/batch.model.js';
import { Order, ORDER_STATUS } from '../src/models/order.model.js';
import { Payment, PAYMENT_STATUS } from '../src/models/payment.model.js';
import {
  Complaint,
  COMPLAINT_STATUS,
  COMPLAINT_CATEGORY,
  COMPLAINT_PRIORITY,
  RESOLUTION_DECISION,
  RESOLUTION_ACTION_TYPE,
} from '../src/models/complaint.model.js';
import { Notification } from '../src/models/notification.model.js';

describe('NearExpiry Complaint & Dispute Resolution Suite (Phase 3)', () => {
  let server;
  let baseUrl;
  let adminToken;
  let adminUser;
  let sellerToken;
  let customer1Token;
  let customer2Token;
  let customer1User;
  let customer2User;
  let storeDoc;
  let order1Doc;
  let order2Doc;
  let payment1Doc;
  let complaint1Doc;
  let ts;

  before(async () => {
    await connectDB();

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}/api/v1`;

    ts = Date.now().toString().slice(-6);

    // 1. Create Admin
    const adminRes = await fetch(`${baseUrl}/auth/register/admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Dispute Admin',
        email: `dispute.admin.${ts}@nearexpiry.test`,
        phone: '9876540001',
        password: 'Password123!',
      }),
    });
    const adminData = await adminRes.json();
    adminToken = adminData.data.token;
    adminUser = adminData.data.user;

    // 2. Create Customers
    const c1Res = await fetch(`${baseUrl}/auth/register/customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Dispute Customer One',
        email: `dispute.cust1.${ts}@nearexpiry.test`,
        phone: '9876540002',
        password: 'Password123!',
      }),
    });
    const c1Data = await c1Res.json();
    customer1Token = c1Data.data.token;
    customer1User = c1Data.data.user;

    const c2Res = await fetch(`${baseUrl}/auth/register/customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Dispute Customer Two',
        email: `dispute.cust2.${ts}@nearexpiry.test`,
        phone: '9876540003',
        password: 'Password123!',
      }),
    });
    const c2Data = await c2Res.json();
    customer2Token = c2Data.data.token;
    customer2User = c2Data.data.user;

    // 3. Create Seller & Store
    const sellerRes = await fetch(`${baseUrl}/auth/register/seller`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Dispute Seller',
        email: `dispute.seller.${ts}@nearexpiry.test`,
        phone: '9876540004',
        password: 'Password123!',
        storeName: `Dispute Store ${ts}`,
      }),
    });
    const sellerData = await sellerRes.json();
    sellerToken = sellerData.data.token;

    const sellerId = sellerData.data.user.id || sellerData.data.user._id;
    storeDoc = await Store.findOne({ ownerId: sellerId });
    if (!storeDoc) {
      storeDoc = await Store.create({
        storeName: `Dispute Store ${ts}`,
        ownerId: sellerId,
        description: 'Store for dispute testing',
        contactPhone: '9876540004',
        latitude: 12.9716,
        longitude: 77.5946,
        operationalStatus: STORE_OPERATIONAL_STATUS.ACTIVE,
        verificationStatus: 'APPROVED',
        address: {
          street: '123 Market Rd',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560001',
        },
      });
    } else {
      storeDoc.operationalStatus = STORE_OPERATIONAL_STATUS.ACTIVE;
      storeDoc.verificationStatus = 'APPROVED';
      await storeDoc.save();
    }

    // 4. Create Category, Product, Batch
    const cat = await Category.create({
      name: `Dispute Category ${ts}`,
      slug: `dispute-cat-${ts}`,
      description: 'Testing',
    });

    const prod = await Product.create({
      name: `Dispute Product ${ts}`,
      slug: `dispute-prod-${ts}`,
      description: 'Testing dispute product',
      brand: 'TestBrand',
      category: cat._id,
      storeId: storeDoc._id,
      sellerId: sellerId,
      unit: 'pcs',
    });

    const batch = await Batch.create({
      storeId: storeDoc._id,
      sellerId: sellerId,
      productId: prod._id,
      batchNumber: `BAT-${ts}-01`,
      manufacturingDate: new Date(Date.now() - 30 * 86400000),
      expiryDate: new Date(Date.now() + 10 * 86400000),
      remainingDays: 10,
      initialQuantity: 100,
      quantity: 50,
      soldQuantity: 10,
      originalPrice: 200,
      currentPrice: 150,
      discountPercentage: 25,
      status: BATCH_STATUS.HEALTHY,
      isPurchasable: true,
    });

    // 5. Create Real Orders in MongoDB
    // Order 1 for Customer 1 (with successful payment)
    order1Doc = await Order.create({
      orderNumber: `NE-ORD-${ts}-0001`,
      customerId: customer1User.id || customer1User._id,
      storeId: storeDoc._id,
      fulfillmentType: 'PICKUP',
      status: ORDER_STATUS.CONFIRMED,
      paymentStatus: 'PAID',
      items: [
        {
          productId: prod._id,
          productName: prod.name,
          unit: 'pcs',
          requestedQuantity: 2,
          blendedUnitPrice: 150,
          lineOriginalAmount: 400,
          lineDiscountedAmount: 300,
          lineSavingsAmount: 100,
          batchAllocations: [
            {
              batchId: batch._id,
              batchNumber: batch.batchNumber,
              manufacturingDate: batch.manufacturingDate,
              expiryDate: batch.expiryDate,
              remainingDays: 10,
              allocatedQuantity: 2,
              originalUnitPrice: 200,
              discountedUnitPrice: 150,
              discountPercent: 25,
              lineOriginalPrice: 400,
              lineFinalPrice: 300,
              savings: 100,
            },
          ],
        },
      ],
      pricingSummary: {
        subtotal: 400,
        discounts: 100,
        deliveryFee: 0,
        finalTotal: 300,
        totalUnits: 2,
        itemCount: 1,
      },
    });

    payment1Doc = await Payment.create({
      orderId: order1Doc._id,
      customerId: customer1User.id || customer1User._id,
      storeId: storeDoc._id,
      amount: 300,
      currency: 'INR',
      method: 'MOCK_PAYMENT',
      status: PAYMENT_STATUS.SUCCESS,
      transactionReference: `TXN-DISPUTE-${ts}-001`,
      idempotencyKey: `IDEMP-${ts}-001`,
    });

    order1Doc.paymentId = payment1Doc._id;
    await order1Doc.save();

    // Order 2 for Customer 2
    order2Doc = await Order.create({
      orderNumber: `NE-ORD-${ts}-0002`,
      customerId: customer2User.id || customer2User._id,
      storeId: storeDoc._id,
      fulfillmentType: 'PICKUP',
      status: ORDER_STATUS.CONFIRMED,
      paymentStatus: 'PENDING',
      items: [
        {
          productId: prod._id,
          productName: prod.name,
          unit: 'pcs',
          requestedQuantity: 1,
          blendedUnitPrice: 150,
          lineOriginalAmount: 200,
          lineDiscountedAmount: 150,
          lineSavingsAmount: 50,
          batchAllocations: [
            {
              batchId: batch._id,
              batchNumber: batch.batchNumber,
              manufacturingDate: batch.manufacturingDate,
              expiryDate: batch.expiryDate,
              remainingDays: 10,
              allocatedQuantity: 1,
              originalUnitPrice: 200,
              discountedUnitPrice: 150,
              discountPercent: 25,
              lineOriginalPrice: 200,
              lineFinalPrice: 150,
              savings: 50,
            },
          ],
        },
      ],
      pricingSummary: {
        subtotal: 200,
        discounts: 50,
        deliveryFee: 0,
        finalTotal: 150,
        totalUnits: 1,
        itemCount: 1,
      },
    });
  });

  after(async () => {
    if (server) await new Promise((res) => server.close(res));
    await disconnectDB();
  });

  // TEST 1: Customer creates complaint for own order -> SUCCESS
  it('1. Customer creates complaint for own order -> SUCCESS', async () => {
    const res = await fetch(`${baseUrl}/complaints`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customer1Token}`,
      },
      body: JSON.stringify({
        orderId: order1Doc._id.toString(),
        category: COMPLAINT_CATEGORY.DAMAGED_PRODUCT,
        subject: 'Packaging broken and leaking item',
        description: 'Received the package with a broken bottle neck and seal damaged.',
        evidenceUrls: ['https://example.com/evidence1.jpg'],
      }),
    });

    const body = await res.json();
    assert.equal(res.status, 201, `Expected 201, got ${res.status}: ${JSON.stringify(body)}`);
    assert.equal(body.success, true);
    assert.ok(body.data.complaintNumber.startsWith('NE-CMP-'));
    assert.equal(body.data.status, COMPLAINT_STATUS.OPEN);
    assert.equal(body.data.priority, COMPLAINT_PRIORITY.MEDIUM);
    assert.equal(body.data.orderNumber, order1Doc.orderNumber);

    complaint1Doc = body.data;
  });

  // TEST 2: Customer creates complaint for another customer order -> FAIL
  it("2. Customer creates complaint for another customer's order -> FAIL (403)", async () => {
    const res = await fetch(`${baseUrl}/complaints`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customer1Token}`,
      },
      body: JSON.stringify({
        orderId: order2Doc._id.toString(), // Customer 2's order
        category: COMPLAINT_CATEGORY.WRONG_PRODUCT,
        subject: 'Attempting to dispute other order',
        description: 'This should be blocked strictly by ownership verification.',
      }),
    });

    const body = await res.json();
    assert.equal(res.status, 403, `Expected 403 Forbidden, got ${res.status}`);
    assert.equal(body.success, false);
  });

  // TEST 3: Customer views own complaint -> SUCCESS
  it('3. Customer views own complaint -> SUCCESS', async () => {
    const res = await fetch(`${baseUrl}/complaints/${complaint1Doc._id}`, {
      headers: { Authorization: `Bearer ${customer1Token}` },
    });

    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.complaintNumber, complaint1Doc.complaintNumber);
    assert.ok(body.data.orderDetails);
  });

  // TEST 4: Customer views another customer complaint -> FAIL (403)
  it("4. Customer views another customer's complaint -> FAIL (403)", async () => {
    const res = await fetch(`${baseUrl}/complaints/${complaint1Doc._id}`, {
      headers: { Authorization: `Bearer ${customer2Token}` }, // Customer 2 accessing Customer 1's complaint
    });

    const body = await res.json();
    assert.equal(res.status, 403, `Expected 403 Forbidden, got ${res.status}`);
    assert.equal(body.success, false);
  });

  // TEST 5: Customer cannot see internal admin notes -> SUCCESS
  it('5. Customer cannot see internal admin notes -> SUCCESS', async () => {
    // Inject an internal note via direct database operation to test retrieval filtering
    await Complaint.findByIdAndUpdate(complaint1Doc._id, {
      $push: {
        messages: {
          senderId: adminUser.id || adminUser._id,
          senderRole: 'ADMIN',
          senderName: 'Admin Moderator',
          message: 'CONFIDENTIAL: Customer seems impatient, check with delivery partner.',
          isInternalNote: true,
          createdAt: new Date(),
        },
        timeline: {
          action: 'INTERNAL_NOTE_ADDED',
          performedBy: adminUser.id || adminUser._id,
          performerRole: 'ADMIN',
          notes: 'Internal assessment logged.',
          isInternal: true,
          timestamp: new Date(),
        },
      },
    });

    const res = await fetch(`${baseUrl}/complaints/${complaint1Doc._id}`, {
      headers: { Authorization: `Bearer ${customer1Token}` },
    });

    const body = await res.json();
    assert.equal(res.status, 200);
    const internalMessages = body.data.messages.filter((m) => m.isInternalNote || m.message.includes('CONFIDENTIAL'));
    const internalTimeline = body.data.timeline.filter((t) => t.isInternal);
    assert.equal(internalMessages.length, 0, 'Internal notes must NEVER leak to customer');
    assert.equal(internalTimeline.length, 0, 'Internal timeline events must NEVER leak to customer');
  });

  // TEST 6: Admin can view complaint dossier -> SUCCESS
  it('6. Admin can view complaint dossier -> SUCCESS', async () => {
    const res = await fetch(`${baseUrl}/admin/complaints/${complaint1Doc._id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(body.data.complaint);
    assert.ok(body.data.orderDossier);
    assert.equal(body.data.complaint.complaintNumber, complaint1Doc.complaintNumber);

    // Admin CAN see internal note
    const internalMessages = body.data.complaint.messages.filter((m) => m.isInternalNote);
    assert.ok(internalMessages.length > 0, 'Admin should be able to view internal notes');
  });

  // TEST 7: Non-admin cannot access admin complaint API -> FAIL (403)
  it('7. Non-admin cannot access admin complaint API -> FAIL (403)', async () => {
    const res = await fetch(`${baseUrl}/admin/complaints`, {
      headers: { Authorization: `Bearer ${customer1Token}` },
    });

    const body = await res.json();
    assert.equal(res.status, 403, `Expected 403 Forbidden for non-admin, got ${res.status}`);
  });

  // TEST 8: Invalid complaint category -> FAIL (400)
  it('8. Invalid complaint category -> FAIL (400)', async () => {
    const res = await fetch(`${baseUrl}/complaints`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customer1Token}`,
      },
      body: JSON.stringify({
        orderId: order1Doc._id.toString(),
        category: 'INVALID_CATEGORY_XYZ',
        subject: 'Testing invalid category',
        description: 'Should fail validation automatically.',
      }),
    });

    assert.equal(res.status, 400);
  });

  // TEST 9: Invalid status transition -> FAIL (400)
  it('9. Invalid status transition -> FAIL (400)', async () => {
    // Current status is OPEN. Attempting to transition directly to RESOLVED without review
    const res = await fetch(`${baseUrl}/admin/complaints/${complaint1Doc._id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        status: COMPLAINT_STATUS.RESOLVED, // Not allowed directly from OPEN
        note: 'Illegal jump directly to resolved',
      }),
    });

    const body = await res.json();
    assert.equal(res.status, 400, `Expected 400 for invalid status transition, got ${res.status}`);
    assert.equal(body.success, false);
  });

  // TEST 10: Admin can assign complaint -> SUCCESS
  it('10. Admin can assign complaint -> SUCCESS', async () => {
    const res = await fetch(`${baseUrl}/admin/complaints/${complaint1Doc._id}/assign`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        adminId: adminUser.id || adminUser._id,
      }),
    });

    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.assignedAdminId.toString(), (adminUser.id || adminUser._id).toString());
  });

  // TEST 11: Admin can change priority -> SUCCESS
  it('11. Admin can change priority -> SUCCESS', async () => {
    const res = await fetch(`${baseUrl}/admin/complaints/${complaint1Doc._id}/priority`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        priority: COMPLAINT_PRIORITY.HIGH,
        note: 'Escalated due to customer impact',
      }),
    });

    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.data.priority, COMPLAINT_PRIORITY.HIGH);
  });

  // TEST 12: Admin can send public response -> SUCCESS
  it('12. Admin can send public response -> SUCCESS', async () => {
    // First update status to UNDER_REVIEW
    await fetch(`${baseUrl}/admin/complaints/${complaint1Doc._id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        status: COMPLAINT_STATUS.UNDER_REVIEW,
        note: 'Investigation started',
      }),
    });

    const res = await fetch(`${baseUrl}/admin/complaints/${complaint1Doc._id}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        message: 'Hello, we are looking into the broken seal with the seller right now.',
        isInternalNote: false,
      }),
    });

    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    const lastMsg = body.data.messages[body.data.messages.length - 1];
    assert.equal(lastMsg.senderRole, 'ADMIN');
    assert.equal(lastMsg.isInternalNote, false);
  });

  // TEST 13: Admin can add internal note -> SUCCESS
  it('13. Admin can add internal note -> SUCCESS', async () => {
    const res = await fetch(`${baseUrl}/admin/complaints/${complaint1Doc._id}/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        note: 'Internal log: Seller verified that batch lot BAT-01 was packed properly.',
      }),
    });

    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    const lastMsg = body.data.messages[body.data.messages.length - 1];
    assert.equal(lastMsg.isInternalNote, true);
  });

  // TEST 14: Internal note is hidden from customer -> SUCCESS
  it('14. Internal note is hidden from customer -> SUCCESS', async () => {
    const res = await fetch(`${baseUrl}/complaints/${complaint1Doc._id}`, {
      headers: { Authorization: `Bearer ${customer1Token}` },
    });

    const body = await res.json();
    assert.equal(res.status, 200);
    const internalNotes = body.data.messages.filter((m) => m.isInternalNote);
    assert.equal(internalNotes.length, 0);
  });

  // TEST 15: Valid refund resolution -> SUCCESS
  it('15. Valid refund resolution -> SUCCESS (refundPaymentService executed)', async () => {
    const res = await fetch(`${baseUrl}/admin/complaints/${complaint1Doc._id}/resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        decision: RESOLUTION_DECISION.FULL_REFUND,
        notes: 'Damage verified. Full refund authorized.',
        refundAmount: 300,
        actionRequested: RESOLUTION_ACTION_TYPE.EXECUTE_REFUND,
      }),
    });

    const body = await res.json();
    assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(body)}`);
    assert.equal(body.data.status, COMPLAINT_STATUS.RESOLVED);
    assert.equal(body.data.resolution.decision, RESOLUTION_DECISION.FULL_REFUND);
    assert.equal(body.data.resolution.actionRequested, RESOLUTION_ACTION_TYPE.EXECUTE_REFUND);
    assert.equal(body.data.resolution.actionExecutionStatus, 'EXECUTED');
    assert.equal(body.data.resolution.actionExecutionResult.refundStatus, 'SUCCESS');
    assert.ok(body.data.resolution.actionExecutionResult.refundId);

    // Verify Payment was truly updated in MongoDB
    const updatedPayment = await Payment.findById(payment1Doc._id);
    assert.equal(updatedPayment.status, PAYMENT_STATUS.REFUNDED);
    assert.equal(updatedPayment.refundDetails.amount, 300);

    // Verify Order paymentStatus was updated
    const updatedOrder = await Order.findById(order1Doc._id);
    assert.equal(updatedOrder.paymentStatus, 'REFUNDED');
  });

  // TEST 16: Duplicate refund attempt -> BLOCKED
  it('16. Duplicate refund attempt -> BLOCKED (400)', async () => {
    const res = await fetch(`${baseUrl}/admin/complaints/${complaint1Doc._id}/resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        decision: RESOLUTION_DECISION.FULL_REFUND,
        notes: 'Attempting duplicate refund',
        refundAmount: 300,
        actionRequested: RESOLUTION_ACTION_TYPE.EXECUTE_REFUND,
      }),
    });

    const body = await res.json();
    assert.equal(res.status, 400, `Expected 400 for duplicate resolution/refund, got ${res.status}`);
  });

  // TEST 17: Invalid refund amount -> BLOCKED
  it('17. Invalid refund amount -> BLOCKED (400)', async () => {
    // Create new complaint on Order 2
    const complaintRes = await fetch(`${baseUrl}/complaints`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customer2Token}`,
      },
      body: JSON.stringify({
        orderId: order2Doc._id.toString(),
        category: COMPLAINT_CATEGORY.PRODUCT_QUALITY,
        subject: 'Off taste in product',
        description: 'Taste was sour and not fresh.',
      }),
    });
    const c2Body = await complaintRes.json();
    const c2Id = c2Body.data._id;

    // Attempt refund with amount exceeding payment / or zero payment
    const res = await fetch(`${baseUrl}/admin/complaints/${c2Id}/resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        decision: RESOLUTION_DECISION.PARTIAL_REFUND,
        notes: 'Excessive refund attempt',
        refundAmount: 999999, // Exceeds valid range
        actionRequested: RESOLUTION_ACTION_TYPE.EXECUTE_REFUND,
      }),
    });

    const body = await res.json();
    assert.equal(res.status, 400, `Expected 400 for invalid refund amount, got ${res.status}`);
  });

  // TEST 18: Valid cancellation -> SUCCESS
  it('18. Valid cancellation -> SUCCESS (cancelOrderService executed)', async () => {
    // Create a new order to test cancellation
    const cancelOrderDoc = await Order.create({
      orderNumber: `NE-ORD-${ts}-0003`,
      customerId: customer2User.id || customer2User._id,
      storeId: storeDoc._id,
      fulfillmentType: 'PICKUP',
      status: ORDER_STATUS.PLACED,
      paymentStatus: 'PENDING',
      items: order2Doc.items,
      pricingSummary: order2Doc.pricingSummary,
    });

    const complaintRes = await fetch(`${baseUrl}/complaints`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customer2Token}`,
      },
      body: JSON.stringify({
        orderId: cancelOrderDoc._id.toString(),
        category: COMPLAINT_CATEGORY.ORDER_NOT_RECEIVED,
        subject: 'Could not pickup, store was locked',
        description: 'Store was closed during business hours, please cancel.',
      }),
    });
    const cBody = await complaintRes.json();
    const cancelComplaintId = cBody.data._id;

    const res = await fetch(`${baseUrl}/admin/complaints/${cancelComplaintId}/resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        decision: RESOLUTION_DECISION.ORDER_CANCELLATION,
        notes: 'Store verified closure. Cancelling order with restock.',
        actionRequested: RESOLUTION_ACTION_TYPE.EXECUTE_ORDER_CANCEL,
      }),
    });

    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.data.resolution.actionExecutionResult.cancellationStatus, 'SUCCESS');
    assert.equal(body.data.resolution.actionExecutionResult.stockRestored, true);

    // Verify Order is CANCELLED in DB
    const checkOrder = await Order.findById(cancelOrderDoc._id);
    assert.equal(checkOrder.status, ORDER_STATUS.CANCELLED);
  });

  // TEST 19: Duplicate cancellation -> BLOCKED
  it('19. Duplicate cancellation -> BLOCKED (400)', async () => {
    // Create a complaint referencing an already cancelled order
    const cancelledOrder = await Order.findOne({ status: ORDER_STATUS.CANCELLED });
    const complaintDoc = await Complaint.create({
      complaintNumber: `NE-CMP-DUP-${Date.now().toString().slice(-4)}`,
      customerId: customer2User.id || customer2User._id,
      orderId: cancelledOrder._id,
      orderNumber: cancelledOrder.orderNumber,
      storeId: storeDoc._id,
      category: COMPLAINT_CATEGORY.OTHER,
      status: COMPLAINT_STATUS.UNDER_REVIEW,
      subject: 'Dispute on already cancelled order',
      description: 'Testing duplicate cancellation guard.',
    });

    const res = await fetch(`${baseUrl}/admin/complaints/${complaintDoc._id}/resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        decision: RESOLUTION_DECISION.ORDER_CANCELLATION,
        notes: 'Attempting to cancel already cancelled order',
        actionRequested: RESOLUTION_ACTION_TYPE.EXECUTE_ORDER_CANCEL,
      }),
    });

    const body = await res.json();
    assert.equal(res.status, 400, `Expected 400 for duplicate cancellation, got ${res.status}`);
  });

  // TEST 20: Failed resolution does not falsely record success
  it('20. Failed resolution does not falsely record success', async () => {
    // Attempt refund on an order with no payment record
    const noPaymentOrder = await Order.create({
      orderNumber: `NE-ORD-NOPAY-${Date.now().toString().slice(-4)}`,
      customerId: customer2User.id || customer2User._id,
      storeId: storeDoc._id,
      fulfillmentType: 'PICKUP',
      status: ORDER_STATUS.PLACED,
      paymentStatus: 'PENDING',
      paymentId: null,
      items: order2Doc.items,
      pricingSummary: order2Doc.pricingSummary,
    });

    const testComplaint = await Complaint.create({
      complaintNumber: `NE-CMP-NOPAY-${Date.now().toString().slice(-4)}`,
      customerId: customer2User.id || customer2User._id,
      orderId: noPaymentOrder._id,
      orderNumber: noPaymentOrder.orderNumber,
      storeId: storeDoc._id,
      category: COMPLAINT_CATEGORY.PAYMENT_PROBLEM,
      status: COMPLAINT_STATUS.UNDER_REVIEW,
      subject: 'Testing refund with missing payment',
      description: 'Backend must block and not record success.',
    });

    const res = await fetch(`${baseUrl}/admin/complaints/${testComplaint._id}/resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        decision: RESOLUTION_DECISION.FULL_REFUND,
        notes: 'Refund attempted on missing payment',
        actionRequested: RESOLUTION_ACTION_TYPE.EXECUTE_REFUND,
      }),
    });

    assert.equal(res.status, 400);

    // Verify DB complaint does NOT claim success
    const freshDoc = await Complaint.findById(testComplaint._id);
    assert.notEqual(freshDoc.status, COMPLAINT_STATUS.RESOLVED);
    assert.notEqual(freshDoc.resolution?.actionExecutionStatus, 'EXECUTED');
  });

  // TEST 21: Customer receives appropriate notification
  it('21. Customer receives appropriate notification in inbox', async () => {
    const notifs = await Notification.find({
      recipient: customer1User.id || customer1User._id,
    }).sort({ createdAt: -1 });

    assert.ok(notifs.length > 0, 'Customer should have received in-app notifications');
    const complaintNotif = notifs.find((n) => n.data?.complaintNumber === complaint1Doc.complaintNumber);
    assert.ok(complaintNotif, 'Should find notification for complaint 1');
  });

  // TEST 22: Complaint timeline records important actions
  it('22. Complaint timeline records important actions with real actor identity', async () => {
    const freshComplaint = await Complaint.findById(complaint1Doc._id);
    assert.ok(freshComplaint.timeline.length >= 4);

    const actions = freshComplaint.timeline.map((t) => t.action);
    assert.ok(actions.includes('COMPLAINT_FILED'));
    assert.ok(actions.includes('COMPLAINT_ASSIGNED'));
    assert.ok(actions.includes('PRIORITY_CHANGED'));
    assert.ok(actions.includes('REFUND_EXECUTED'));
    assert.ok(actions.includes('COMPLAINT_RESOLVED'));

    // Verify actor integrity on timeline
    const filedEvent = freshComplaint.timeline.find((t) => t.action === 'COMPLAINT_FILED');
    assert.equal(filedEvent.performerRole, 'CUSTOMER');

    const resolvedEvent = freshComplaint.timeline.find((t) => t.action === 'COMPLAINT_RESOLVED');
    assert.equal(resolvedEvent.performerRole, 'ADMIN');
  });
});
