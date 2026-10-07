import mongoose from 'mongoose';
import qrcode from 'qrcode';
import { QrVerification, QR_TYPE, QR_STATUS } from '../models/qrVerification.model.js';
import { Batch, BATCH_STATUS } from '../models/batch.model.js';
import { Product } from '../models/product.model.js';
import { Store } from '../models/store.model.js';
import { Order, ORDER_STATUS, FULFILLMENT_TYPES } from '../models/order.model.js';
import { USER_ROLES } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import {
  generateSecureQrToken,
  verifySecureQrToken,
  generatePickupQrToken,
  verifyPickupQrToken,
} from '../utils/qrToken.js';
import { toCalendarDayEpochUTC } from '../utils/shelfLife.js';
import { generateBillReceiptService } from './billing.service.js';

/**
 * 1. Generate Secure QR Token & QR Code for a physical Batch.
 * Accessible by the owning Seller or Admin.
 */
export const generateBatchQrService = async (batchId, userActor) => {
  if (!mongoose.Types.ObjectId.isValid(batchId)) {
    throw new ApiError(400, 'Invalid batch ID format.', 'INVALID_BATCH_ID');
  }

  const batch = await Batch.findById(batchId)
    .populate('productId', 'name brand unit')
    .populate('storeId', 'storeName ownerId');

  if (!batch) {
    throw new ApiError(404, 'Batch lot not found.', 'BATCH_NOT_FOUND');
  }

  // Authorization Check
  if (userActor.role === USER_ROLES.SELLER) {
    if (batch.storeId.ownerId?.toString() !== userActor._id.toString()) {
      throw new ApiError(403, 'Forbidden: You can only generate QR codes for your own store lots.', 'FORBIDDEN');
    }
  }

  // Generate cryptographic token
  const { token, nonce, tokenHash } = generateSecureQrToken(batch._id);

  // Upsert active QR verification document in MongoDB
  const qrRecord = await QrVerification.findOneAndUpdate(
    { batchId: batch._id, qrType: QR_TYPE.BATCH },
    {
      $set: {
        qrType: QR_TYPE.BATCH,
        productId: batch.productId._id,
        storeId: batch.storeId._id,
        tokenNonce: nonce,
        tokenHash,
        status: QR_STATUS.ACTIVE,
        revokedAt: null,
        revokedBy: null,
        revokedReason: null,
      },
    },
    { upsert: true, new: true }
  );

  const verificationUrl = `https://nearexpiry.app/verify?token=${token}`;
  const qrDataUrl = await qrcode.toDataURL(token, {
    errorCorrectionLevel: 'H',
    margin: 2,
    scale: 6,
  });

  return {
    batchId: batch._id,
    batchNumber: batch.batchNumber,
    productName: batch.productId?.name,
    storeName: batch.storeId?.storeName,
    expiryDate: batch.expiryDate,
    nonce,
    status: qrRecord.status,
    token,
    qrDataUrl,
    qrCodeDataUrl: qrDataUrl,
    verificationUrl,
    generatedAt: new Date(),
  };
};

/**
 * 2. Get/Retrieve Batch QR (Idempotent GET).
 * Checks if active QR exists and returns it, otherwise creates it.
 */
