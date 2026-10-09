import mongoose from 'mongoose';
import { Store } from '../models/store.model.js';
import { User, USER_ROLES, VERIFICATION_STATUS } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import {
  notifySellerStoreApproved,
  notifySellerStoreRejected,
} from './notification.service.js';

/**
 * Helper to verify that a SELLER owns the target store, or requester is ADMIN.
 */
const assertStoreOwnershipOrAdmin = (store, requesterUser) => {
  if (!requesterUser) {
    throw new ApiError(401, 'Authentication required.', 'UNAUTHORIZED');
  }

  if (requesterUser.role === USER_ROLES.ADMIN) {
    return true;
  }

  if (
    requesterUser.role === USER_ROLES.SELLER &&
    store.ownerId.toString() === requesterUser._id.toString()
  ) {
    return true;
  }

  throw new ApiError(
    403,
    'Forbidden: Sellers can only access and manage their own store.',
    'FORBIDDEN_STORE_ACCESS'
  );
};

/**
 * Create a new Store for the authenticated Seller.
 * Rule: 1 Seller -> 1 Store. Initial verificationStatus matches Seller verificationStatus (PENDING).
 */
export const createStoreService = async (sellerUser, payload) => {
  const existingStore = await Store.findOne({ ownerId: sellerUser._id });
  if (existingStore) {
    if (payload.storeName) existingStore.storeName = payload.storeName;
    if (payload.description !== undefined) existingStore.description = payload.description;
    if (payload.contactPhone) existingStore.contactPhone = payload.contactPhone;
    if (payload.contactEmail) existingStore.contactEmail = payload.contactEmail;
    if (payload.address) existingStore.address = payload.address;
    if (typeof payload.latitude === 'number') existingStore.latitude = payload.latitude;
    if (typeof payload.longitude === 'number') existingStore.longitude = payload.longitude;
    if (typeof payload.latitude === 'number' && typeof payload.longitude === 'number') {
      existingStore.location = {
        type: 'Point',
        coordinates: [payload.longitude, payload.latitude],
      };
    }
    if (payload.fulfillmentModes) existingStore.fulfillmentModes = payload.fulfillmentModes;
    if (payload.deliveryRadiusKm) existingStore.deliveryRadiusKm = payload.deliveryRadiusKm;
    await existingStore.save();
    return existingStore;
  }

  const store = await Store.create({
    ownerId: sellerUser._id,
    storeName: payload.storeName,
    description: payload.description || '',
    contactPhone: payload.contactPhone || sellerUser.phone,
    contactEmail: payload.contactEmail || sellerUser.email,
    businessDetails: {
      businessLicenseNumber:
        payload.businessDetails?.businessLicenseNumber ||
        sellerUser.sellerProfile?.businessLicenseNumber ||
        null,
      gstNumber:
        payload.businessDetails?.gstNumber || sellerUser.sellerProfile?.gstNumber || null,
      fssaiLicenseNumber:
        payload.businessDetails?.fssaiLicenseNumber ||
        sellerUser.sellerProfile?.fssaiLicenseNumber ||
        null,
      cosmeticLicenseNumber:
        payload.businessDetails?.cosmeticLicenseNumber ||
        sellerUser.sellerProfile?.cosmeticLicenseNumber ||
        null,
    },
    address: payload.address,
    latitude: payload.latitude,
    longitude: payload.longitude,
    status: payload.status || 'OPEN',
    verificationStatus:
      sellerUser.verificationStatus === VERIFICATION_STATUS.APPROVED
        ? VERIFICATION_STATUS.APPROVED
        : VERIFICATION_STATUS.PENDING,
    fulfillmentModes: payload.fulfillmentModes || ['PICKUP', 'LOCAL_DELIVERY'],
    deliveryRadiusKm: payload.deliveryRadiusKm || 10,
  });

  // Synchronize Seller embedded profile with Store coordinates and address
  await User.findByIdAndUpdate(sellerUser._id, {
    $set: {
      'sellerProfile.storeName': store.storeName,
      'sellerProfile.address': store.address,
      'sellerProfile.location': store.location,
    },
  });

  return store;
};

/**
 * Retrieve the authenticated Seller's own store.
 */
export const getMyStoreService = async (sellerUserId) => {
  const store = await Store.findOne({ ownerId: sellerUserId }).populate(
    'ownerId',
    'name email phone role verificationStatus'
  );

  if (!store) {
    throw new ApiError(
      404,
      'No store found for your seller account. Please create your store first.',
      'STORE_NOT_FOUND'
    );
  }

  return store;
};

/**
 * Update store details (Address, Latitude, Longitude, Name, Status, etc.).
 * Enforces: Seller can only update their own store; Admin can update any store.
 */
