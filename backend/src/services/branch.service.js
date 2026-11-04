import mongoose from 'mongoose';
import { Branch } from '../models/branch.model.js';
import { Store } from '../models/store.model.js';
import { Batch, BATCH_STATUS } from '../models/batch.model.js';
import { USER_ROLES } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import { toCalendarDayEpochUTC } from '../utils/shelfLife.js';

/**
 * Ensures a store has at least one active Primary Branch.
 * If zero branches exist (e.g. legacy single-store sellers), automatically synthesizes
 * and persists a primary branch from the store's primary address.
 *
 * @param {Object} store - Mongoose store document or lean object
 * @returns {Promise<Object>} The primary branch document
 */
export const ensureDefaultBranchForStore = async (store) => {
  if (!store || !store._id) return null;

  let primaryBranch = await Branch.findOne({ storeId: store._id, isPrimary: true });
  if (primaryBranch) return primaryBranch;

  // Check if any branch exists at all
  const existingBranch = await Branch.findOne({ storeId: store._id });
  if (existingBranch) {
    existingBranch.isPrimary = true;
    await existingBranch.save();
    return existingBranch;
  }

  // Synthesize default primary branch from store profile
  const branchName = store.storeName ? `${store.storeName} (Main)` : 'Main Branch';
  const street = store.address?.street || 'Store Premises';
  const city = store.address?.city || 'Bangalore';
  const state = store.address?.state || 'Karnataka';
  const pincode = store.address?.pincode || '560001';
  const landmark = store.address?.landmark || '';
  const contactPhone = store.contactPhone || '9876543210';
  const contactEmail = store.contactEmail || '';
  const latitude = typeof store.latitude === 'number' ? store.latitude : null;
  const longitude = typeof store.longitude === 'number' ? store.longitude : null;

  primaryBranch = await Branch.create({
    storeId: store._id,
    sellerId: store.ownerId,
    name: branchName,
    address: {
      street,
      locality: '',
      city,
      state,
      pincode,
      landmark,
    },
    contactPhone,
    contactEmail,
    operatingHours: '09:00 AM - 09:00 PM',
    latitude,
    longitude,
    isPrimary: true,
    isActive: true,
  });

  return primaryBranch;
};

/**
 * 1. Get all branches for the authenticated Seller's store.
 */
export const getMyBranchesService = async (sellerUser) => {
  const store = await Store.findOne({ ownerId: sellerUser._id });
  if (!store) {
    throw new ApiError(404, 'Store not found for this seller.', 'STORE_NOT_FOUND');
  }

  // Ensure fallback primary branch exists
  await ensureDefaultBranchForStore(store);

  const branches = await Branch.find({ storeId: store._id })
    .sort({ isPrimary: -1, createdAt: 1 })
    .lean();

  return {
    store: {
      _id: store._id,
      storeName: store.storeName,
      status: store.status,
      verificationStatus: store.verificationStatus,
    },
    branches,
  };
};

/**
 * 2. Get branches of a store (Public or Customer discovery, or Seller/Admin).
 */
export const getStoreBranchesService = async (storeId, userActor, query = {}) => {
  if (!mongoose.Types.ObjectId.isValid(storeId)) {
    throw new ApiError(400, 'Invalid Store ID format.', 'INVALID_STORE_ID');
  }

  const store = await Store.findById(storeId).lean();
  if (!store) {
    throw new ApiError(404, 'Store not found.', 'STORE_NOT_FOUND');
  }

  // Ensure default branch exists
  await ensureDefaultBranchForStore(store);

  const isOwnerOrAdmin =
    userActor &&
    (userActor.role === USER_ROLES.ADMIN ||
      (userActor.role === USER_ROLES.SELLER &&
        store.ownerId?.toString() === userActor._id.toString()));

  const filter = { storeId: store._id };
  if (!isOwnerOrAdmin) {
    filter.isActive = true;
  }

  if (query.pincode) {
    filter['address.pincode'] = query.pincode.trim();
  }
  if (query.city) {
    filter['address.city'] = new RegExp(`^${query.city.trim()}$`, 'i');
  }

  const branches = await Branch.find(filter)
    .sort({ isPrimary: -1, createdAt: 1 })
    .lean();

  return {
    store: {
      _id: store._id,
      storeName: store.storeName,
      status: store.status,
    },
    branches,
  };
};

/**
 * 2.1 Get all active branches across active approved stores for public customer discovery.
 */
export const getActiveBranchesService = async () => {
  const branches = await Branch.find({ isActive: { $ne: false } })
    .populate('storeId', 'storeName isActive verificationStatus')
    .sort({ isPrimary: -1, createdAt: -1 })
    .lean();

  return branches.map((b) => ({
    _id: b._id,
    name: b.name,
    storeId: b.storeId?._id || b.storeId,
    storeName:
      typeof b.storeId === 'object' && b.storeId?.storeName
        ? b.storeId.storeName
        : 'Partner Store',
    address: b.address,
    contactPhone: b.contactPhone,
    operatingHours: b.operatingHours,
    isPrimary: b.isPrimary,
  }));
};