export const getBatchQrService = async (batchId, userActor) => {
  if (!mongoose.Types.ObjectId.isValid(batchId)) {
    throw new ApiError(400, 'Invalid batch ID format.', 'INVALID_BATCH_ID');
  }

  const batch = await Batch.findById(batchId)
    .populate('productId', 'name brand unit')
    .populate('storeId', 'storeName ownerId');

  if (!batch) {
    throw new ApiError(404, 'Batch lot not found.', 'BATCH_NOT_FOUND');
  }

  // Authorization Check
  if (userActor.role === USER_ROLES.SELLER) {
    if (batch.storeId.ownerId?.toString() !== userActor._id.toString()) {
      throw new ApiError(403, 'Forbidden: You can only view QR codes for your own store lots.', 'FORBIDDEN');
    }
  }

  const existingRecord = await QrVerification.findOne({
    batchId: batch._id,
    qrType: QR_TYPE.BATCH,
    status: QR_STATUS.ACTIVE,
  });

  if (existingRecord && existingRecord.tokenNonce) {
    const { token, nonce } = generateSecureQrToken(batch._id, existingRecord.tokenNonce);
    const verificationUrl = `https://nearexpiry.app/verify?token=${token}`;
    const qrDataUrl = await qrcode.toDataURL(token, {
      errorCorrectionLevel: 'H',
      margin: 2,
      scale: 6,
    });

    return {
      batchId: batch._id,
      batchNumber: batch.batchNumber,
      productName: batch.productId?.name,
      storeName: batch.storeId?.storeName,
      expiryDate: batch.expiryDate,
      nonce,
      status: existingRecord.status,
      token,
      qrDataUrl,
      qrCodeDataUrl: qrDataUrl,
      verificationUrl,
      generatedAt: existingRecord.createdAt || new Date(),
    };
  }

  return generateBatchQrService(batchId, userActor);
};

/**
 * 3. Public / Customer QR Verification Endpoint for physical batch lots.
 */
export const verifyBatchQrService = async (token, auditContext = {}) => {
  const { batchId, tokenNonce, tokenHash } = verifySecureQrToken(token);

  const qrRecord = await QrVerification.findOne({ tokenNonce });
  if (!qrRecord) {
    throw new ApiError(
      404,
      'QR verification token was not recognized in NearExpiry system.',
      'QR_TOKEN_NOT_REGISTERED'
    );
  }

  const { ipAddress = 'unknown', userAgent = 'unknown', userActor = null } = auditContext;

  if (qrRecord.status === QR_STATUS.REVOKED) {
    qrRecord.scanHistory.push({
      scannedAt: new Date(),
      scannedBy: userActor?._id || null,
      ipAddress,
      userAgent,
      result: 'REVOKED',
      verificationStatus: 'REVOKED',
      notes: qrRecord.revokedReason || 'Scanned revoked QR',
    });
    await qrRecord.save();

    const batch = await Batch.findById(qrRecord.batchId).populate('productId', 'brand name').lean();

    return {
      isValid: false,
      verificationStatus: 'REVOKED',
      message: 'This QR code has been revoked by the store or administrator and is no longer valid.',
      revokedAt: qrRecord.revokedAt,
      revokedReason: qrRecord.revokedReason,
      product: batch?.productId ? { name: batch.productId.name } : null,
      brand: batch?.productId?.brand || '',
      batchNumber: batch?.batchNumber || 'UNKNOWN',
    };
  }

  const [batch, product, store] = await Promise.all([
    Batch.findById(qrRecord.batchId).lean(),
    Product.findById(qrRecord.productId).lean(),
    Store.findById(qrRecord.storeId).lean(),
  ]);

  if (!batch || !product || !store) {
    qrRecord.scanHistory.push({
      scannedAt: new Date(),
      scannedBy: userActor?._id || null,
      ipAddress,
      userAgent,
      result: 'NOT_FOUND',
      verificationStatus: 'INVALID',
      notes: 'Underlying batch, product, or store record missing in MongoDB',
    });
    await qrRecord.save();

    throw new ApiError(404, 'Associated batch lot or product no longer exists.', 'RECORD_NOT_FOUND');
  }

  const todayUtc = new Date(toCalendarDayEpochUTC(new Date()));
  const isExpired =
    new Date(batch.expiryDate) < todayUtc ||
    batch.remainingDays < 0 ||
    batch.status === BATCH_STATUS.EXPIRED;

  let verificationStatus = 'GENUINE_ACTIVE';
  if (isExpired) {
    verificationStatus = 'GENUINE_BUT_EXPIRED';
  } else if (batch.status === BATCH_STATUS.CRITICAL || batch.remainingDays <= 2) {
    verificationStatus = 'GENUINE_CRITICAL';
  } else if (batch.status === BATCH_STATUS.APPROACHING_EXPIRY) {
    verificationStatus = 'GENUINE_APPROACHING_EXPIRY';
  }

  qrRecord.scanHistory.push({
    scannedAt: new Date(),
    scannedBy: userActor?._id || null,
    ipAddress,
    userAgent,
    result: 'SUCCESS',
    verificationStatus,
    notes: `Batch verified as ${verificationStatus}`,
  });
  await qrRecord.save();

  return {
    isValid: true,
    verificationStatus,
    product: {
      _id: product._id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      image: product.image,
      unit: product.unit,
      status: product.status,
    },
    brand: product.brand,
    batchNumber: batch.batchNumber,
    store: {
      _id: store._id,
      storeName: store.storeName,
      slug: store.slug,
      address: store.address,
      contactPhone: store.contactPhone,
      verificationStatus: store.verificationStatus,
    },
    expiryDate: batch.expiryDate,
    manufacturingDate: batch.manufacturingDate,
    remainingDays: batch.remainingDays,
    isPurchasable: batch.isPurchasable && batch.quantity > 0 && !isExpired,
    currentPrice: batch.currentPrice,
    originalPrice: batch.originalPrice,
    discountPercentage: batch.discountPercentage,
    verifiedAt: new Date(),
  };
};