export const updateStoreService = async (storeId, requesterUser, payload) => {
  const store = await Store.findById(storeId);
  if (!store) {
    throw new ApiError(404, 'Store not found.', 'STORE_NOT_FOUND');
  }

  assertStoreOwnershipOrAdmin(store, requesterUser);

  if (payload.storeName !== undefined) store.storeName = payload.storeName;
  if (payload.description !== undefined) store.description = payload.description;
  if (payload.contactPhone !== undefined) store.contactPhone = payload.contactPhone;
  if (payload.contactEmail !== undefined) store.contactEmail = payload.contactEmail;
  if (payload.status !== undefined) store.status = payload.status;
  if (payload.isActive !== undefined) store.isActive = payload.isActive;
  if (payload.fulfillmentModes !== undefined) store.fulfillmentModes = payload.fulfillmentModes;
  if (payload.deliveryRadiusKm !== undefined) store.deliveryRadiusKm = payload.deliveryRadiusKm;

  if (payload.businessDetails) {
    store.businessDetails = {
      ...store.businessDetails.toObject(),
      ...payload.businessDetails,
    };
  }

  if (payload.address) {
    store.address = {
      ...store.address.toObject(),
      ...payload.address,
    };
  }

  if (typeof payload.latitude === 'number') {
    store.latitude = payload.latitude;
  }
  if (typeof payload.longitude === 'number') {
    store.longitude = payload.longitude;
  }

  await store.save();
  return store;
};

/**
 * Update Store by Seller's own user ID (for PUT/PATCH /api/v1/stores/my-store).
 */
export const updateMyStoreService = async (sellerUser, payload) => {
  const store = await Store.findOne({ ownerId: sellerUser._id });
  if (!store) {
    throw new ApiError(404, 'You do not have a store yet. Create one first.', 'STORE_NOT_FOUND');
  }
  return updateStoreService(store._id, sellerUser, payload);
};

/**
 * Customers / Public: View approved & active stores (supports hyperlocal lat/lng/radiusKm query).
 */
export const listApprovedStoresService = async (query = {}) => {
  const { city, search, latitude, longitude, radiusKm = 25 } = query;

  // Geospatial search if latitude & longitude are supplied
  if (latitude !== undefined && longitude !== undefined) {
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    const maxDistanceMeters = parseFloat(radiusKm) * 1000;

    const geoMatch = {
      verificationStatus: VERIFICATION_STATUS.APPROVED,
      isActive: true,
      ...(city && { 'address.city': new RegExp(city, 'i') }),
      ...(search && { storeName: new RegExp(search, 'i') }),
    };

    const stores = await Store.aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [lng, lat] },
          distanceField: 'distanceMeters',
          maxDistance: maxDistanceMeters,
          query: geoMatch,
          spherical: true,
        },
      },
      {
        $addFields: {
          distanceKm: { $round: [{ $divide: ['$distanceMeters', 1000] }, 2] },
        },
      },
    ]);

    return stores;
  }

  const filter = {
    verificationStatus: VERIFICATION_STATUS.APPROVED,
    isActive: true,
    ...(city && { 'address.city': new RegExp(city, 'i') }),
    ...(search && { storeName: new RegExp(search, 'i') }),
  };

  return Store.find(filter).sort({ createdAt: -1 });
};

/**
 * Get Store by ID with strict role-based visibility rules:
 * - ADMIN: can view any store
 * - SELLER: can view their own store (even if PENDING/REJECTED); if accessing another Seller's store -> 403 Forbidden
 * - CUSTOMER / Guest: can ONLY view stores where verificationStatus === 'APPROVED' and isActive === true
 */
export const getStoreByIdService = async (storeId, requesterUser = null) => {
  if (!mongoose.Types.ObjectId.isValid(storeId)) {
    throw new ApiError(400, 'Invalid store ID format.', 'INVALID_STORE_ID');
  }

  const store = await Store.findById(storeId).populate(
    'ownerId',
    'name email phone role verificationStatus'
  );

  if (!store) {
    throw new ApiError(404, 'Store not found.', 'STORE_NOT_FOUND');
  }

  // 1. ADMIN can view all stores
  if (requesterUser && requesterUser.role === USER_ROLES.ADMIN) {
    return store;
  }

  // 2. SELLER can only access their own store
  if (requesterUser && requesterUser.role === USER_ROLES.SELLER) {
    const ownerIdStr = store.ownerId._id
      ? store.ownerId._id.toString()
      : store.ownerId.toString();
    if (ownerIdStr !== requesterUser._id.toString()) {
      throw new ApiError(
        403,
        'Forbidden: Sellers can only access their own store.',
        'FORBIDDEN_STORE_ACCESS'
      );
    }
    return store;
  }

  // 3. CUSTOMER or unauthenticated user can ONLY view APPROVED and active stores
  if (store.verificationStatus !== VERIFICATION_STATUS.APPROVED || !store.isActive) {
    throw new ApiError(
      404,
      'Store is not available or is pending admin verification.',
      'STORE_NOT_APPROVED'
    );
  }

  return store;
};

