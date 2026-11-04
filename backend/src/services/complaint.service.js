import mongoose from 'mongoose';
import {
  Complaint,
  COMPLAINT_STATUS,
  COMPLAINT_CATEGORY,
  COMPLAINT_PRIORITY,
  RESOLUTION_DECISION,
  RESOLUTION_ACTION_TYPE,
  RESOLUTION_ACTION_EXECUTION_STATUS,
} from '../models/complaint.model.js';
import { Order, ORDER_STATUS } from '../models/order.model.js';
import { Payment, PAYMENT_STATUS } from '../models/payment.model.js';
import { User, USER_ROLES } from '../models/user.model.js';
import { Store } from '../models/store.model.js';
import { ApiError } from '../utils/ApiError.js';
import { refundPaymentService } from './payment.service.js';
import { cancelOrderService } from './order.service.js';
import { defaultDispatcher } from './notification/notification.dispatcher.js';
import { NOTIFICATION_TYPES } from '../models/notification.model.js';
import { emitToAdmin } from '../config/socket.js';
import { SOCKET_EVENTS } from '../constants/socketEvents.js';

/**
 * Valid state transitions for Complaint status machine
 */
const VALID_STATUS_TRANSITIONS = {
  [COMPLAINT_STATUS.OPEN]: [
    COMPLAINT_STATUS.UNDER_REVIEW,
    COMPLAINT_STATUS.REJECTED,
    COMPLAINT_STATUS.CLOSED,
  ],
  [COMPLAINT_STATUS.UNDER_REVIEW]: [
    COMPLAINT_STATUS.WAITING_FOR_CUSTOMER,
    COMPLAINT_STATUS.WAITING_FOR_SELLER,
    COMPLAINT_STATUS.RESOLUTION_PENDING,
    COMPLAINT_STATUS.RESOLVED,
    COMPLAINT_STATUS.CLOSED,
    COMPLAINT_STATUS.REJECTED,
  ],
  [COMPLAINT_STATUS.WAITING_FOR_CUSTOMER]: [
    COMPLAINT_STATUS.UNDER_REVIEW,
    COMPLAINT_STATUS.CLOSED,
    COMPLAINT_STATUS.REJECTED,
  ],
  [COMPLAINT_STATUS.WAITING_FOR_SELLER]: [
    COMPLAINT_STATUS.UNDER_REVIEW,
    COMPLAINT_STATUS.RESOLUTION_PENDING,
    COMPLAINT_STATUS.CLOSED,
    COMPLAINT_STATUS.REJECTED,
  ],
  [COMPLAINT_STATUS.RESOLUTION_PENDING]: [
    COMPLAINT_STATUS.UNDER_REVIEW,
    COMPLAINT_STATUS.RESOLVED,
    COMPLAINT_STATUS.REJECTED,
    COMPLAINT_STATUS.CLOSED,
  ],
  [COMPLAINT_STATUS.RESOLVED]: [
    COMPLAINT_STATUS.CLOSED,
    COMPLAINT_STATUS.UNDER_REVIEW, // Re-opened if customer appeals
  ],
  [COMPLAINT_STATUS.CLOSED]: [], // Finalized
  [COMPLAINT_STATUS.REJECTED]: [], // Finalized
};

/**
 * Customer-visible message sanitization filter.
 * Ensures the customer only sees direct customer-merchant dialogue.
 * Platform admin directives to the seller and internal staff notes are strictly hidden.
 */
const filterCustomerVisibleMessages = (messages = []) =>
  messages.filter(
    (m) =>
      !m.isInternalNote &&
      m.visibleToCustomer !== false &&
      m.channel !== 'ADMIN_SELLER' &&
      m.channel !== 'INTERNAL_NOTES' &&
      m.recipientRole !== 'SELLER' &&
      m.recipientRole !== 'ADMIN' &&
      m.recipientRole !== 'INTERNAL' &&
      m.senderRole !== 'ADMIN'
  );

/**
 * Customer-visible timeline sanitization filter.
 * Hides internal administrative actions, directives, and operational notes.
 */
const filterCustomerVisibleTimeline = (timeline = []) =>
  timeline.filter(
    (t) =>
      !t.isInternal &&
      t.performerRole !== 'ADMIN' &&
      !['ADMIN_MESSAGE', 'ADMIN_SELLER_DIRECTIVE', 'SELLER_ADMIN_MESSAGE', 'INTERNAL_NOTE_ADDED'].includes(t.action)
  );

/**
 * Seller-visible message sanitization filter.
 * Allows seller to see customer messages, seller's own messages, and admin directives.
 * Strictly hides internal administrative staff notes.
 */
const filterSellerVisibleMessages = (messages = []) =>
  messages.filter(
    (m) =>
      !m.isInternalNote &&
      m.channel !== 'INTERNAL_NOTES' &&
      m.recipientRole !== 'INTERNAL'
  );

/**
 * Seller-visible timeline sanitization filter.
 */
const filterSellerVisibleTimeline = (timeline = []) =>
  timeline.filter(
    (t) =>
      t.action !== 'INTERNAL_NOTE_ADDED' &&
      (!t.isInternal ||
        t.action === 'ADMIN_SELLER_DIRECTIVE' ||
        t.action === 'SELLER_ADMIN_MESSAGE' ||
        t.performerRole === 'SELLER')
  );

/**
 * Helper to dispatch customer complaint notifications via existing notification dispatcher
 */
const notifyCustomer = async ({ customerId, type, title, message, complaint, dedupSuffix = '' }) => {
  try {
    const customer = await User.findById(customerId).select('email').lean();
    if (!customer) return;

    await defaultDispatcher.dispatch({
      recipient: customerId,
      recipientEmail: customer.email,
      recipientRole: USER_ROLES.CUSTOMER,
      type: NOTIFICATION_TYPES.SYSTEM_ALERT,
      title,
      message,
      data: {
        complaintId: complaint._id.toString(),
        complaintNumber: complaint.complaintNumber,
        orderId: complaint.orderId?.toString(),
        orderNumber: complaint.orderNumber,
        status: complaint.status,
      },
      dedupKey: `COMPLAINT:${complaint._id}:${type}:${dedupSuffix || Date.now()}`,
    });
  } catch (err) {
    // Non-blocking notification failure
    console.error(`[Notification] Failed to dispatch complaint alert for ${complaint.complaintNumber}:`, err.message);
  }
};

/**
 * Helper to dispatch complaint notifications to all active administrators
 */
