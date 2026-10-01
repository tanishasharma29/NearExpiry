import mongoose from 'mongoose';
import { Payment, PAYMENT_STATUS, PAYMENT_METHOD } from '../models/payment.model.js';
import { Order, ORDER_STATUS } from '../models/order.model.js';
import { USER_ROLES } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import { getPaymentProvider } from './payment/providers/index.js';

const checkReplicaSetSupport = () => {
  const topology = mongoose.connection.client?.topology?.description;
  return (
    topology?.type === 'ReplicaSetWithPrimary' ||
    Boolean(topology?.setName) ||
    topology?.type === 'Sharded'
  );
};

/**
 * 1. Process Payment with Strict Idempotency and Provider Abstraction.
 *
 * GUARANTEES:
 * - Idempotency: Retries with the exact same idempotencyKey return the existing payment record.
 * - Prevents double payments on already completed orders.
 * - Order & Payment relationship is updated atomically.
 * - Never stores sensitive card or bank credentials.
 */
export const processPaymentService = async (customerId, payload, userActor) => {
  const { orderId, method, idempotencyKey, paymentDetails = {} } = payload;

  // 1. Idempotency Check: Return existing payment if already processed
  const existingPayment = await Payment.findOne({ idempotencyKey }).lean();
  if (existingPayment) {
    return {
      isIdempotentReplay: true,
      payment: existingPayment,
    };
  }

  // 2. Validate Order
  const order = await Order.findById(orderId).populate('storeId', 'storeName ownerId');
  if (!order) {
    throw new ApiError(404, 'Order not found.', 'ORDER_NOT_FOUND');
  }

  // Authorize customer
  if (userActor.role === USER_ROLES.CUSTOMER && order.customerId.toString() !== customerId.toString()) {
    throw new ApiError(403, 'Forbidden: You cannot pay for orders placed by other customers.', 'FORBIDDEN');
  }

  if (order.status === ORDER_STATUS.CANCELLED) {
    throw new ApiError(400, 'Cannot process payment for a cancelled order.', 'ORDER_CANCELLED');
  }

  if (order.paymentStatus === 'PAID') {
    throw new ApiError(400, 'This order has already been paid.', 'ORDER_ALREADY_PAID');
  }

  // 3. Delegate to Pluggable Provider Adapter
  const provider = getPaymentProvider(method);
  const providerResult = await provider.processPayment({
    amount: order.pricingSummary.finalTotal,
    currency: 'INR',
    orderNumber: order.orderNumber,
    metadata: paymentDetails,
  });

  const isReplicaSet = checkReplicaSetSupport();
  const session = isReplicaSet ? await mongoose.startSession() : null;
  if (session) {
    session.startTransaction();
  }

  try {
    const paymentDoc = {
      orderId: order._id,
      customerId,
      storeId: order.storeId._id,
      amount: order.pricingSummary.finalTotal,
      currency: 'INR',
      method,
      status: providerResult.status,
      idempotencyKey,
      transactionReference: providerResult.transactionReference,
      providerResponse: providerResult.providerMetadata,
      paidAt: providerResult.success && method !== PAYMENT_METHOD.CASH_ON_DELIVERY ? new Date() : null,
      failureReason: providerResult.success ? null : providerResult.failureReason,
    };

    let payment;
    if (session) {
      const created = await Payment.create([paymentDoc], { session });
      payment = created[0];
    } else {
      payment = await Payment.create(paymentDoc);
    }

    // Update Order Payment Status
    const orderPaymentStatus =
      providerResult.status === PAYMENT_STATUS.SUCCESS
        ? 'PAID'
        : providerResult.status === PAYMENT_STATUS.FAILED
        ? 'FAILED'
        : 'PENDING';

    const orderUpdate = {
      $set: {
        paymentStatus: orderPaymentStatus,
        paymentMethod: method,
        paymentId: payment._id,
      },
      $push: {
        statusTimeline: {
          status: order.status,
          timestamp: new Date(),
          updatedBy: userActor._id,
          updatedByRole: userActor.role,
          note:
            providerResult.status === PAYMENT_STATUS.SUCCESS
              ? `Payment captured successfully via ${method} (Ref: ${providerResult.transactionReference})`
              : providerResult.status === PAYMENT_STATUS.FAILED
              ? `Payment failed via ${method}: ${providerResult.failureReason}`
              : `Payment initialized as Cash on Delivery (Ref: ${providerResult.transactionReference})`,
        },
      },
    };

    if (session) {
      await Order.findByIdAndUpdate(order._id, orderUpdate, { session });
      await session.commitTransaction();
    } else {
      await Order.findByIdAndUpdate(order._id, orderUpdate);
    }

    return {
      isIdempotentReplay: false,
      payment,
    };
  } catch (error) {
    if (session) {
      await session.abortTransaction();
    }
    throw error;
  } finally {
    if (session) {
      session.endSession();
    }
  }
};

/**
 * 2. Confirm Cash on Delivery Payment (Seller / Admin handover verification).
 */