/**
 * Admin: List all stores across the platform with optional status/verification filters.
 */
export const listAllStoresForAdminService = async (query = {}) => {
  const { verificationStatus, status, city } = query;
  const filter = {
    ...(verificationStatus && { verificationStatus }),
    ...(status && { status }),
    ...(city && { 'address.city': new RegExp(city, 'i') }),
  };

  return Store.find(filter)
    .populate('ownerId', 'name email phone role verificationStatus')
    .sort({ createdAt: -1 });
};

/**
 * Admin: Verify (Approve / Reject / Suspend) a Store and synchronize its Seller's verificationStatus.
 */
export const verifyStoreByAdminService = async (storeId, adminUser, { verificationStatus, rejectionReason }) => {
  const store = await Store.findById(storeId);
  if (!store) {
    throw new ApiError(404, 'Store not found.', 'STORE_NOT_FOUND');
  }

  store.verificationStatus = verificationStatus;
  store.verificationAudit = {
    reviewedBy: adminUser._id,
    reviewedAt: new Date(),
    rejectionReason:
      verificationStatus === VERIFICATION_STATUS.REJECTED ||
      verificationStatus === VERIFICATION_STATUS.SUSPENDED
        ? rejectionReason || 'Policy / KYC requirement not met'
        : null,
  };

  await store.save();

  // Synchronize owning Seller User account verificationStatus
  await User.findByIdAndUpdate(store.ownerId, {
    $set: {
      verificationStatus,
      'sellerProfile.reviewedBy': adminUser._id,
      'sellerProfile.reviewedAt': new Date(),
      'sellerProfile.rejectionReason': store.verificationAudit.rejectionReason,
    },
  });

  // Dispatch seller notification
  const storeName = store.storeName || 'Your Store';
  if (verificationStatus === VERIFICATION_STATUS.APPROVED) {
    await notifySellerStoreApproved({
      sellerId: store.ownerId,
      storeName,
    }).catch((err) => {
      console.error('[StoreService] Store approval notification failed:', err.message);
    });
  } else if (verificationStatus === VERIFICATION_STATUS.REJECTED) {
    await notifySellerStoreRejected({
      sellerId: store.ownerId,
      storeName,
      rejectionReason,
    }).catch((err) => {
      console.error('[StoreService] Store rejection notification failed:', err.message);
    });
  }

  return store;
};

/**
 * Helper to ensure a Seller has a Store document provisioned.
 * Prevents 404 STORE_NOT_FOUND when sellers access dashboard/inventory.
 */
export const ensureSellerStore = async (sellerUser) => {
  if (!sellerUser || sellerUser.role !== USER_ROLES.SELLER) return null;
  let store = await Store.findOne({ ownerId: sellerUser._id });
  if (!store) {
    const coordinates = sellerUser.sellerProfile?.location?.coordinates || [77.5946, 12.9716];
    const storeName = sellerUser.sellerProfile?.storeName || `${sellerUser.name}'s Store`;
    const slug = storeName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') + '-' + Math.floor(Math.random() * 10000);

    store = await Store.create({
      ownerId: sellerUser._id,
      storeName: storeName,
      slug,
      description: 'Neighborhood Supermarket Partner',
      contactPhone: sellerUser.phone || '9999999999',
      contactEmail: sellerUser.email,
      businessDetails: {
        businessLicenseNumber: sellerUser.sellerProfile?.businessLicenseNumber || null,
        gstNumber: sellerUser.sellerProfile?.gstNumber || null,
        fssaiLicenseNumber: sellerUser.sellerProfile?.fssaiLicenseNumber || null,
        cosmeticLicenseNumber: sellerUser.sellerProfile?.cosmeticLicenseNumber || null,
      },
      address: {
        street: sellerUser.sellerProfile?.address?.street || 'Retail Market Road',
        city: sellerUser.sellerProfile?.address?.city || 'Bangalore',
        state: sellerUser.sellerProfile?.address?.state || 'Karnataka',
        pincode: sellerUser.sellerProfile?.address?.pincode || '560001',
      },
      latitude: coordinates[1] || 12.9716,
      longitude: coordinates[0] || 77.5946,
      location: {
        type: 'Point',
        coordinates,
      },
      status: 'OPEN',
      verificationStatus: sellerUser.verificationStatus || VERIFICATION_STATUS.APPROVED,
      isActive: true,
      fulfillmentModes: ['PICKUP', 'LOCAL_DELIVERY'],
      deliveryRadiusKm: 10,
    });
  }
  return store;
};