/**
 * 4. Revoke QR Token for a physical Batch (Seller / Admin).
 */
export const revokeBatchQrService = async (batchId, userActor, reason) => {
  if (!mongoose.Types.ObjectId.isValid(batchId)) {
    throw new ApiError(400, 'Invalid batch ID format.', 'INVALID_BATCH_ID');
  }

  const batch = await Batch.findById(batchId).populate('storeId', 'ownerId');
  if (!batch) {
    throw new ApiError(404, 'Batch lot not found.', 'BATCH_NOT_FOUND');
  }

  if (userActor.role === USER_ROLES.SELLER) {
    if (batch.storeId.ownerId?.toString() !== userActor._id.toString()) {
      throw new ApiError(403, 'Forbidden: You can only revoke QR codes for your store.', 'FORBIDDEN');
    }
  }

  const qrRecord = await QrVerification.findOne({ batchId: batch._id, qrType: QR_TYPE.BATCH });
  if (!qrRecord) {
    throw new ApiError(404, 'No QR verification token found for this batch lot.', 'QR_NOT_FOUND');
  }

  qrRecord.status = QR_STATUS.REVOKED;
  qrRecord.revokedAt = new Date();
  qrRecord.revokedBy = userActor._id;
  qrRecord.revokedReason = reason || 'QR revoked by authorized user';

  await qrRecord.save();

  return {
    batchId: batch._id,
    batchNumber: batch.batchNumber,
    status: QR_STATUS.REVOKED,
    revokedAt: qrRecord.revokedAt,
    revokedReason: qrRecord.revokedReason,
  };
};

/**
 * 5. Scan Audit Log & Verification History (Seller / Admin).
 */
export const getBatchQrAuditLogsService = async (batchId, userActor) => {
  if (!mongoose.Types.ObjectId.isValid(batchId)) {
    throw new ApiError(400, 'Invalid batch ID format.', 'INVALID_BATCH_ID');
  }

  const batch = await Batch.findById(batchId).populate('storeId', 'ownerId');
  if (!batch) {
    throw new ApiError(404, 'Batch lot not found.', 'BATCH_NOT_FOUND');
  }

  if (userActor.role === USER_ROLES.SELLER) {
    if (batch.storeId.ownerId?.toString() !== userActor._id.toString()) {
      throw new ApiError(403, 'Forbidden: Access denied.', 'FORBIDDEN');
    }
  }

  const qrRecord = await QrVerification.findOne({ batchId: batch._id, qrType: QR_TYPE.BATCH })
    .populate('scanHistory.scannedBy', 'name email role')
    .lean();

  if (!qrRecord) {
    return {
      batchId: batch._id,
      batchNumber: batch.batchNumber,
      status: 'NOT_GENERATED',
      totalScans: 0,
      scanHistory: [],
    };
  }

  return {
    batchId: batch._id,
    batchNumber: batch.batchNumber,
    status: qrRecord.status,
    revokedAt: qrRecord.revokedAt,
    revokedReason: qrRecord.revokedReason,
    totalScans: qrRecord.scanHistory.length,
    scanHistory: qrRecord.scanHistory.reverse(),
  };
};

