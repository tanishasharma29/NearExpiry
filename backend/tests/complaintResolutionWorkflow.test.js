import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import app from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User, USER_ROLES } from '../src/models/user.model.js';
import { Store, STORE_OPERATIONAL_STATUS } from '../src/models/store.model.js';
import { Order, ORDER_STATUS } from '../src/models/order.model.js';
import { Payment, PAYMENT_STATUS } from '../src/models/payment.model.js';
import {
  Complaint,
  COMPLAINT_STATUS,
  COMPLAINT_CATEGORY,
  COMPLAINT_PRIORITY,
  RESOLUTION_DECISION,
} from '../src/models/complaint.model.js';
import { Notification } from '../src/models/notification.model.js';

describe('Customer-Seller Complaint Resolution & Administrative Oversight Suite', () => {
  let server;
  let baseUrl;
  let adminToken;
  let adminUser;
  let seller1Token;
  let seller1User;
  let seller1Store;
  let seller2Token;
  let seller2User;
  let seller2Store;
  let customer1Token;
  let customer1User;
  let customer2Token;
  let customer2User;
  let testOrder;
  let testComplaint;
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
        email: `sup.admin.${ts}@nearexpiry.test`,
        phone: '9870000001',
        password: 'Password123!',
      }),
    });
    const adminData = await adminRes.json();
    adminToken = adminData.data.token;
    adminUser = adminData.data.user;

    // 2. Customer Accounts
    const c1Res = await fetch(`${baseUrl}/auth/register/customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alice Customer',
        email: `alice.${ts}@nearexpiry.test`,
        phone: '9870000002',
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
        name: 'Bob Customer',
        email: `bob.${ts}@nearexpiry.test`,
        phone: '9870000003',
        password: 'Password123!',
      }),
    });
    const c2Data = await c2Res.json();
    customer2Token = c2Data.data.token;
    customer2User = c2Data.data.user;

    // 3. Seller 1 (Disputed Store)
    const s1Res = await fetch(`${baseUrl}/auth/register/seller`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Apex Merchant',
        email: `apex.seller.${ts}@nearexpiry.test`,
        phone: '9870000004',
        password: 'Password123!',
        storeName: `Apex Hypermarket ${ts}`,
      }),
    });
    const s1Data = await s1Res.json();
    seller1Token = s1Data.data.token;
    seller1User = s1Data.data.user;
    seller1Store = await Store.findOne({ ownerId: seller1User._id || seller1User.id });

    // Approve Seller 1 Store so it is fully active
    seller1Store.verificationStatus = 'APPROVED';
    seller1Store.isActive = true;
    await seller1Store.save();

    // 4. Seller 2 (Unrelated Merchant)
    const s2Res = await fetch(`${baseUrl}/auth/register/seller`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Beta Merchant',
        email: `beta.seller.${ts}@nearexpiry.test`,
        phone: '9870000005',
        password: 'Password123!',
        storeName: `Beta Retail ${ts}`,
      }),
    });
    const s2Data = await s2Res.json();
    seller2Token = s2Data.data.token;
    seller2User = s2Data.data.user;
    seller2Store = await Store.findOne({ ownerId: seller2User._id || seller2User.id });
    seller2Store.verificationStatus = 'APPROVED';
    seller2Store.isActive = true;
    await seller2Store.save();

    // 5. Create Order for Customer 1 with Seller 1
    const mongoose = (await import('mongoose')).default;
    testOrder = await Order.create({
      orderNumber: `ORD-DISPUTE-${ts}`,
      customerId: customer1User._id || customer1User.id,
      storeId: seller1Store._id,
      fulfillmentType: 'PICKUP',
      status: ORDER_STATUS.CONFIRMED,
      paymentStatus: 'PAID',
      items: [
        {
          productId: new mongoose.Types.ObjectId(),
          productName: 'Organic Milk 1L',
          unit: 'pcs',
          requestedQuantity: 2,
          blendedUnitPrice: 225,
          lineOriginalAmount: 500,
          lineDiscountedAmount: 450,
          lineSavingsAmount: 50,
          batchAllocations: [],
        },
      ],
      pricingSummary: {
        subtotal: 500,
        discounts: 50,
        deliveryFee: 0,
        finalTotal: 450,
        totalUnits: 2,
        itemCount: 1,
      },
    });

    const payment = await Payment.create({
      orderId: testOrder._id,
      customerId: customer1User._id || customer1User.id,
      storeId: seller1Store._id,
      amount: 450,
      currency: 'INR',
      method: 'MOCK_PAYMENT',
      status: PAYMENT_STATUS.SUCCESS,
      transactionReference: `TXN-DISPUTE-${ts}`,
      idempotencyKey: `IDEMP-${ts}`,
    });

    testOrder.paymentId = payment._id;
    await testOrder.save();
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await disconnectDB();
  });

  // -------------------------------------------------------------------------
  // TEST 1: Customer creates complaint -> Seller and Admin are both notified
  // -------------------------------------------------------------------------
  it('1. Notifies both the relevant seller and admin when customer creates a complaint', async () => {
    const res = await fetch(`${baseUrl}/complaints`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customer1Token}`,
      },
      body: JSON.stringify({
        orderId: testOrder._id.toString(),
        category: COMPLAINT_CATEGORY.DAMAGED_PRODUCT,
        subject: 'Leaking milk carton upon pickup',
        description: 'One of the milk cartons was punctured and leaking in the bag.',
      }),
    });

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.success, true);
    testComplaint = data.data;

    assert.ok(testComplaint.complaintNumber);
    assert.equal(testComplaint.status, COMPLAINT_STATUS.OPEN);

    // Verify Notification to Seller
    const sellerNotif = await Notification.findOne({
      recipient: seller1User._id || seller1User.id,
      title: { $regex: /New Customer Dispute/i },
    });
    assert.ok(sellerNotif, 'Seller must receive an in-app notification when a complaint is created against their store');

    // Verify Notification to Admin
    const adminNotif = await Notification.findOne({
      recipient: adminUser._id || adminUser.id,
      title: { $regex: /New Dispute Filed/i },
    });
    assert.ok(adminNotif, 'Admin must receive an in-app notification when a dispute is opened');
  });

  // -------------------------------------------------------------------------
  // TEST 2: Seller complaint-management interface
  // -------------------------------------------------------------------------
  it('2. Seller can list and inspect complaints filed against their store', async () => {
    const listRes = await fetch(`${baseUrl}/complaints/seller`, {
      headers: { Authorization: `Bearer ${seller1Token}` },
    });

    assert.equal(listRes.status, 200);
    const listData = await listRes.json();
    assert.equal(listData.success, true);
    assert.ok(Array.isArray(listData.data.complaints));
    assert.ok(listData.data.complaints.some((c) => c._id === testComplaint._id));
    assert.equal(listData.data.storeDetails.storeName, seller1Store.storeName);

    // Detail lookup
    const detailRes = await fetch(`${baseUrl}/complaints/seller/${testComplaint._id}`, {
      headers: { Authorization: `Bearer ${seller1Token}` },
    });
    assert.equal(detailRes.status, 200);
    const detailData = await detailRes.json();
    assert.equal(detailData.success, true);
    assert.equal(detailData.data.complaintNumber, testComplaint.complaintNumber);
    assert.equal(detailData.data.orderDetails.orderNumber, testOrder.orderNumber);
  });

  // -------------------------------------------------------------------------
  // TEST 3: Seller talks with customer in complaint thread
  // -------------------------------------------------------------------------
  it('3. Seller communicates with customer: updates status, persists message, and notifies customer & admin', async () => {
    const replyRes = await fetch(`${baseUrl}/complaints/seller/${testComplaint._id}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${seller1Token}`,
      },
      body: JSON.stringify({
        message: 'Hello Alice, we sincerely apologize for the damaged milk carton. Would you prefer a fresh replacement at counter or a store credit?',
      }),
    });

    assert.equal(replyRes.status, 200);
    const replyData = await replyRes.json();
    assert.equal(replyData.success, true);

    const updated = replyData.data;
    assert.equal(updated.status, COMPLAINT_STATUS.UNDER_REVIEW);

    const lastMsg = updated.messages[updated.messages.length - 1];
    assert.equal(lastMsg.senderRole, 'SELLER');
    assert.equal(lastMsg.senderName, seller1Store.storeName);
    assert.match(lastMsg.message, /sincerely apologize/i);

    // Verify Customer Notification
    const custNotif = await Notification.findOne({
      recipient: customer1User._id || customer1User.id,
      title: { $regex: /Merchant Replied/i },
    });
    assert.ok(custNotif, 'Customer must be notified when merchant replies');
    assert.match(custNotif.title, /Merchant Replied/i);

    // Verify Admin Notification
    const adminReplyNotif = await Notification.findOne({
      recipient: adminUser._id || adminUser.id,
      title: { $regex: /Customer Replied|Seller Replied/i },
    });
    assert.ok(adminReplyNotif, 'Admin must be notified of conversation progression');
  });

  // -------------------------------------------------------------------------
  // TEST 4: Customer replies to seller
  // -------------------------------------------------------------------------
  it('4. Customer replies to merchant: persists message and notifies seller & admin', async () => {
    const res = await fetch(`${baseUrl}/complaints/${testComplaint._id}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customer1Token}`,
      },
      body: JSON.stringify({
        message: 'A fresh replacement milk carton at the counter tomorrow would be wonderful, thank you!',
      }),
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);

    // Verify Seller is notified of customer reply
    const sellerNotif = await Notification.findOne({
      recipient: seller1User._id || seller1User.id,
      title: { $regex: /Customer Replied/i },
    });
    assert.ok(sellerNotif, 'Seller must receive notification when customer replies');
  });

  // -------------------------------------------------------------------------
  // TEST 5: Admin full read-only chronological oversight
  // -------------------------------------------------------------------------
  it('5. Admin has full oversight of the entire dispute conversation, timeline, and telemetry', async () => {
    const dossierRes = await fetch(`${baseUrl}/admin/complaints/${testComplaint._id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    assert.equal(dossierRes.status, 200);
    const dossier = await dossierRes.json();
    assert.equal(dossier.success, true);

    const complaint = dossier.data.complaint;
    assert.equal(complaint._id, testComplaint._id);
    assert.ok(complaint.messages.length >= 3); // initial customer, seller reply, customer follow-up

    // Chronological order verification
    const roles = complaint.messages.map((m) => m.senderRole);
    assert.deepEqual(roles, ['CUSTOMER', 'SELLER', 'CUSTOMER']);

    // Order and store telemetry verification
    assert.ok(dossier.data.orderDossier);
    assert.equal(dossier.data.orderDossier.storeId.isActive, true);
    assert.equal(dossier.data.orderDossier.storeId.verificationStatus, 'APPROVED');
  });

  // -------------------------------------------------------------------------
  // TEST 6: Admin directive/warning to seller
  // -------------------------------------------------------------------------
  it('6. Admin can send a directive/warning persisted in conversation history and notifying the seller', async () => {
    const adminMsgRes = await fetch(`${baseUrl}/admin/complaints/${testComplaint._id}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        message: '[ADMIN DIRECTIVE] Merchant, please hand over the replacement sealed carton promptly and confirm resolution.',
        isInternalNote: false,
      }),
    });

    assert.equal(adminMsgRes.status, 200);
    const adminMsgData = await adminMsgRes.json();
    assert.equal(adminMsgData.success, true);

    // Verify message persisted in complaint thread
    const updatedComplaint = await Complaint.findById(testComplaint._id);
    const lastMsg = updatedComplaint.messages[updatedComplaint.messages.length - 1];
    assert.equal(lastMsg.senderRole, 'ADMIN');
    assert.match(lastMsg.message, /ADMIN DIRECTIVE/i);

    // Verify Seller received in-app directive notification
    const sellerDirectiveNotif = await Notification.findOne({
      recipient: seller1User._id || seller1User.id,
      title: { $regex: /Admin Directive/i },
    });
    assert.ok(sellerDirectiveNotif, 'Seller must receive in-app notification when admin sends directive');
  });

  // -------------------------------------------------------------------------
  // TEST 7: Seller marks dispute as resolved
  // -------------------------------------------------------------------------
  it('7. Seller records resolution: transitions status to RESOLVED and notifies customer & admin', async () => {
    const resolveRes = await fetch(`${baseUrl}/complaints/seller/${testComplaint._id}/resolve`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${seller1Token}`,
      },
      body: JSON.stringify({
        decision: RESOLUTION_DECISION.REPLACEMENT_APPROVED,
        notes: 'Handed over fresh sealed 1L organic milk bottle to customer at counter.',
      }),
    });

    assert.equal(resolveRes.status, 200);
    const resolveData = await resolveRes.json();
    assert.equal(resolveData.success, true);

    const resolvedComplaint = resolveData.data;
    assert.equal(resolvedComplaint.status, COMPLAINT_STATUS.RESOLVED);
    assert.equal(resolvedComplaint.resolution.decision, RESOLUTION_DECISION.REPLACEMENT_APPROVED);
    assert.match(resolvedComplaint.resolution.notes, /Handed over fresh sealed/i);

    // Verify customer notification of resolution
    const custResolvedNotif = await Notification.findOne({
      recipient: customer1User._id || customer1User.id,
      title: { $regex: /Dispute Resolved/i },
    });
    assert.ok(custResolvedNotif, 'Customer must be notified of complaint resolution');
  });

  // -------------------------------------------------------------------------
  // TEST 8: Admin suspends seller store with reason & audit logging
  // -------------------------------------------------------------------------
  it('8. Admin suspends seller store: records reason, sets verificationStatus to SUSPENDED, and deactivates store', async () => {
    const suspendRes = await fetch(`${baseUrl}/admin/stores/${seller1Store._id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        isActive: false,
        verificationStatus: 'SUSPENDED',
        reason: 'Repeated damaged products and slow dispute turnaround.',
      }),
    });

    assert.equal(suspendRes.status, 200);
    const suspendData = await suspendRes.json();
    assert.equal(suspendData.success, true);

    const updatedStore = await Store.findById(seller1Store._id);
    assert.equal(updatedStore.isActive, false);
    assert.equal(updatedStore.verificationStatus, 'SUSPENDED');
    assert.equal(updatedStore.verificationAudit.rejectionReason, 'Repeated damaged products and slow dispute turnaround.');

    // Verify owning seller account was synchronized
    const updatedSeller = await User.findById(seller1Store.ownerId);
    assert.equal(updatedSeller.verificationStatus, 'SUSPENDED');

    // Verify Seller in-app notification of suspension
    const suspensionNotif = await Notification.findOne({
      recipient: seller1User._id || seller1User.id,
      title: { $regex: /Store Suspended/i },
    });
    assert.ok(suspensionNotif, 'Seller must receive suspension notification');
  });

  // -------------------------------------------------------------------------
  // TEST 9: Store suspension enforcement & preservation of existing data
  // -------------------------------------------------------------------------
  it('9. Suspended store blocks new customer store access while fully preserving historical orders & complaints', async () => {
    // 1. Customer cannot view suspended store in marketplace
    const storeLookupRes = await fetch(`${baseUrl}/stores/${seller1Store._id}`);
    assert.equal(storeLookupRes.status, 404, 'Suspended store should not be active for customer viewing/checkout');

    // 2. Historical order remains intact and accessible
    const orderRes = await fetch(`${baseUrl}/orders/${testOrder._id}`, {
      headers: { Authorization: `Bearer ${customer1Token}` },
    });
    assert.equal(orderRes.status, 200, 'Existing customer order must remain accessible');

    // 3. Complaint history remains intact and accessible
    const complaintRes = await fetch(`${baseUrl}/complaints/${testComplaint._id}`, {
      headers: { Authorization: `Bearer ${customer1Token}` },
    });
    assert.equal(complaintRes.status, 200, 'Existing customer complaint must remain accessible');
  });

  // -------------------------------------------------------------------------
  // TEST 10: Strict Role-Based Security & Cross-Tenant Ownership Guards
  // -------------------------------------------------------------------------
  it('10. Strictly enforces cross-tenant ownership and role authorization', async () => {
    // A. Seller 2 cannot access Seller 1 complaints
    const s2AccessRes = await fetch(`${baseUrl}/complaints/seller/${testComplaint._id}`, {
      headers: { Authorization: `Bearer ${seller2Token}` },
    });
    assert.equal(s2AccessRes.status, 403, 'Unrelated seller cannot view other store complaints');

    // B. Seller 2 cannot reply to Seller 1 complaints
    const s2ReplyRes = await fetch(`${baseUrl}/complaints/seller/${testComplaint._id}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${seller2Token}`,
      },
      body: JSON.stringify({ message: 'Unauthorized intrusion attempt' }),
    });
    assert.equal(s2ReplyRes.status, 403, 'Unrelated seller cannot reply to other store complaints');

    // C. Customer 2 cannot access Customer 1 complaint
    const c2AccessRes = await fetch(`${baseUrl}/complaints/${testComplaint._id}`, {
      headers: { Authorization: `Bearer ${customer2Token}` },
    });
    assert.equal(c2AccessRes.status, 403, 'Unrelated customer cannot view other customer complaint');

    // D. Customer cannot access seller complaint routes
    const custSellerRes = await fetch(`${baseUrl}/complaints/seller`, {
      headers: { Authorization: `Bearer ${customer1Token}` },
    });
    assert.equal(custSellerRes.status, 403, 'Customer cannot access seller routes');

    // E. Seller cannot suspend stores
    const sellerSuspendRes = await fetch(`${baseUrl}/admin/stores/${seller1Store._id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${seller1Token}`,
      },
      body: JSON.stringify({ isActive: false }),
    });
    assert.equal(sellerSuspendRes.status, 403, 'Non-admin cannot suspend stores');
  });
});

