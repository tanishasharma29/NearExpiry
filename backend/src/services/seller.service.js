import { User, USER_ROLES } from '../models/user.model.js';
import { Store } from '../models/store.model.js';
import { ApiError } from '../utils/ApiError.js';

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

  return {
    sellerId: seller._id,
    email: seller.email,
    verificationStatus: effectiveStatus,
    isApproved,
    isRejected,
    isPending: !isApproved && !isRejected && !isSuspended,
    submittedAt: seller.sellerProfile?.submittedAt || seller.createdAt,
    reviewedAt: seller.sellerProfile?.reviewedAt || store?.verificationAudit?.reviewedAt || null,
    rejectionReason:
      seller.sellerProfile?.rejectionReason || store?.verificationAudit?.rejectionReason || null,
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