/**
 * =========================================================================
 * 6. CUSTOMER SELF-PICKUP QR SERVICES
 * =========================================================================
 */

/**
 * Generate or Retrieve a Secure Pickup QR for a Customer's Order.
 * Accessible only by the owning Customer or Admin.
 */
export const generatePickupQrService = async (orderId, userActor) => {
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    throw new ApiError(400, 'Invalid Order ID format.', 'INVALID_ORDER_ID');
  }

  const order = await Order.findById(orderId)
    .populate('storeId', 'storeName slug address contactPhone')
    .populate('customerId', 'name email phone');

  if (!order) {
    throw new ApiError(404, 'Pickup order could not be found.', 'ORDER_NOT_FOUND');
  }

  // Authorization Check: Customer can only view/generate for their own order
  if (userActor.role === USER_ROLES.CUSTOMER) {
    if (order.customerId._id.toString() !== userActor._id.toString()) {
      throw new ApiError(403, 'Forbidden: You can only view QR codes for your own orders.', 'FORBIDDEN');
    }
  }

  // Business Validation: Must be SELF_PICKUP order
  if (order.fulfillmentType !== FULFILLMENT_TYPES.PICKUP) {
    throw new ApiError(400, 'This order is not a self-pickup order.', 'NOT_PICKUP_ORDER');
  }

  // Status Validation
  if (order.status === ORDER_STATUS.CANCELLED) {
    throw new ApiError(400, 'This order has been cancelled and cannot be picked up.', 'ORDER_CANCELLED');
  }

  if (order.status === ORDER_STATUS.DELIVERED) {
    throw new ApiError(400, 'This order has already been completed.', 'ORDER_ALREADY_COMPLETED');
  }

  // Check if an existing ACTIVE and UNEXPIRED Pickup QR document exists
  let qrRecord = await QrVerification.findOne({
    orderId: order._id,
    qrType: QR_TYPE.PICKUP,
    status: QR_STATUS.ACTIVE,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
  });

  let tokenToUse;
  if (qrRecord) {
    // Regenerate signed token matching stored nonce & claims
    const pickupTokenData = generatePickupQrToken(
      order._id,
      order.customerId._id,
      order.storeId._id,
      48
    );
    // Reuse token or update hash
    tokenToUse = pickupTokenData.token;
    qrRecord.tokenHash = pickupTokenData.tokenHash;
    qrRecord.tokenNonce = pickupTokenData.nonce;
    qrRecord.expiresAt = pickupTokenData.expiresAt;
    await qrRecord.save();
  } else {
    // Generate new Pickup Token
    const pickupTokenData = generatePickupQrToken(
      order._id,
      order.customerId._id,
      order.storeId._id,
      48
    );
    tokenToUse = pickupTokenData.token;

    qrRecord = await QrVerification.create({
      qrType: QR_TYPE.PICKUP,
      orderId: order._id,
      customerId: order.customerId._id,
      storeId: order.storeId._id,
      tokenNonce: pickupTokenData.nonce,
      tokenHash: pickupTokenData.tokenHash,
      status: QR_STATUS.ACTIVE,
      expiresAt: pickupTokenData.expiresAt,
      generatedAt: pickupTokenData.generatedAt,
    });
  }

  const qrDataUrl = await qrcode.toDataURL(tokenToUse, {
    errorCorrectionLevel: 'H',
    margin: 2,
    scale: 6,
  });

  return {
    orderId: order._id,
    orderNumber: order.orderNumber,
    fulfillmentType: order.fulfillmentType,
    orderStatus: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    store: {
      _id: order.storeId._id,
      storeName: order.storeId.storeName,
      address: order.storeId.address,
      contactPhone: order.storeId.contactPhone,
    },
    token: tokenToUse,
    qrDataUrl,
    qrCodeDataUrl: qrDataUrl,
    status: qrRecord.status,
    expiresAt: qrRecord.expiresAt,
    generatedAt: qrRecord.generatedAt,
  };
};