const notifyAdminsOnComplaint = async ({
  complaint,
  order,
  customer,
  category,
  subject,
  isReply = false,
  replyMessage = '',
  senderRole = 'CUSTOMER',
  senderName = '',
}) => {
  try {
    const adminUsers = await User.find({ role: USER_ROLES.ADMIN, isActive: true })
      .select('_id email name')
      .lean();
    if (!adminUsers || adminUsers.length === 0) return;

    const isSeller =
      senderRole === 'SELLER' ||
      replyMessage.startsWith('Merchant') ||
      replyMessage.startsWith('[Private Admin-Seller Chat]');
    const effectiveSender =
      senderName || (isSeller ? complaint.storeName || 'Seller' : customer?.name || 'Customer');

    let title = '';
    let message = '';
    const orderNum = order?.orderNumber || complaint.orderNumber || '';

    if (!isReply) {
      title = `New Dispute Filed: ${complaint.complaintNumber}`;
      message = `Customer ${customer?.name || 'Customer'} filed a complaint for Order #${orderNum} under category [${category}]: "${subject}".`;
    } else if (isSeller) {
      title = `Seller Replied: Dispute ${complaint.complaintNumber}`;
      message = `Seller ${effectiveSender} replied on dispute #${complaint.complaintNumber} (Order #${orderNum}): "${replyMessage.slice(0, 100)}${replyMessage.length > 100 ? '...' : ''}"`;
    } else {
      title = `Customer Replied: Dispute ${complaint.complaintNumber}`;
      message = `Customer ${customer?.name || 'Customer'} replied on dispute #${complaint.complaintNumber} (Order #${orderNum}): "${replyMessage.slice(0, 100)}${replyMessage.length > 100 ? '...' : ''}"`;
    }

    const actionUrl = `/admin/support?id=${complaint._id}`;

    await Promise.allSettled(
      adminUsers.map((admin) =>
        defaultDispatcher.dispatch({
          recipient: admin._id,
          recipientEmail: admin.email,
          recipientRole: USER_ROLES.ADMIN,
          type: NOTIFICATION_TYPES.SYSTEM_ALERT,
          title,
          message,
          actionText: 'Review Dispute',
          actionUrl,
          data: {
            complaintId: complaint._id.toString(),
            complaintNumber: complaint.complaintNumber,
            orderId: (order?._id || complaint.orderId)?.toString(),
            orderNumber: orderNum,
            category: complaint.category,
            status: complaint.status,
            priority: complaint.priority,
            customerId: (customer?._id || complaint.customerId)?.toString(),
            customerName: customer?.name || 'Customer',
            storeId: complaint.storeId?.toString(),
            storeName: complaint.storeName || '',
          },
          dedupKey: `COMPLAINT_ADMIN:${complaint._id}:${admin._id}:${isReply ? `REPLY_${Date.now()}` : 'CREATED'}`,
        })
      )
    );
  } catch (err) {
    console.error(
      `[Notification] Failed to dispatch admin complaint alerts for ${complaint.complaintNumber}:`,
      err.message
    );
  }
};

/**
 * Helper to dispatch complaint notifications to the owning seller of the store
 */
const notifySellerOnComplaint = async ({
  complaint,
  order,
  customer,
  category,
  subject,
  isReply = false,
  replyMessage = '',
  fromAdmin = false,
  adminMessage = '',
}) => {
  try {
    const store = await Store.findById(complaint.storeId).select('ownerId storeName').lean();
    if (!store || !store.ownerId) return;

    const seller = await User.findById(store.ownerId).select('_id email name').lean();
    if (!seller) return;

    const orderNum = order?.orderNumber || complaint.orderNumber || '';
    let title = '';
    let message = '';
    let dedupSuffix = '';

    if (fromAdmin) {
      title = `Admin Directive: Dispute ${complaint.complaintNumber}`;
      message = `Support Admin issued a notice regarding dispute #${complaint.complaintNumber} (Order #${orderNum}): "${adminMessage.slice(0, 100)}${adminMessage.length > 100 ? '...' : ''}"`;
      dedupSuffix = `ADMIN_MSG_${Date.now()}`;
    } else if (isReply) {
      title = `Customer Replied: Dispute ${complaint.complaintNumber}`;
      message = `Customer ${customer?.name || 'Customer'} replied on dispute #${complaint.complaintNumber} (Order #${orderNum}): "${replyMessage.slice(0, 100)}${replyMessage.length > 100 ? '...' : ''}"`;
      dedupSuffix = `REPLY_${Date.now()}`;
    } else {
      title = `New Customer Dispute: ${complaint.complaintNumber}`;
      message = `Customer ${customer?.name || 'Customer'} filed a dispute for Order #${orderNum} under category [${category}]: "${subject}". Please review and resolve.`;
      dedupSuffix = 'CREATED';
    }

    const actionUrl = `/seller/complaints?complaintId=${complaint._id}`;

    await defaultDispatcher.dispatch({
      recipient: seller._id,
      recipientEmail: seller.email,
      recipientRole: USER_ROLES.SELLER,
      type: NOTIFICATION_TYPES.SYSTEM_ALERT,
      title,
      message,
      actionText: 'View Dispute',
      actionUrl,
      data: {
        complaintId: complaint._id.toString(),
        complaintNumber: complaint.complaintNumber,
        orderId: (order?._id || complaint.orderId)?.toString(),
        orderNumber: orderNum,
        category: complaint.category,
        status: complaint.status,
        priority: complaint.priority,
      },
      dedupKey: `COMPLAINT_SELLER:${complaint._id}:${seller._id}:${dedupSuffix}`,
    });
  } catch (err) {
    console.error(
      `[Notification] Failed to dispatch seller complaint alert for ${complaint?.complaintNumber}:`,
      err.message
    );
  }
};

// =========================================================================
// CUSTOMER COMPLAINT SERVICES
// =========================================================================

/**
 * 1. Customer creates a complaint against an order
 */
export const createCustomerComplaintService = async (userActor, data) => {
  const { orderId, category, subject, description, relatedItemId, evidenceUrls } = data;

  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    throw new ApiError(400, 'Invalid Order ID format.', 'INVALID_ORDER_ID');
  }

  // 1. Fetch real Order and verify ownership
  const order = await Order.findById(orderId).populate('storeId', 'storeName').lean();
  if (!order) {
    throw new ApiError(404, 'Order not found.', 'ORDER_NOT_FOUND');
  }

  if (order.customerId.toString() !== userActor._id.toString()) {
    throw new ApiError(
      403,
      'Forbidden: You cannot create a complaint against an order that does not belong to you.',
      'FORBIDDEN'
    );
  }

  // 2. Verify related item if provided
  if (relatedItemId) {
    if (!mongoose.Types.ObjectId.isValid(relatedItemId)) {
      throw new ApiError(400, 'Invalid Item ID format.', 'INVALID_ITEM_ID');
    }
    const itemExists = order.items.some((item) => item._id.toString() === relatedItemId.toString());
    if (!itemExists) {
      throw new ApiError(400, 'The specified item does not belong to this order.', 'INVALID_RELATED_ITEM');
    }
  }

  // 3. Generate collision-resistant human-readable complaint number
  const complaintNumber = await Complaint.generateComplaintNumber();

  // 4. Create Complaint document
  const initialMessage = {
    senderId: userActor._id,
    senderRole: 'CUSTOMER',
    senderName: userActor.name || 'Customer',
    recipientRole: 'ALL',
    visibleToCustomer: true,
    channel: 'CUSTOMER_SELLER',
    message: description,
    attachments: evidenceUrls || [],
    isInternalNote: false,
    createdAt: new Date(),
  };

  const initialTimeline = {
    action: 'COMPLAINT_FILED',
    performedBy: userActor._id,
    performerRole: 'CUSTOMER',
    performerName: userActor.name || 'Customer',
    notes: `Complaint filed under category [${category}] for Order #${order.orderNumber}`,
    timestamp: new Date(),
  };

  const complaint = await Complaint.create({
    complaintNumber,
    customerId: userActor._id,
    orderId: order._id,
    orderNumber: order.orderNumber,
    storeId: order.storeId._id,
    storeName: order.storeId.storeName || '',
    relatedItemId: relatedItemId || null,
    category,
    priority: COMPLAINT_PRIORITY.MEDIUM,
    status: COMPLAINT_STATUS.OPEN,
    subject,
    description,
    evidenceUrls: evidenceUrls || [],
    messages: [initialMessage],
    timeline: [initialTimeline],
  });

  // 5. Notify customer of successful submission
  await notifyCustomer({
    customerId: userActor._id,
    type: 'COMPLAINT_CREATED',
    title: `Dispute Case Opened: ${complaintNumber}`,
    message: `Your complaint for order #${order.orderNumber} has been received. Our support team will review it shortly.`,
    complaint,
    dedupSuffix: 'CREATED',
  });

  // 5.1 In-App Notification to all active Administrators
  await notifyAdminsOnComplaint({
    complaint,
    order,
    customer: userActor,
    category,
    subject,
    isReply: false,
  });

  // 5.2 In-App Notification to Store Seller
  await notifySellerOnComplaint({
    complaint,
    order,
    customer: userActor,
    category,
    subject,
    isReply: false,
  });

  // Real-Time Socket.IO Alert to Admins
  try {
    emitToAdmin(SOCKET_EVENTS.ADMIN_ALERT, {
      alertType: 'NEW_COMPLAINT_FILED',
      title: `New Dispute: ${complaint.complaintNumber}`,
      message: `Complaint filed by customer for order #${order.orderNumber} under category ${category}.`,
      severity: 'WARNING',
      entityId: complaint._id,
      timestamp: new Date().toISOString(),
    });
  } catch (sockErr) {
    console.error('[Socket.IO] Error emitting complaint filed admin alert:', sockErr);
  }

  return complaint;
};

