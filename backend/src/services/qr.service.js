import mongoose from 'mongoose';
import qrcode from 'qrcode';
import { QrVerification, QR_STATUS } from '../models/qrVerification.model.js';
import { Batch, BATCH_STATUS } from '../models/batch.model.js';
import { Product } from '../models/product.model.js';
import { Store } from '../models/store.model.js';
import { USER_ROLES } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import { generateSecureQrToken, verifySecureQrToken } from '../utils/qrToken.js';
import { toCalendarDayEpochUTC } from '../utils/shelfLife.js';

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
    { batchId: batch._id },
    {
      $set: {
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

  // Generate Data URL QR code
  // The QR contains only the secure verification URL/token (NEVER direct unverified expiry claims)
  const verificationUrl = `https://nearexpiry.app/verify?token=${token}`;
  const qrDataUrl = await qrcode.toDataURL(token, {
    errorCorrectionLevel: 'H',
    margin: 2,
    scale: 6,
  });

  return {
    batchId: batch._id,
    batchNumber: batch.batchNumber,
    productName: batch.productId.name,
    storeName: batch.storeId.storeName,
    status: qrRecord.status,
    token,
    qrDataUrl,
    verificationUrl,
    generatedAt: new Date(),
  };
};

/**
 * 2. Public / Customer QR Verification Endpoint.
 *
 * CRITICAL SECURITY INVARIANT:
 * - Expiry date is NEVER trusted from QR payload or client input.
 * - Decodes secure token -> verifies cryptographic HMAC signature.
 * - Looks up official MongoDB records for the live source of truth.
 * - Checks revocation state.
 * - Records audit log entry in MongoDB scan history.
 * - Returns product, brand, batch number, store, live expiry date, and verification status.
 */
export const verifyBatchQrService = async (token, auditContext = {}) => {
  // Step 1: Cryptographic signature verification
  const { batchId, tokenNonce, tokenHash } = verifySecureQrToken(token);

  // Step 2: Query official QR record in MongoDB
  const qrRecord = await QrVerification.findOne({ tokenNonce });
  if (!qrRecord) {
    throw new ApiError(
      404,
      'QR verification token was not recognized in NearExpiry system.',
      'QR_TOKEN_NOT_REGISTERED'
    );
  }

  const { ipAddress = 'unknown', userAgent = 'unknown', userActor = null } = auditContext;

  // Step 3: Handle Revoked QR
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

  // Step 4: Query MongoDB Source of Truth for Batch, Product, and Store
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

  // Step 5: Derive true live verification status from MongoDB source of truth
  const todayUtc = new Date(toCalendarDayEpochUTC(new Date()));
  const isExpired = new Date(batch.expiryDate) < todayUtc || batch.remainingDays < 0 || batch.status === BATCH_STATUS.EXPIRED;

  let verificationStatus = 'GENUINE_ACTIVE';
  if (isExpired) {
    verificationStatus = 'GENUINE_BUT_EXPIRED';
  } else if (batch.status === BATCH_STATUS.CRITICAL || batch.remainingDays <= 2) {
    verificationStatus = 'GENUINE_CRITICAL';
  } else if (batch.status === BATCH_STATUS.APPROACHING_EXPIRY) {
    verificationStatus = 'GENUINE_APPROACHING_EXPIRY';
  }

  // Step 6: Record Audit Log
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

  // Step 7: Return Verified Payload
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
    expiryDate: batch.expiryDate, // Official date from MongoDB
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
 * 3. Revoke QR Token for a physical Batch (Seller / Admin).
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

  const qrRecord = await QrVerification.findOne({ batchId: batch._id });
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
 * 4. Scan Audit Log & Verification History (Seller / Admin).
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

  const qrRecord = await QrVerification.findOne({ batchId: batch._id })
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