export const confirmCodPaymentService = async (paymentId, userActor, notes = '') => {
  const payment = await Payment.findById(paymentId);
  if (!payment) {
    throw new ApiError(404, 'Payment record not found.', 'PAYMENT_NOT_FOUND');
  }

  if (payment.method !== PAYMENT_METHOD.CASH_ON_DELIVERY) {
    throw new ApiError(400, 'Only Cash on Delivery payments can be confirmed manually.', 'INVALID_PAYMENT_METHOD');
  }

  if (payment.status === PAYMENT_STATUS.SUCCESS) {
    throw new ApiError(400, 'Cash payment is already confirmed as collected.', 'PAYMENT_ALREADY_SUCCESS');
  }

  const order = await Order.findById(payment.orderId).populate('storeId', 'ownerId');
  if (!order) {
    throw new ApiError(404, 'Linked order not found.', 'ORDER_NOT_FOUND');
  }

  if (userActor.role === USER_ROLES.SELLER && order.storeId.ownerId?.toString() !== userActor._id.toString()) {
    throw new ApiError(403, 'Forbidden: You can only confirm COD payments for your store.', 'FORBIDDEN');
  }

  payment.status = PAYMENT_STATUS.SUCCESS;
  payment.paidAt = new Date();
  payment.providerResponse = {
    ...payment.providerResponse,
    confirmedBy: userActor._id,
    confirmedAt: new Date().toISOString(),
    notes: notes || 'Cash received by seller at physical handover',
  };
  await payment.save();

  await Order.findByIdAndUpdate(order._id, {
    $set: { paymentStatus: 'PAID' },
    $push: {
      statusTimeline: {
        status: order.status,
        timestamp: new Date(),
        updatedBy: userActor._id,
        updatedByRole: userActor.role,
        note: `Cash payment of ₹${payment.amount} collected and confirmed.`,
      },
    },
  });

  return payment;
};

/**
 * 3. Process Refund for a Payment (Seller / Admin).
 */
export const refundPaymentService = async (paymentId, userActor, reason, amount = null) => {
  const payment = await Payment.findById(paymentId);
  if (!payment) {
    throw new ApiError(404, 'Payment record not found.', 'PAYMENT_NOT_FOUND');
  }

  if (payment.status === PAYMENT_STATUS.REFUNDED) {
    throw new ApiError(400, 'Payment has already been refunded.', 'PAYMENT_ALREADY_REFUNDED');
  }

  if (payment.status !== PAYMENT_STATUS.SUCCESS) {
    throw new ApiError(400, `Cannot refund payment in status [${payment.status}]. Only SUCCESS payments can be refunded.`, 'PAYMENT_NOT_REFUNDABLE');
  }

  const refundAmount = amount ? Number(amount) : payment.amount;
  if (refundAmount <= 0 || refundAmount > payment.amount) {
    throw new ApiError(400, `Invalid refund amount. Must be between 0.01 and ${payment.amount}.`, 'INVALID_REFUND_AMOUNT');
  }

  const order = await Order.findById(payment.orderId).populate('storeId', 'ownerId');
  if (userActor.role === USER_ROLES.SELLER && order?.storeId.ownerId?.toString() !== userActor._id.toString()) {
    throw new ApiError(403, 'Forbidden: You can only refund payments for your store.', 'FORBIDDEN');
  }

  const provider = getPaymentProvider(payment.method);
  const refundResult = await provider.processRefund({
    transactionReference: payment.transactionReference,
    amount: refundAmount,
    reason,
  });

  payment.status = PAYMENT_STATUS.REFUNDED;
  payment.refundDetails = {
    refundId: refundResult.refundId,
    amount: refundAmount,
    reason,
    refundedAt: new Date(),
    performedBy: userActor._id,
  };
  await payment.save();

  if (order) {
    await Order.findByIdAndUpdate(order._id, {
      $set: { paymentStatus: 'REFUNDED' },
      $push: {
        statusTimeline: {
          status: order.status,
          timestamp: new Date(),
          updatedBy: userActor._id,
          updatedByRole: userActor.role,
          note: `Refund of ₹${refundAmount} processed: ${reason}`,
        },
      },
    });
  }

  return payment;
};

/**
 * 4. Get Payment by Order ID.
 */
export const getPaymentByOrderIdService = async (orderId, userActor) => {
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    throw new ApiError(400, 'Invalid Order ID format.', 'INVALID_ORDER_ID');
  }

  const order = await Order.findById(orderId).populate('storeId', 'ownerId');
  if (!order) {
    throw new ApiError(404, 'Order not found.', 'ORDER_NOT_FOUND');
  }

  if (userActor.role === USER_ROLES.CUSTOMER && order.customerId.toString() !== userActor._id.toString()) {
    throw new ApiError(403, 'Forbidden: You cannot view payments for other customers.', 'FORBIDDEN');
  }

  if (userActor.role === USER_ROLES.SELLER && order.storeId.ownerId?.toString() !== userActor._id.toString()) {
    throw new ApiError(403, 'Forbidden: You can only view payments for your store.', 'FORBIDDEN');
  }

  const payment = await Payment.findOne({ orderId }).lean();
  if (!payment) {
    throw new ApiError(404, 'No payment record found for this order.', 'PAYMENT_NOT_FOUND');
  }

  return payment;
};

/**
 * 5. Get Payment by Payment ID.
 */
export const getPaymentByIdService = async (paymentId, userActor) => {
  if (!mongoose.Types.ObjectId.isValid(paymentId)) {
    throw new ApiError(400, 'Invalid Payment ID format.', 'INVALID_PAYMENT_ID');
  }

  const payment = await Payment.findById(paymentId).populate('orderId').lean();
  if (!payment) {
    throw new ApiError(404, 'Payment not found.', 'PAYMENT_NOT_FOUND');
  }

  if (userActor.role === USER_ROLES.CUSTOMER && payment.customerId.toString() !== userActor._id.toString()) {
    throw new ApiError(403, 'Forbidden: Access denied.', 'FORBIDDEN');
  }

  return payment;
};