/**
 * 2. List complaints created by the authenticated customer
 */
export const listCustomerComplaintsService = async (userActor, queryParams = {}) => {
  const page = Math.max(1, parseInt(queryParams.page || '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(queryParams.limit || '10', 10)));
  const skip = (page - 1) * limit;

  // Strict ownership enforcement
  const filter = { customerId: userActor._id };

  if (queryParams.orderId && mongoose.Types.ObjectId.isValid(queryParams.orderId)) {
    filter.orderId = queryParams.orderId;
  }

  if (queryParams.status && Object.values(COMPLAINT_STATUS).includes(queryParams.status)) {
    filter.status = queryParams.status;
  }

  const [complaints, total] = await Promise.all([
    Complaint.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-messages.isInternalNote')
      .lean(),
    Complaint.countDocuments(filter),
  ]);

  // Sanitize messages and timeline (strictly isolate to direct customer-merchant dialogue)
  const sanitized = complaints.map((c) => ({
    ...c,
    messages: filterCustomerVisibleMessages(c.messages),
    timeline: filterCustomerVisibleTimeline(c.timeline),
  }));

  return {
    complaints: sanitized,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * 3. Customer views details of their own complaint
 */
export const getCustomerComplaintByIdService = async (complaintId, userActor) => {
  if (!mongoose.Types.ObjectId.isValid(complaintId)) {
    throw new ApiError(400, 'Invalid Complaint ID format.', 'INVALID_COMPLAINT_ID');
  }

  const complaint = await Complaint.findById(complaintId).lean();
  if (!complaint) {
    throw new ApiError(404, 'Complaint not found.', 'COMPLAINT_NOT_FOUND');
  }

  // Strict customer ownership check
  if (complaint.customerId.toString() !== userActor._id.toString()) {
    throw new ApiError(403, 'Forbidden: You do not have access to this complaint.', 'FORBIDDEN');
  }

  // Retrieve minimal related order info
  const order = await Order.findById(complaint.orderId)
    .select('orderNumber status paymentStatus pricingSummary fulfillmentType items')
    .lean();

  // Strictly filter out admin directives, staff notes, and internal timeline actions
  const customerMessages = filterCustomerVisibleMessages(complaint.messages);
  const customerTimeline = filterCustomerVisibleTimeline(complaint.timeline);

  return {
    ...complaint,
    messages: customerMessages,
    timeline: customerTimeline,
    orderDetails: order,
  };
};

/**
 * 4. Customer replies to an active complaint thread
 */
export const replyCustomerComplaintService = async (complaintId, userActor, { message, attachments = [] }) => {
  if (!mongoose.Types.ObjectId.isValid(complaintId)) {
    throw new ApiError(400, 'Invalid Complaint ID format.', 'INVALID_COMPLAINT_ID');
  }

  const complaint = await Complaint.findById(complaintId);
  if (!complaint) {
    throw new ApiError(404, 'Complaint not found.', 'COMPLAINT_NOT_FOUND');
  }

  // Strict ownership check
  if (complaint.customerId.toString() !== userActor._id.toString()) {
    throw new ApiError(403, 'Forbidden: You do not have access to this complaint.', 'FORBIDDEN');
  }

  // Communication window check
  if ([COMPLAINT_STATUS.CLOSED, COMPLAINT_STATUS.REJECTED].includes(complaint.status)) {
    throw new ApiError(
      400,
      `Cannot reply to a complaint in status [${complaint.status}]. Communication is closed.`,
      'COMPLAINT_COMMUNICATION_CLOSED'
    );
  }

  // If waiting for customer response, move back to UNDER_REVIEW
  if (complaint.status === COMPLAINT_STATUS.WAITING_FOR_CUSTOMER) {
    complaint.status = COMPLAINT_STATUS.UNDER_REVIEW;
  }

  complaint.messages.push({
    senderId: userActor._id,
    senderRole: 'CUSTOMER',
    senderName: userActor.name || 'Customer',
    recipientRole: 'ALL',
    visibleToCustomer: true,
    channel: 'CUSTOMER_SELLER',
    message,
    attachments: attachments || [],
    isInternalNote: false,
    createdAt: new Date(),
  });

  complaint.timeline.push({
    action: 'CUSTOMER_REPLIED',
    performedBy: userActor._id,
    performerRole: 'CUSTOMER',
    performerName: userActor.name || 'Customer',
    notes: 'Customer provided additional information/reply.',
    timestamp: new Date(),
  });

  await complaint.save();

  // Notify active Administrators of customer reply
  await notifyAdminsOnComplaint({
    complaint,
    order: { orderNumber: complaint.orderNumber, storeId: complaint.storeId },
    customer: userActor,
    category: complaint.category,
    subject: complaint.subject,
    isReply: true,
    replyMessage: message,
  });

  // Notify Store Seller of customer reply
  await notifySellerOnComplaint({
    complaint,
    order: { orderNumber: complaint.orderNumber, storeId: complaint.storeId },
    customer: userActor,
    category: complaint.category,
    subject: complaint.subject,
    isReply: true,
    replyMessage: message,
  });

  // Real-Time Socket.IO Alert to Admins
  try {
    emitToAdmin(SOCKET_EVENTS.ADMIN_ALERT, {
      alertType: 'COMPLAINT_CUSTOMER_REPLY',
      title: `Customer Reply: ${complaint.complaintNumber}`,
      message: `Customer replied on dispute #${complaint.complaintNumber} for order #${complaint.orderNumber}.`,
      severity: 'INFO',
      entityId: complaint._id,
      timestamp: new Date().toISOString(),
    });
  } catch (sockErr) {
    console.error('[Socket.IO] Error emitting complaint reply admin alert:', sockErr);
  }

  // Return sanitized complaint for customer
  const updatedDoc = complaint.toObject();
  updatedDoc.messages = filterCustomerVisibleMessages(updatedDoc.messages);
  updatedDoc.timeline = filterCustomerVisibleTimeline(updatedDoc.timeline);

  return updatedDoc;
};

/**
 * 5. Customer closes their resolved complaint
 */
export const closeCustomerComplaintService = async (complaintId, userActor, reason = '') => {
  if (!mongoose.Types.ObjectId.isValid(complaintId)) {
    throw new ApiError(400, 'Invalid Complaint ID format.', 'INVALID_COMPLAINT_ID');
  }

  const complaint = await Complaint.findById(complaintId);
  if (!complaint) {
    throw new ApiError(404, 'Complaint not found.', 'COMPLAINT_NOT_FOUND');
  }

  if (complaint.customerId.toString() !== userActor._id.toString()) {
    throw new ApiError(403, 'Forbidden: You do not have access to this complaint.', 'FORBIDDEN');
  }

  if (complaint.status === COMPLAINT_STATUS.CLOSED) {
    throw new ApiError(400, 'Complaint is already closed.', 'COMPLAINT_ALREADY_CLOSED');
  }

  if (complaint.status === COMPLAINT_STATUS.REJECTED) {
    throw new ApiError(400, 'Rejected complaints cannot be manually closed.', 'COMPLAINT_REJECTED');
  }

  complaint.status = COMPLAINT_STATUS.CLOSED;
  complaint.timeline.push({
    action: 'COMPLAINT_CLOSED',
    performedBy: userActor._id,
    performerRole: 'CUSTOMER',
    performerName: userActor.name || 'Customer',
    notes: reason ? `Customer closed complaint: ${reason}` : 'Customer acknowledged resolution and closed case.',
    timestamp: new Date(),
  });

  await complaint.save();

  await notifyCustomer({
    customerId: userActor._id,
    type: 'COMPLAINT_CLOSED',
    title: `Case Closed: ${complaint.complaintNumber}`,
    message: `Your dispute case ${complaint.complaintNumber} is now closed. Thank you for using NearExpiry.`,
    complaint,
    dedupSuffix: 'CLOSED',
  });

  const updatedDoc = complaint.toObject();
  updatedDoc.messages = filterCustomerVisibleMessages(updatedDoc.messages);
  updatedDoc.timeline = filterCustomerVisibleTimeline(updatedDoc.timeline);

  return updatedDoc;
};

// =========================================================================
// ADMIN DISPUTE RESOLUTION SERVICES
// =========================================================================

/**
 * 6. Admin lists all platform complaints with multi-criteria filtering
 */
export const listAdminComplaintsService = async (queryParams = {}) => {
  const page = Math.max(1, parseInt(queryParams.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(queryParams.limit || '20', 10)));
  const skip = (page - 1) * limit;

  const filter = {};

  if (queryParams.status && Object.values(COMPLAINT_STATUS).includes(queryParams.status)) {
    filter.status = queryParams.status;
  }
  if (queryParams.priority && Object.values(COMPLAINT_PRIORITY).includes(queryParams.priority)) {
    filter.priority = queryParams.priority;
  }
  if (queryParams.category && Object.values(COMPLAINT_CATEGORY).includes(queryParams.category)) {
    filter.category = queryParams.category;
  }
  if (queryParams.storeId && mongoose.Types.ObjectId.isValid(queryParams.storeId)) {
    filter.storeId = queryParams.storeId;
  }
  if (queryParams.assignedAdminId && mongoose.Types.ObjectId.isValid(queryParams.assignedAdminId)) {
    filter.assignedAdminId = queryParams.assignedAdminId;
  }
  if (queryParams.search) {
    const searchRegex = new RegExp(queryParams.search.trim(), 'i');
    filter.$or = [
      { complaintNumber: searchRegex },
      { orderNumber: searchRegex },
      { subject: searchRegex },
      { storeName: searchRegex },
    ];
  }

  if (queryParams.startDate || queryParams.endDate) {
    filter.createdAt = {};
    if (queryParams.startDate) filter.createdAt.$gte = new Date(queryParams.startDate);
    if (queryParams.endDate) filter.createdAt.$lte = new Date(queryParams.endDate);
  }

  const [complaints, total] = await Promise.all([
    Complaint.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('customerId', 'name email phone')
      .populate('assignedAdminId', 'name email')
      .lean(),
    Complaint.countDocuments(filter),
  ]);

  return {
    complaints,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * 7. Admin views complete complaint dossier for investigation
 */
export const getAdminComplaintDossierService = async (complaintId) => {
  if (!mongoose.Types.ObjectId.isValid(complaintId)) {
    throw new ApiError(400, 'Invalid Complaint ID format.', 'INVALID_COMPLAINT_ID');
  }

  const complaint = await Complaint.findById(complaintId)
    .populate('customerId', 'name email phone avatar verificationStatus')
    .populate('assignedAdminId', 'name email')
    .lean();

  if (!complaint) {
    throw new ApiError(404, 'Complaint not found.', 'COMPLAINT_NOT_FOUND');
  }

  // Load associated Order with deep batch allocations, store telemetry, and pricing
  const order = await Order.findById(complaint.orderId)
    .populate('storeId', 'storeName address contactPhone isActive verificationStatus ownerId')
    .populate('paymentId', 'transactionReference amount status method refundDetails')
    .lean();

  // Find other disputes filed against this same order (excluding current)
  const relatedOrderComplaints = await Complaint.find({
    orderId: complaint.orderId,
    _id: { $ne: complaint._id },
  })
    .select('complaintNumber category priority status subject createdAt resolvedAt resolution')
    .sort({ createdAt: -1 })
    .lean();

  // Total disputes filed by this customer across the platform
  const customerDisputeCount = await Complaint.countDocuments({
    customerId: complaint.customerId?._id || complaint.customerId,
  });

  return {
    complaint,
    orderDossier: order,
    relatedOrderComplaints,
    customerDisputeCount,
  };
};

/**
 * 8. Admin updates complaint status with state-machine transition guard
 */
export const updateAdminComplaintStatusService = async (complaintId, userActor, { status, note = '' }) => {
  if (!mongoose.Types.ObjectId.isValid(complaintId)) {
    throw new ApiError(400, 'Invalid Complaint ID format.', 'INVALID_COMPLAINT_ID');
  }

  if (!Object.values(COMPLAINT_STATUS).includes(status)) {
    throw new ApiError(400, `Invalid status [${status}].`, 'INVALID_STATUS');
  }

  const complaint = await Complaint.findById(complaintId);
  if (!complaint) {
    throw new ApiError(404, 'Complaint not found.', 'COMPLAINT_NOT_FOUND');
  }

  // Verify state transition validity
  const allowedNextStatuses = VALID_STATUS_TRANSITIONS[complaint.status] || [];
  if (!allowedNextStatuses.includes(status)) {
    throw new ApiError(
      400,
      `Invalid status transition from [${complaint.status}] to [${status}].`,
      'INVALID_STATUS_TRANSITION'
    );
  }

  const previousStatus = complaint.status;
  complaint.status = status;

  complaint.timeline.push({
    action: 'STATUS_CHANGED',
    performedBy: userActor._id,
    performerRole: 'ADMIN',
    performerName: userActor.name || 'Admin',
    notes: note || `Status transitioned from ${previousStatus} to ${status}`,
    metadata: { previousStatus, newStatus: status },
    timestamp: new Date(),
  });

  await complaint.save();

  // Send contextual customer alerts
  if (status === COMPLAINT_STATUS.UNDER_REVIEW) {
    await notifyCustomer({
      customerId: complaint.customerId,
      type: 'COMPLAINT_UNDER_REVIEW',
      title: `Case Under Review: ${complaint.complaintNumber}`,
      message: `An administrator is actively investigating your dispute for order #${complaint.orderNumber}.`,
      complaint,
      dedupSuffix: 'UNDER_REVIEW',
    });
  } else if (status === COMPLAINT_STATUS.WAITING_FOR_CUSTOMER) {
    await notifyCustomer({
      customerId: complaint.customerId,
      type: 'ACTION_REQUIRED',
      title: `Action Required on Case: ${complaint.complaintNumber}`,
      message: `The support team needs additional information from you: "${note || 'Please check the complaint conversation thread.'}"`,
      complaint,
      dedupSuffix: 'WAITING_FOR_CUSTOMER',
    });
  }

  return complaint;
};

/**
 * 9. Admin updates priority
 */
export const updateAdminComplaintPriorityService = async (complaintId, userActor, { priority, note = '' }) => {
  if (!mongoose.Types.ObjectId.isValid(complaintId)) {
    throw new ApiError(400, 'Invalid Complaint ID format.', 'INVALID_COMPLAINT_ID');
  }

  if (!Object.values(COMPLAINT_PRIORITY).includes(priority)) {
    throw new ApiError(400, `Invalid priority [${priority}].`, 'INVALID_PRIORITY');
  }

  const complaint = await Complaint.findById(complaintId);
  if (!complaint) {
    throw new ApiError(404, 'Complaint not found.', 'COMPLAINT_NOT_FOUND');
  }

  const previousPriority = complaint.priority;
  complaint.priority = priority;

  complaint.timeline.push({
    action: 'PRIORITY_CHANGED',
    performedBy: userActor._id,
    performerRole: 'ADMIN',
    performerName: userActor.name || 'Admin',
    notes: note || `Priority updated from ${previousPriority} to ${priority}`,
    metadata: { previousPriority, newPriority: priority },
    timestamp: new Date(),
  });

  await complaint.save();
  return complaint;
};

/**
 * 10. Admin assigns/reassigns complaint
 */
export const assignAdminComplaintService = async (complaintId, userActor, { adminId }) => {
  if (!mongoose.Types.ObjectId.isValid(complaintId)) {
    throw new ApiError(400, 'Invalid Complaint ID format.', 'INVALID_COMPLAINT_ID');
  }

  const complaint = await Complaint.findById(complaintId);
  if (!complaint) {
    throw new ApiError(404, 'Complaint not found.', 'COMPLAINT_NOT_FOUND');
  }

  let assignedAdminName = null;
  let targetAdminId = null;

  if (adminId) {
    if (!mongoose.Types.ObjectId.isValid(adminId)) {
      throw new ApiError(400, 'Invalid Admin User ID format.', 'INVALID_ADMIN_ID');
    }
    const adminUser = await User.findOne({ _id: adminId, role: USER_ROLES.ADMIN }).select('name').lean();
    if (!adminUser) {
      throw new ApiError(404, 'Admin user not found or not an authorized administrator.', 'ADMIN_NOT_FOUND');
    }
    targetAdminId = adminUser._id;
    assignedAdminName = adminUser.name;
  }

  complaint.assignedAdminId = targetAdminId;
  complaint.assignedAdminName = assignedAdminName;

  complaint.timeline.push({
    action: 'COMPLAINT_ASSIGNED',
    performedBy: userActor._id,
    performerRole: 'ADMIN',
    performerName: userActor.name || 'Admin',
    notes: targetAdminId ? `Assigned case to admin: ${assignedAdminName}` : 'Unassigned case.',
    metadata: { assignedAdminId: targetAdminId },
    timestamp: new Date(),
  });

  await complaint.save();
  return complaint;
};

/**
 * 11. Admin sends message (customer visible OR internal note)
 */
export const sendAdminMessageService = async (
  complaintId,
  userActor,
  { message, attachments = [], isInternalNote = false, channel = 'ADMIN_SELLER' }
) => {
  if (!mongoose.Types.ObjectId.isValid(complaintId)) {
    throw new ApiError(400, 'Invalid Complaint ID format.', 'INVALID_COMPLAINT_ID');
  }

  const complaint = await Complaint.findById(complaintId);
  if (!complaint) {
    throw new ApiError(404, 'Complaint not found.', 'COMPLAINT_NOT_FOUND');
  }

  const selectedChannel = isInternalNote ? 'INTERNAL_NOTES' : (channel || 'ADMIN_SELLER');

  complaint.messages.push({
    senderId: userActor._id,
    senderRole: 'ADMIN',
    senderName: userActor.name || 'Support Agent',
    recipientRole: isInternalNote ? 'INTERNAL' : 'SELLER',
    visibleToCustomer: false,
    channel: selectedChannel,
    message,
    attachments: attachments || [],
    isInternalNote: Boolean(isInternalNote),
    createdAt: new Date(),
  });

  complaint.timeline.push({
    action: isInternalNote ? 'INTERNAL_NOTE_ADDED' : 'ADMIN_SELLER_DIRECTIVE',
    performedBy: userActor._id,
    performerRole: 'ADMIN',
    performerName: userActor.name || 'Support Agent',
    notes: isInternalNote
      ? 'Internal operational note recorded (hidden from customer and merchant).'
      : 'Admin sent a message in Admin-Merchant private chat (hidden from customer).',
    isInternal: true,
    timestamp: new Date(),
  });

  await complaint.save();

  // If directive to seller, notify ONLY the merchant (hidden from customer)
  if (!isInternalNote) {
    await notifySellerOnComplaint({
      complaint,
      fromAdmin: true,
      adminMessage: message,
    });
  }

  return complaint;
};

/**
 * 12. Admin adds dedicated internal note
 */
export const addAdminInternalNoteService = async (complaintId, userActor, { note }) => {
  return sendAdminMessageService(complaintId, userActor, {
    message: note,
    attachments: [],
    isInternalNote: true,
  });
};

/**
 * 13. Admin resolves complaint with strict operational safety & mutation guards
 */
export const resolveAdminComplaintService = async (
  complaintId,
  userActor,
  { decision, notes, refundAmount = 0, actionRequested = RESOLUTION_ACTION_TYPE.NONE }
) => {
  if (!mongoose.Types.ObjectId.isValid(complaintId)) {
    throw new ApiError(400, 'Invalid Complaint ID format.', 'INVALID_COMPLAINT_ID');
  }

  if (!Object.values(RESOLUTION_DECISION).includes(decision)) {
    throw new ApiError(400, `Invalid resolution decision [${decision}].`, 'INVALID_DECISION');
  }

  if (!Object.values(RESOLUTION_ACTION_TYPE).includes(actionRequested)) {
    throw new ApiError(400, `Invalid actionRequested type [${actionRequested}].`, 'INVALID_ACTION_REQUESTED');
  }

  const complaint = await Complaint.findById(complaintId);
  if (!complaint) {
    throw new ApiError(404, 'Complaint not found.', 'COMPLAINT_NOT_FOUND');
  }

  // Duplicate resolution check
  if ([COMPLAINT_STATUS.RESOLVED, COMPLAINT_STATUS.CLOSED, COMPLAINT_STATUS.REJECTED].includes(complaint.status)) {
    if (complaint.resolution?.actionExecutionStatus === RESOLUTION_ACTION_EXECUTION_STATUS.EXECUTED) {
      throw new ApiError(
        400,
        'Complaint is already finalized with executed financial/inventory actions.',
        'COMPLAINT_ALREADY_FINALIZED'
      );
    }
  }

  // Load real Order
  const order = await Order.findById(complaint.orderId);
  if (!order) {
    throw new ApiError(404, 'Associated order not found for this complaint.', 'ORDER_NOT_FOUND');
  }

  // Load Payment if financial action requested
  let payment = null;
  if (
    actionRequested === RESOLUTION_ACTION_TYPE.EXECUTE_REFUND ||
    actionRequested === RESOLUTION_ACTION_TYPE.BOTH
  ) {
    payment = await Payment.findOne({ orderId: order._id });
    if (!payment) {
      throw new ApiError(400, 'No payment record found for this order to process refund.', 'PAYMENT_NOT_FOUND');
    }
    if (payment.status === PAYMENT_STATUS.REFUNDED) {
      throw new ApiError(400, 'Payment has already been refunded. Duplicate refund blocked.', 'PAYMENT_ALREADY_REFUNDED');
    }
    if (payment.status !== PAYMENT_STATUS.SUCCESS) {
      throw new ApiError(
        400,
        `Cannot refund payment in status [${payment.status}]. Only SUCCESS payments are refundable.`,
        'PAYMENT_NOT_REFUNDABLE'
      );
    }

    const calculatedRefund = refundAmount > 0 ? Number(refundAmount) : payment.amount;
    if (calculatedRefund <= 0 || calculatedRefund > payment.amount) {
      throw new ApiError(
        400,
        `Invalid refund amount. Must be between ₹0.01 and ₹${payment.amount}.`,
        'INVALID_REFUND_AMOUNT'
      );
    }
  }

  // Cancellation validation if operational action requested
  if (
    actionRequested === RESOLUTION_ACTION_TYPE.EXECUTE_ORDER_CANCEL ||
    actionRequested === RESOLUTION_ACTION_TYPE.BOTH
  ) {
    if (order.status === ORDER_STATUS.CANCELLED) {
      throw new ApiError(
        400,
        'Order is already cancelled. Duplicate cancellation & restock blocked.',
        'ORDER_ALREADY_CANCELLED'
      );
    }
  }

  // Execution tracking variables
  let refundId = null;
  let refundStatus = null;
  let cancellationStatus = null;
  let stockRestored = false;
  let executionError = null;
  let executionStatus = RESOLUTION_ACTION_EXECUTION_STATUS.NONE;

  // Execute Operational Mutations Safely
  // Safe Order of operations for BOTH:
  // Step 1: Cancel Order (handles inventory restock / write-offs)
  // Step 2: Refund Payment (handles financial transaction reversal)
  try {
    if (
      actionRequested === RESOLUTION_ACTION_TYPE.EXECUTE_ORDER_CANCEL ||
      actionRequested === RESOLUTION_ACTION_TYPE.BOTH
    ) {
      const cancelReason = `Complaint ${complaint.complaintNumber} Resolution: ${notes}`;
      const cancelledOrder = await cancelOrderService(order._id, userActor, cancelReason);
      cancellationStatus = 'SUCCESS';
      stockRestored = Boolean(cancelledOrder.cancellation?.stockRestored);

      complaint.timeline.push({
        action: 'ORDER_CANCELLED',
        performedBy: userActor._id,
        performerRole: 'ADMIN',
        performerName: userActor.name || 'Admin',
        notes: `Order #${order.orderNumber} cancelled and batches restocked per dispute resolution.`,
        timestamp: new Date(),
      });
    }

    if (
      actionRequested === RESOLUTION_ACTION_TYPE.EXECUTE_REFUND ||
      actionRequested === RESOLUTION_ACTION_TYPE.BOTH
    ) {
      const targetRefundAmount = refundAmount > 0 ? Number(refundAmount) : payment.amount;
      const refundReason = `Complaint ${complaint.complaintNumber} Resolution: ${notes}`;
      const refundedPayment = await refundPaymentService(
        payment._id,
        userActor,
        refundReason,
        targetRefundAmount
      );
      refundId = refundedPayment.refundDetails?.refundId || null;
      refundStatus = 'SUCCESS';

      complaint.timeline.push({
        action: 'REFUND_EXECUTED',
        performedBy: userActor._id,
        performerRole: 'ADMIN',
        performerName: userActor.name || 'Admin',
        notes: `Refund of ₹${targetRefundAmount} executed for payment #${payment._id}. Refund ID: ${refundId}`,
        metadata: { refundId, amount: targetRefundAmount },
        timestamp: new Date(),
      });
    }

    if (actionRequested !== RESOLUTION_ACTION_TYPE.NONE) {
      executionStatus = RESOLUTION_ACTION_EXECUTION_STATUS.EXECUTED;
    }
  } catch (err) {
    executionError = err.message;
    executionStatus = RESOLUTION_ACTION_EXECUTION_STATUS.FAILED;

    complaint.timeline.push({
      action: 'RESOLUTION_FAILED',
      performedBy: userActor._id,
      performerRole: 'ADMIN',
      performerName: userActor.name || 'Admin',
      notes: `Operational mutation failed: ${err.message}`,
      metadata: { error: err.message, actionRequested },
      timestamp: new Date(),
    });

    // Save partial failure state and re-throw
    complaint.resolution = {
      decision,
      notes,
      resolvedBy: userActor._id,
      resolvedByName: userActor.name || 'Admin',
      resolvedAt: new Date(),
      refundAmount: refundAmount || 0,
      actionRequested,
      actionExecutionStatus: executionStatus,
      actionExecutionResult: {
        refundId,
        refundStatus,
        cancellationStatus,
        stockRestored,
        error: executionError,
        executedAt: new Date(),
      },
    };
    await complaint.save();

    throw new ApiError(500, `Resolution action failed: ${err.message}`, 'RESOLUTION_EXECUTION_FAILED');
  }

  // Update Complaint Status & Resolution Metadata
  const isRejected = decision === RESOLUTION_DECISION.REJECTED_INVALID;
  const newStatus = isRejected ? COMPLAINT_STATUS.REJECTED : COMPLAINT_STATUS.RESOLVED;

  complaint.status = newStatus;
  complaint.resolution = {
    decision,
    notes,
    resolvedBy: userActor._id,
    resolvedByName: userActor.name || 'Admin',
    resolvedAt: new Date(),
    refundAmount: refundAmount || 0,
    actionRequested,
    actionExecutionStatus: executionStatus,
    actionExecutionResult: {
      refundId,
      refundStatus,
      cancellationStatus,
      stockRestored,
      error: null,
      executedAt: new Date(),
    },
  };

  complaint.timeline.push({
    action: isRejected ? 'COMPLAINT_REJECTED' : 'COMPLAINT_RESOLVED',
    performedBy: userActor._id,
    performerRole: 'ADMIN',
    performerName: userActor.name || 'Admin',
    notes: `Dispute concluded with decision [${decision}]. Notes: ${notes}`,
    metadata: { decision, actionRequested, executionStatus },
    timestamp: new Date(),
  });

  await complaint.save();

  // Notify customer of final resolution
  const notifyTitle = isRejected
    ? `Dispute Claim Rejected: ${complaint.complaintNumber}`
    : `Dispute Resolved: ${complaint.complaintNumber}`;
  const notifyMsg = isRejected
    ? `Your dispute claim was reviewed and could not be approved. Reason: ${notes}`
    : `Your dispute has been resolved with decision [${decision}]. ${
        actionRequested !== RESOLUTION_ACTION_TYPE.NONE ? 'Actions have been processed.' : ''
      }`;

  await notifyCustomer({
    customerId: complaint.customerId,
    type: isRejected ? 'COMPLAINT_REJECTED' : 'COMPLAINT_RESOLVED',
    title: notifyTitle,
    message: notifyMsg,
    complaint,
    dedupSuffix: isRejected ? 'REJECTED' : 'RESOLVED',
  });

  return complaint;
};

// =========================================================================
// SELLER COMPLAINT SERVICES
// =========================================================================

/**
 * Helper to retrieve authenticated seller's store with strict validation
 */
const getAuthenticatedSellerStore = async (sellerId) => {
  const store = await Store.findOne({ ownerId: sellerId });
  if (!store) {
    throw new ApiError(404, 'No store associated with this merchant account.', 'STORE_NOT_FOUND');
  }
  return store;
};

/**
 * 1. List complaints filed against orders belonging to the seller's store
 */
export const listSellerComplaintsService = async (userActor, queryParams = {}) => {
  const store = await getAuthenticatedSellerStore(userActor._id);

  const page = Math.max(1, parseInt(queryParams.page || '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(queryParams.limit || '10', 10)));
  const skip = (page - 1) * limit;

  // Strict store ownership filter
  const filter = { storeId: store._id };

  if (queryParams.status && Object.values(COMPLAINT_STATUS).includes(queryParams.status)) {
    filter.status = queryParams.status;
  }

  if (queryParams.priority && Object.values(COMPLAINT_PRIORITY).includes(queryParams.priority)) {
    filter.priority = queryParams.priority;
  }

  if (queryParams.category && Object.values(COMPLAINT_CATEGORY).includes(queryParams.category)) {
    filter.category = queryParams.category;
  }

  if (queryParams.search) {
    const searchRegex = new RegExp(queryParams.search.trim(), 'i');
    filter.$or = [
      { complaintNumber: searchRegex },
      { orderNumber: searchRegex },
      { subject: searchRegex },
    ];
  }

  const [complaints, total] = await Promise.all([
    Complaint.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('customerId', 'name email phone')
      .lean(),
    Complaint.countDocuments(filter),
  ]);

  // Sanitize internal staff notes from seller view (keep customer dialogue and admin directives)
  const sanitized = complaints.map((c) => ({
    ...c,
    messages: filterSellerVisibleMessages(c.messages),
    timeline: filterSellerVisibleTimeline(c.timeline),
  }));

  return {
    complaints: sanitized,
    storeDetails: {
      storeId: store._id,
      storeName: store.storeName,
      isActive: store.isActive,
      verificationStatus: store.verificationStatus,
    },
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * 2. Get specific complaint details for seller (with strict store ownership verification)
 */
export const getSellerComplaintByIdService = async (complaintId, userActor) => {
  if (!mongoose.Types.ObjectId.isValid(complaintId)) {
    throw new ApiError(400, 'Invalid Complaint ID format.', 'INVALID_COMPLAINT_ID');
  }

  const store = await getAuthenticatedSellerStore(userActor._id);

  const complaint = await Complaint.findById(complaintId)
    .populate('customerId', 'name email phone avatar')
    .lean();

  if (!complaint) {
    throw new ApiError(404, 'Complaint not found.', 'COMPLAINT_NOT_FOUND');
  }

  // Strict store ownership validation
  if (complaint.storeId.toString() !== store._id.toString()) {
    throw new ApiError(403, 'Forbidden: You do not have access to complaints for another store.', 'FORBIDDEN');
  }

  // Load related order telemetry
  const order = await Order.findById(complaint.orderId)
    .populate('paymentId', 'transactionReference amount status method')
    .lean();

  // Filter out internal admin staff notes from seller view
  const sanitizedMessages = filterSellerVisibleMessages(complaint.messages);
  const sanitizedTimeline = filterSellerVisibleTimeline(complaint.timeline);

  return {
    ...complaint,
    messages: sanitizedMessages,
    timeline: sanitizedTimeline,
    orderDetails: order,
    storeDetails: {
      storeId: store._id,
      storeName: store.storeName,
      isActive: store.isActive,
      verificationStatus: store.verificationStatus,
    },
  };
};

/**
 * 3. Seller responds to customer dispute thread
 */
export const replySellerComplaintService = async (
  complaintId,
  userActor,
  { message, attachments = [], channel = 'CUSTOMER_SELLER' }
) => {
  if (!mongoose.Types.ObjectId.isValid(complaintId)) {
    throw new ApiError(400, 'Invalid Complaint ID format.', 'INVALID_COMPLAINT_ID');
  }

  const store = await getAuthenticatedSellerStore(userActor._id);

  const complaint = await Complaint.findById(complaintId);
  if (!complaint) {
    throw new ApiError(404, 'Complaint not found.', 'COMPLAINT_NOT_FOUND');
  }

  // Strict ownership check
  if (complaint.storeId.toString() !== store._id.toString()) {
    throw new ApiError(403, 'Forbidden: You do not have access to this dispute.', 'FORBIDDEN');
  }

  // Communication window check
  if ([COMPLAINT_STATUS.CLOSED, COMPLAINT_STATUS.REJECTED].includes(complaint.status)) {
    throw new ApiError(
      400,
      `Cannot reply to a dispute in status [${complaint.status}]. Communication is closed.`,
      'COMPLAINT_COMMUNICATION_CLOSED'
    );
  }

  // Transition status to UNDER_REVIEW if it was OPEN or WAITING_FOR_SELLER
  if ([COMPLAINT_STATUS.OPEN, COMPLAINT_STATUS.WAITING_FOR_SELLER].includes(complaint.status)) {
    complaint.status = COMPLAINT_STATUS.UNDER_REVIEW;
  }

  const senderName = store.storeName || userActor.name || 'Merchant';
  const isAdminChannel = channel === 'ADMIN_SELLER';

  if (isAdminChannel) {
    // -------------------------------------------------------------
    // Seller communicating with Platform Admin (Admin-Seller Chat)
    // -------------------------------------------------------------
    complaint.messages.push({
      senderId: userActor._id,
      senderRole: 'SELLER',
      senderName,
      recipientRole: 'ADMIN',
      visibleToCustomer: false,
      channel: 'ADMIN_SELLER',
      message,
      attachments: attachments || [],
      isInternalNote: false,
      createdAt: new Date(),
    });

    complaint.timeline.push({
      action: 'SELLER_ADMIN_MESSAGE',
      performedBy: userActor._id,
      performerRole: 'SELLER',
      performerName: senderName,
      notes: 'Merchant sent a message in private Admin-Merchant chat (hidden from customer).',
      isInternal: true,
      timestamp: new Date(),
    });

    await complaint.save();

    // Notify Admins of merchant message
    await notifyAdminsOnComplaint({
      complaint,
      order: { orderNumber: complaint.orderNumber, storeId: complaint.storeId },
      customer: { name: complaint.customerName || 'Customer' },
      category: complaint.category,
      subject: complaint.subject,
      isReply: true,
      senderRole: 'SELLER',
      senderName,
      replyMessage: `[Private Admin-Seller Chat] ${senderName}: ${message}`,
    });

    try {
      emitToAdmin(SOCKET_EVENTS.ADMIN_ALERT, {
        alertType: 'SELLER_ADMIN_DIRECT_MESSAGE',
        title: `Merchant Message: ${complaint.complaintNumber}`,
        message: `${senderName} replied in Admin-Merchant chat for dispute #${complaint.complaintNumber}.`,
        severity: 'INFO',
        entityId: complaint._id,
        timestamp: new Date().toISOString(),
      });
    } catch (sockErr) {
      console.error('[Socket.IO] Error emitting seller admin alert:', sockErr);
    }
  } else {
    // -------------------------------------------------------------
    // Seller communicating with Customer (Customer-Seller Chat)
    // -------------------------------------------------------------
    complaint.messages.push({
      senderId: userActor._id,
      senderRole: 'SELLER',
      senderName,
      recipientRole: 'CUSTOMER',
      visibleToCustomer: true,
      channel: 'CUSTOMER_SELLER',
      message,
      attachments: attachments || [],
      isInternalNote: false,
      createdAt: new Date(),
    });

    complaint.timeline.push({
      action: 'SELLER_REPLIED',
      performedBy: userActor._id,
      performerRole: 'SELLER',
      performerName: senderName,
      notes: 'Merchant communicated with customer regarding dispute resolution.',
      isInternal: false,
      timestamp: new Date(),
    });

    await complaint.save();

    // 1. Notify Customer of merchant reply
    await notifyCustomer({
      customerId: complaint.customerId,
      type: 'SELLER_RESPONSE',
      title: `Merchant Replied: ${complaint.complaintNumber}`,
      message: `${senderName} responded: "${message.slice(0, 100)}${message.length > 100 ? '...' : ''}"`,
      complaint,
      dedupSuffix: `SELLER_MSG_${Date.now()}`,
    });

    // 2. Notify Admins of merchant reply
    await notifyAdminsOnComplaint({
      complaint,
      order: { orderNumber: complaint.orderNumber, storeId: complaint.storeId },
      customer: { name: complaint.customerName || 'Customer' },
      category: complaint.category,
      subject: complaint.subject,
      isReply: true,
      senderRole: 'SELLER',
      senderName,
      replyMessage: `Merchant (${senderName}): ${message}`,
    });
  }

  // Return sanitized complaint
  const updatedDoc = complaint.toObject();
  updatedDoc.messages = filterSellerVisibleMessages(updatedDoc.messages);
  updatedDoc.timeline = filterSellerVisibleTimeline(updatedDoc.timeline);

  return updatedDoc;
};

/**
 * 4. Seller marks dispute as resolved with customer explanation
 */
export const resolveSellerComplaintService = async (
  complaintId,
  userActor,
  { decision = RESOLUTION_DECISION.RESOLVED_WITH_EXPLANATION, notes }
) => {
  if (!mongoose.Types.ObjectId.isValid(complaintId)) {
    throw new ApiError(400, 'Invalid Complaint ID format.', 'INVALID_COMPLAINT_ID');
  }

  const store = await getAuthenticatedSellerStore(userActor._id);

  const complaint = await Complaint.findById(complaintId);
  if (!complaint) {
    throw new ApiError(404, 'Complaint not found.', 'COMPLAINT_NOT_FOUND');
  }

  // Strict ownership check
  if (complaint.storeId.toString() !== store._id.toString()) {
    throw new ApiError(403, 'Forbidden: You do not have access to this dispute.', 'FORBIDDEN');
  }

  if ([COMPLAINT_STATUS.RESOLVED, COMPLAINT_STATUS.CLOSED, COMPLAINT_STATUS.REJECTED].includes(complaint.status)) {
    throw new ApiError(400, `Complaint is already in ${complaint.status} status.`, 'COMPLAINT_ALREADY_FINALIZED');
  }

  const senderName = store.storeName || userActor.name || 'Merchant';

  complaint.status = COMPLAINT_STATUS.RESOLVED;
  complaint.resolution = {
    decision: decision || RESOLUTION_DECISION.RESOLVED_WITH_EXPLANATION,
    notes,
    resolvedBy: userActor._id,
    resolvedByName: senderName,
    resolvedAt: new Date(),
    refundAmount: 0,
    actionRequested: RESOLUTION_ACTION_TYPE.NONE,
    actionExecutionStatus: RESOLUTION_ACTION_EXECUTION_STATUS.NONE,
  };

  complaint.timeline.push({
    action: 'SELLER_RESOLVED',
    performedBy: userActor._id,
    performerRole: 'SELLER',
    performerName: senderName,
    notes: notes || 'Merchant resolved customer dispute directly.',
    metadata: { decision },
    timestamp: new Date(),
  });

  await complaint.save();

  // Notify customer of resolution
  await notifyCustomer({
    customerId: complaint.customerId,
    type: 'COMPLAINT_RESOLVED',
    title: `Dispute Resolved by Merchant: ${complaint.complaintNumber}`,
    message: `${senderName} has resolved your complaint with note: "${notes.slice(0, 100)}${notes.length > 100 ? '...' : ''}"`,
    complaint,
    dedupSuffix: `RESOLVED_${Date.now()}`,
  });

  // Notify admins of seller resolution
  await notifyAdminsOnComplaint({
    complaint,
    order: { orderNumber: complaint.orderNumber, storeId: complaint.storeId },
    customer: { name: senderName },
    category: complaint.category,
    subject: complaint.subject,
    isReply: true,
    replyMessage: `Merchant resolved dispute #${complaint.complaintNumber}: ${notes}`,
  });

  // Return sanitized complaint
  const updatedDoc = complaint.toObject();
  updatedDoc.messages = filterSellerVisibleMessages(updatedDoc.messages);
  updatedDoc.timeline = filterSellerVisibleTimeline(updatedDoc.timeline);

  return updatedDoc;
};