/**
 * 3. Create a new branch for Seller's store.
 */
export const createBranchService = async (sellerUser, payload) => {
  const store = await Store.findOne({ ownerId: sellerUser._id });
  if (!store) {
    throw new ApiError(404, 'Store not found. Please create a store first.', 'STORE_NOT_FOUND');
  }

  const isApproved =
    store.verificationStatus === 'APPROVED' || sellerUser.verificationStatus === 'APPROVED';
  if (!isApproved) {
    throw new ApiError(
      403,
      'Your store application is pending admin approval. Cannot create branches.',
      'SELLER_NOT_APPROVED'
    );
  }

  const existingCount = await Branch.countDocuments({ storeId: store._id });
  let isPrimary = Boolean(payload.isPrimary);

  // If first branch, make it primary automatically
  if (existingCount === 0) {
    isPrimary = true;
  }

  // If new branch is requested as primary, clear primary flag on other branches
  if (isPrimary) {
    await Branch.updateMany({ storeId: store._id }, { $set: { isPrimary: false } });
  }

  const branch = await Branch.create({
    storeId: store._id,
    sellerId: sellerUser._id,
    name: payload.name.trim(),
    address: {
      street: payload.address.street.trim(),
      locality: payload.address.locality ? payload.address.locality.trim() : '',
      city: payload.address.city.trim(),
      state: payload.address.state.trim(),
      pincode: payload.address.pincode.trim(),
      landmark: payload.address.landmark ? payload.address.landmark.trim() : '',
    },
    contactPhone: payload.contactPhone.trim(),
    contactEmail: payload.contactEmail ? payload.contactEmail.trim() : '',
    operatingHours: payload.operatingHours ? payload.operatingHours.trim() : '09:00 AM - 09:00 PM',
    latitude: typeof payload.latitude === 'number' ? payload.latitude : null,
    longitude: typeof payload.longitude === 'number' ? payload.longitude : null,
    isPrimary,
    isActive: true,
  });

  return branch;
};

/**
 * 4. Update an existing branch (Seller or Admin).
 */
export const updateBranchService = async (branchId, userActor, payload) => {
  if (!mongoose.Types.ObjectId.isValid(branchId)) {
    throw new ApiError(400, 'Invalid Branch ID format.', 'INVALID_BRANCH_ID');
  }

  const branch = await Branch.findById(branchId);
  if (!branch) {
    throw new ApiError(404, 'Branch not found.', 'BRANCH_NOT_FOUND');
  }

  // Ownership Check
  if (userActor.role === USER_ROLES.SELLER) {
    if (branch.sellerId.toString() !== userActor._id.toString()) {
      throw new ApiError(403, 'Forbidden: You can only update your own store branches.', 'FORBIDDEN');
    }
  }

  if (payload.isPrimary === true && !branch.isPrimary) {
    await Branch.updateMany(
      { storeId: branch.storeId, _id: { $ne: branch._id } },
      { $set: { isPrimary: false } }
    );
    branch.isPrimary = true;
  } else if (payload.isPrimary === false && branch.isPrimary) {
    // Check if another active branch exists before allowing unsetting primary
    const otherBranch = await Branch.findOne({
      storeId: branch.storeId,
      _id: { $ne: branch._id },
      isActive: true,
    });
    if (otherBranch) {
      otherBranch.isPrimary = true;
      await otherBranch.save();
      branch.isPrimary = false;
    }
  }

  if (payload.name) branch.name = payload.name.trim();
  if (payload.contactPhone) branch.contactPhone = payload.contactPhone.trim();
  if (payload.contactEmail !== undefined) branch.contactEmail = payload.contactEmail.trim();
  if (payload.operatingHours) branch.operatingHours = payload.operatingHours.trim();

  if (payload.address) {
    if (payload.address.street) branch.address.street = payload.address.street.trim();
    if (payload.address.locality !== undefined) branch.address.locality = payload.address.locality.trim();
    if (payload.address.city) branch.address.city = payload.address.city.trim();
    if (payload.address.state) branch.address.state = payload.address.state.trim();
    if (payload.address.pincode) branch.address.pincode = payload.address.pincode.trim();
    if (payload.address.landmark !== undefined) branch.address.landmark = payload.address.landmark.trim();
  }

  if (payload.latitude !== undefined) branch.latitude = payload.latitude;
  if (payload.longitude !== undefined) branch.longitude = payload.longitude;
  if (payload.isActive !== undefined) branch.isActive = payload.isActive;

  await branch.save();
  return branch;
};

/**
 * 5. Toggle active / inactive status of a branch.
 */
