import { User, USER_ROLES } from '../models/user.model.js';
import { Store } from '../models/store.model.js';
import { Notification, NOTIFICATION_TYPES } from '../models/notification.model.js';
import { ApiError } from '../utils/ApiError.js';
import { extractDocumentDossier } from '../utils/documentVerification.util.js';
import { emitToAdmin } from '../config/socket.js';
import { SOCKET_EVENTS } from '../constants/socketEvents.js';
import { recordSecurityEvent, SECURITY_EVENT_TYPES } from '../utils/securityAudit.js';

/**
 * Retrieves the authenticated Seller's profile along with their Store (if created).
 */
export const getSellerProfileService = async (sellerUserId) => {
  const seller = await User.findById(sellerUserId);
  if (!seller || seller.role !== USER_ROLES.SELLER) {
    throw new ApiError(404, 'Seller profile not found.', 'SELLER_NOT_FOUND');
  }

  const store = await Store.findOne({ ownerId: seller._id });

  return {
    seller: seller.toSafeObject(),
    store: store || null,
  };
};

/**
 * Updates Seller personal & business profile fields and synchronizes shared fields with Store.
 */
export const updateSellerProfileService = async (sellerUserId, payload) => {
  const seller = await User.findById(sellerUserId);
  if (!seller || seller.role !== USER_ROLES.SELLER) {
    throw new ApiError(404, 'Seller profile not found.', 'SELLER_NOT_FOUND');
  }

  if (payload.name !== undefined) seller.name = payload.name;
  if (payload.phone !== undefined) seller.phone = payload.phone;

  if (!seller.sellerProfile) {
    seller.sellerProfile = {
      storeName: payload.storeName || `${seller.name}'s Store`,
      address: {},
      location: { type: 'Point', coordinates: [77.5946, 12.9716] },
    };
  }

  if (payload.storeName !== undefined) seller.sellerProfile.storeName = payload.storeName;
  if (payload.businessLicenseNumber !== undefined) {
    seller.sellerProfile.businessLicenseNumber = payload.businessLicenseNumber;
  }
  if (payload.gstNumber !== undefined) seller.sellerProfile.gstNumber = payload.gstNumber;
  if (payload.fssaiLicenseNumber !== undefined) {
    seller.sellerProfile.fssaiLicenseNumber = payload.fssaiLicenseNumber;
  }
  if (payload.cosmeticLicenseNumber !== undefined) {
    seller.sellerProfile.cosmeticLicenseNumber = payload.cosmeticLicenseNumber;
  }

  if (payload.address) {
    seller.sellerProfile.address = {
      ...seller.sellerProfile.address,
      ...payload.address,
    };
  }

  if (typeof payload.longitude === 'number' && typeof payload.latitude === 'number') {
    seller.sellerProfile.location = {
      type: 'Point',
      coordinates: [payload.longitude, payload.latitude],
    };
  }

  await seller.save();

  // Also synchronize businessDetails on the Store document if one exists
  const store = await Store.findOne({ ownerId: seller._id });
  if (store) {
    if (payload.storeName) store.storeName = payload.storeName;
    if (payload.businessLicenseNumber !== undefined) {
      store.businessDetails.businessLicenseNumber = payload.businessLicenseNumber;
    }
    if (payload.gstNumber !== undefined) {
      store.businessDetails.gstNumber = payload.gstNumber;
    }
    if (payload.fssaiLicenseNumber !== undefined) {
      store.businessDetails.fssaiLicenseNumber = payload.fssaiLicenseNumber;
    }
    if (payload.cosmeticLicenseNumber !== undefined) {
      store.businessDetails.cosmeticLicenseNumber = payload.cosmeticLicenseNumber;
    }
    await store.save();
  }

  return {
    seller: seller.toSafeObject(),
    store: store || null,
  };
};

/**
 * Returns the Seller's verification status, KYC details, and store verification state.
 */