/**
 * =========================================================================
 * 7. SELLER PICKUP VERIFICATION SERVICE
 * =========================================================================
 *
 * Verifies a customer's self-pickup QR token at the neighborhood store.
 * ENFORCES:
 * 1. Cryptographic HMAC token authenticity & expiry.
 * 2. Order exists, is SELF_PICKUP, and belongs to scanning seller's store.
 * 3. Payment satisfied (either PAID online or CASH_ON_DELIVERY marked paid).
 * 4. Atomic concurrency guard (findOneAndUpdate with status: ACTIVE) preventing double scanning.
 * 5. Order state machine advance: READY_FOR_PICKUP -> DELIVERED.
 * 6. Audit logging in QrVerification.scanHistory.
 */
export const verifyPickupQrService = async (token, sellerUser, auditContext = {}) => {
  // Step 1: Decode & Verify HMAC Signature
  const tokenPayload = verifyPickupQrToken(token);

  // Step 2: Query QrVerification Record in MongoDB
  const qrRecord = await QrVerification.findOne({ tokenHash: tokenPayload.tokenHash });
  if (!qrRecord || qrRecord.qrType !== QR_TYPE.PICKUP) {
    throw new ApiError(400, 'Invalid pickup QR.', 'INVALID_PICKUP_QR');
  }

  const { ipAddress = '127.0.0.1', userAgent = 'unknown' } = auditContext;

  // Step 3: Check QR Status
  if (qrRecord.status === QR_STATUS.USED) {
    throw new ApiError(400, 'This pickup QR has already been used.', 'ALREADY_USED');
  }

  if (qrRecord.status === QR_STATUS.REVOKED) {
    throw new ApiError(400, 'This pickup QR has been revoked.', 'REVOKED_QR');
  }

  if (qrRecord.status === QR_STATUS.EXPIRED || (qrRecord.expiresAt && qrRecord.expiresAt < new Date())) {
    throw new ApiError(400, 'This pickup QR has expired.', 'EXPIRED_QR');
  }

  // Step 4: Seller & Store Authorization
  let sellerStore = null;
  if (sellerUser.role === USER_ROLES.SELLER) {
    sellerStore = await Store.findOne({ ownerId: sellerUser._id });
    if (!sellerStore) {
      throw new ApiError(404, 'Store not found for this seller.', 'STORE_NOT_FOUND');
    }

    if (qrRecord.storeId.toString() !== sellerStore._id.toString()) {
      qrRecord.scanHistory.push({
        scannedAt: new Date(),
        scannedBy: sellerUser._id,
        ipAddress,
        userAgent,
        result: 'STORE_MISMATCH',
        verificationStatus: 'REJECTED',
        notes: `QR belongs to store [${qrRecord.storeId}] but scanned by store [${sellerStore._id}]`,
      });
      await qrRecord.save();
      throw new ApiError(403, 'This QR belongs to a different store.', 'STORE_MISMATCH');
    }
  }

  // Step 5: Query and Validate the Associated Order
  const order = await Order.findById(qrRecord.orderId)
    .populate('customerId', 'name email phone')
    .populate('storeId', 'storeName slug address contactPhone');

  if (!order) {
    throw new ApiError(404, 'Pickup order could not be found.', 'ORDER_NOT_FOUND');
  }

  if (order.fulfillmentType !== FULFILLMENT_TYPES.PICKUP) {
    throw new ApiError(400, 'This order is not a self-pickup order.', 'NOT_PICKUP_ORDER');
  }

  if (order.status === ORDER_STATUS.DELIVERED) {
    throw new ApiError(400, 'This order has already been completed.', 'ORDER_ALREADY_COMPLETED');
  }

  if (order.status === ORDER_STATUS.CANCELLED) {
    throw new ApiError(400, 'This order has been cancelled and cannot be picked up.', 'ORDER_CANCELLED');
  }

  // Order readiness check
  if (
    order.status !== ORDER_STATUS.READY_FOR_PICKUP &&
    order.status !== ORDER_STATUS.PACKED &&
    order.status !== ORDER_STATUS.CONFIRMED &&
    order.status !== ORDER_STATUS.PLACED
  ) {
    throw new ApiError(400, 'This order is not ready for pickup yet.', 'ORDER_NOT_READY');
  }

  // Payment condition check
  if (order.paymentStatus !== 'PAID' && order.paymentMethod !== 'CASH_ON_DELIVERY') {
    throw new ApiError(400, 'Payment verification required before pickup.', 'PAYMENT_REQUIRED');
  }

  // Step 6: Atomic Concurrency Update (Double-scan protection)
  const now = new Date();
  const updatedQr = await QrVerification.findOneAndUpdate(
    {
      _id: qrRecord._id,
      status: QR_STATUS.ACTIVE,
    },
    {
      $set: {
        status: QR_STATUS.USED,
        usedAt: now,
        verifiedAt: now,
        verifiedBy: sellerUser._id,
      },
      $push: {
        scanHistory: {
          scannedAt: now,
          scannedBy: sellerUser._id,
          ipAddress,
          userAgent,
          result: 'SUCCESS',
          verificationStatus: 'VERIFIED_AND_PICKED_UP',
          notes: `Pickup verified by seller ${sellerUser.name || sellerUser.email}`,
        },
      },
    },
    { new: true }
  );

  if (!updatedQr) {
    throw new ApiError(409, 'This pickup QR has already been used.', 'ALREADY_USED');
  }

  // Step 7: Update Order Status to DELIVERED
  order.status = ORDER_STATUS.DELIVERED;
  if (order.paymentMethod === 'CASH_ON_DELIVERY') {
    order.paymentStatus = 'PAID';
  }

  order.statusTimeline.push({
    status: ORDER_STATUS.DELIVERED,
    timestamp: now,
    updatedBy: sellerUser._id,
    updatedByRole: sellerUser.role || 'SELLER',
    note: 'Customer handover completed via cryptographic Pickup QR verification',
  });

  await order.save();

  // Step 7.5: Generate immutable Bill Receipt and email customer automatically
  let billReceipt = null;
  try {
    billReceipt = await generateBillReceiptService(order._id, {
      verifiedBy: sellerUser.name || sellerUser.email,
    });
  } catch (billErr) {
    console.error('[Billing] Failed to generate bill receipt on pickup verification:', billErr.message);
  }

  // Step 8: Return Rich Structured Success Payload
  return {
    success: true,
    message: 'Pickup verified successfully',
    receiptNumber: billReceipt?.receiptNumber || null,
    order: {
      _id: order._id,
      receiptNumber: billReceipt?.receiptNumber || null,
      orderNumber: order.orderNumber,
      status: order.status,
      fulfillmentType: order.fulfillmentType,
      customer: {
        _id: order.customerId?._id,
        name: order.customerId?.name || 'Customer',
        email: order.customerId?.email,
        phone: order.customerId?.phone,
      },
      store: {
        _id: order.storeId?._id,
        storeName: order.storeId?.storeName || 'Store',
      },
      itemsCount: order.items?.length || 0,
      totalAmount: order.pricingSummary?.finalTotal,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      verifiedAt: now,
      verifiedBy: sellerUser.name || sellerUser.email,
      items: order.items?.map((it) => ({
        productName: it.productName,
        brand: it.brand,
        quantity: it.requestedQuantity,
        lineTotal: it.lineDiscountedAmount,
        allocatedBatches: it.batchAllocations?.map((b) => ({
          batchNumber: b.batchNumber,
          quantity: b.allocatedQuantity,
          expiryDate: b.expiryDate,
        })),
      })),
    },
  };
};