export const toggleBranchStatusService = async (branchId, userActor, isActive) => {
  if (!mongoose.Types.ObjectId.isValid(branchId)) {
    throw new ApiError(400, 'Invalid Branch ID format.', 'INVALID_BRANCH_ID');
  }

  const branch = await Branch.findById(branchId);
  if (!branch) {
    throw new ApiError(404, 'Branch not found.', 'BRANCH_NOT_FOUND');
  }

  if (userActor.role === USER_ROLES.SELLER) {
    if (branch.sellerId.toString() !== userActor._id.toString()) {
      throw new ApiError(403, 'Forbidden: You can only modify your own store branches.', 'FORBIDDEN');
    }
  }

  // Deactivation safety check: Cannot deactivate primary branch directly
  if (!isActive && branch.isPrimary) {
    const otherActiveBranchCount = await Branch.countDocuments({
      storeId: branch.storeId,
      _id: { $ne: branch._id },
      isActive: true,
    });
    if (otherActiveBranchCount === 0) {
      throw new ApiError(
        400,
        'Cannot deactivate the primary branch when it is the only active branch for your store. Please activate or register another branch first.',
        'CANNOT_DEACTIVATE_SOLE_PRIMARY_BRANCH'
      );
    }
    throw new ApiError(
      400,
      'Cannot deactivate the primary branch directly. Please designate another active branch as primary first.',
      'CANNOT_DEACTIVATE_PRIMARY_BRANCH'
    );
  }

  branch.isActive = isActive;
  await branch.save();
  return branch;
};

/**
 * 6. Set a branch as primary.
 */
export const setPrimaryBranchService = async (branchId, userActor) => {
  if (!mongoose.Types.ObjectId.isValid(branchId)) {
    throw new ApiError(400, 'Invalid Branch ID format.', 'INVALID_BRANCH_ID');
  }

  const branch = await Branch.findById(branchId);
  if (!branch) {
    throw new ApiError(404, 'Branch not found.', 'BRANCH_NOT_FOUND');
  }

  if (userActor.role === USER_ROLES.SELLER) {
    if (branch.sellerId.toString() !== userActor._id.toString()) {
      throw new ApiError(403, 'Forbidden: You can only modify your own store branches.', 'FORBIDDEN');
    }
  }

  await Branch.updateMany(
    { storeId: branch.storeId, _id: { $ne: branch._id } },
    { $set: { isPrimary: false } }
  );

  branch.isPrimary = true;
  branch.isActive = true; // Primary branch must be active
  await branch.save();
  return branch;
};

/**
 * 7. Get associated inventory and batch telemetry for a specific branch.
 */
export const getBranchInventoryService = async (branchId, userActor) => {
  if (!mongoose.Types.ObjectId.isValid(branchId)) {
    throw new ApiError(400, 'Invalid Branch ID format.', 'INVALID_BRANCH_ID');
  }

  const branch = await Branch.findById(branchId).lean();
  if (!branch) {
    throw new ApiError(404, 'Branch not found.', 'BRANCH_NOT_FOUND');
  }

  if (userActor.role === USER_ROLES.SELLER) {
    if (branch.sellerId.toString() !== userActor._id.toString()) {
      throw new ApiError(403, 'Forbidden: You can only inspect your own store inventory.', 'FORBIDDEN');
    }
  }

  const todayUtc = new Date(toCalendarDayEpochUTC(new Date()));

  // Query batches for this branch (and legacy unassigned batches if primary)
  const batchFilter = {
    storeId: branch.storeId,
    $or: [{ branchId: branch._id }],
  };

  if (branch.isPrimary) {
    batchFilter.$or.push({ branchId: null }, { branchId: { $exists: false } });
  }

  const batches = await Batch.find(batchFilter)
    .populate('productId', 'name brand unit image category status')
    .sort({ expiryDate: 1, createdAt: -1 })
    .lean();

  const totalBatches = batches.length;
  let totalUnits = 0;
  let criticalLots = 0;
  let approachingLots = 0;
  let expiredLots = 0;

  for (const b of batches) {
    totalUnits += b.quantity || 0;
    const isExpired =
      new Date(b.expiryDate) < todayUtc ||
      b.remainingDays < 0 ||
      b.status === BATCH_STATUS.EXPIRED;

    if (isExpired) {
      expiredLots += 1;
    } else if (b.remainingDays <= 2 || b.status === BATCH_STATUS.CRITICAL) {
      criticalLots += 1;
    } else if (b.remainingDays <= 7 || b.status === BATCH_STATUS.APPROACHING_EXPIRY) {
      approachingLots += 1;
    }
  }

  return {
    branch,
    telemetry: {
      totalBatches,
      totalUnits,
      criticalLots,
      approachingLots,
      expiredLots,
    },
    batches,
  };
};