export const getSellerVerificationStatusService = async (sellerUserId) => {
  const seller = await User.findById(sellerUserId);
  if (!seller || seller.role !== USER_ROLES.SELLER) {
    throw new ApiError(404, 'Seller profile not found.', 'SELLER_NOT_FOUND');
  }

  const store = await Store.findOne({ ownerId: seller._id });

  const isRejected =
    seller.verificationStatus === 'REJECTED' || store?.verificationStatus === 'REJECTED';
  const isSuspended =
    seller.verificationStatus === 'SUSPENDED' || store?.verificationStatus === 'SUSPENDED';
  const isApproved =
    !isRejected &&
    !isSuspended &&
    (seller.verificationStatus === 'APPROVED' || store?.verificationStatus === 'APPROVED');
  const effectiveStatus = isRejected
    ? 'REJECTED'
    : isSuspended
    ? 'SUSPENDED'
    : isApproved
    ? 'APPROVED'
    : seller.verificationStatus || store?.verificationStatus || 'PENDING';

  const documents = extractDocumentDossier(seller, store);
  const isDemoApproved = isApproved && !documents.allDocumentsVerified;

  return {
    sellerId: seller._id,
    email: seller.email,
    verificationStatus: effectiveStatus,
    storeStatus: effectiveStatus,
    isApproved,
    isDemoApproved,
    isRejected,
    isPending: !isApproved && !isRejected && !isSuspended,
    submittedAt: seller.sellerProfile?.submittedAt || seller.createdAt,
    reviewedAt: seller.sellerProfile?.reviewedAt || store?.verificationAudit?.reviewedAt || null,
    rejectionReason:
      seller.sellerProfile?.rejectionReason || store?.verificationAudit?.rejectionReason || null,
    documents,
    store: store
      ? {
          storeId: store._id,
          storeName: store.storeName,
          verificationStatus: store.verificationStatus,
          status: store.status,
          isActive: store.isActive,
        }
      : null,
  };
};

/**
 * Handles seller support inquiries regarding demo approval & legal document verification.
 */
export const createSellerSupportRequestService = async (sellerUserId, payload) => {
  const seller = await User.findById(sellerUserId);
  if (!seller || seller.role !== USER_ROLES.SELLER) {
    throw new ApiError(404, 'Seller profile not found.', 'SELLER_NOT_FOUND');
  }

  const store = await Store.findOne({ ownerId: seller._id });
  const storeName = store?.storeName || seller.sellerProfile?.storeName || 'Merchant Store';
  const ticketRef = `TKT-${Date.now().toString().slice(-6)}`;

  // Find an admin user to assign / notify
  const adminUser = await User.findOne({ role: USER_ROLES.ADMIN, isActive: true });
  if (adminUser) {
    await Notification.create({
      recipient: adminUser._id,
      recipientEmail: adminUser.email,
      recipientRole: 'ADMIN',
      type: NOTIFICATION_TYPES.SYSTEM_ALERT,
      title: `[Seller Support] ${payload.subject}`,
      message: `Store "${storeName}" (Seller: ${seller.name}, ${seller.email}) submitted a support request: "${payload.message}". Reference: ${ticketRef}`,
      channel: 'IN_APP',
      entityId: seller._id,
      entityModel: 'User',
      actionUrl: `/admin/sellers?sellerId=${seller._id}`,
    }).catch((err) => {
      console.warn('[SellerService] Failed to create admin notification for support request:', err.message);
    });
  }

  // Real-time alert to admins
  try {
    emitToAdmin(SOCKET_EVENTS.ADMIN_ALERT, {
      alertType: 'SELLER_SUPPORT_REQUEST',
      title: `Seller Support Request: ${payload.subject}`,
      message: `Merchant "${storeName}" submitted a support request regarding store verification.`,
      severity: 'INFO',
      entityId: seller._id,
      timestamp: new Date().toISOString(),
    });
  } catch (sockErr) {
    console.warn('[Socket.IO] Error emitting support request to admin:', sockErr.message);
  }

  return {
    ticketId: ticketRef,
    storeName,
    subject: payload.subject,
    submittedAt: new Date(),
    status: 'SUBMITTED',
    message: 'Your support request has been submitted to NearExpiry platform administrators. We will contact you regarding document verification.',
  };
};
