import { Store, STORE_OPERATIONAL_STATUS } from '../models/store.model.js';
import { User, USER_ROLES, VERIFICATION_STATUS } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import { generateAccessToken } from '../utils/jwt.js';

const ensureEmailNotTaken = async (email) => {
  const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
  if (existingUser) {
    throw new ApiError(
      409,
      `An account with email [${email.toLowerCase()}] already exists.`,
      'DUPLICATE_EMAIL',
      [{ field: 'email', message: 'Email is already registered' }]
    );
  }
};

export const registerCustomerService = async (payload) => {
  const { name, email, phone, password } = payload;

  await ensureEmailNotTaken(email);

  const user = await User.create({
    name,
    email,
    phone: phone || null,
    password,
    role: USER_ROLES.CUSTOMER,
    verificationStatus: VERIFICATION_STATUS.NOT_APPLICABLE,
    lastLoginAt: new Date(),
  });

  const token = generateAccessToken(user);

  return {
    user: user.toSafeObject(),
    token,
  };
};

export const registerSellerService = async (payload) => {
  const {
    name,
    email,
    phone,
    password,
    storeName,
    businessLicenseNumber,
    gstNumber,
    fssaiLicenseNumber,
    cosmeticLicenseNumber,
    address,
    latitude,
    longitude,
  } = payload;

  await ensureEmailNotTaken(email);

  const coordinates =
    typeof longitude === 'number' && typeof latitude === 'number'
      ? [longitude, latitude]
      : [77.5946, 12.9716];

  const user = await User.create({
    name,
    email,
    phone: phone || null,
    password,
    role: USER_ROLES.SELLER,
    verificationStatus: VERIFICATION_STATUS.PENDING,
    sellerProfile: {
      storeName,
      businessLicenseNumber: businessLicenseNumber || null,
      gstNumber: gstNumber || null,
      fssaiLicenseNumber: fssaiLicenseNumber || null,
      cosmeticLicenseNumber: cosmeticLicenseNumber || null,
      address: {
        street: address?.street || 'Retail Market Road',
        city: address?.city || 'Bangalore',
        state: address?.state || 'Karnataka',
        pincode: address?.pincode || '560001',
      },
      location: {
        type: 'Point',
        coordinates,
      },
      submittedAt: new Date(),
    },
    lastLoginAt: new Date(),
  });

  const slug = (storeName || `${name} Store`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') + '-' + Math.floor(Math.random() * 10000);

  try {
    await Store.create({
      ownerId: user._id,
      storeName: storeName || `${name}'s Store`,
      slug,
      description: 'Neighborhood Supermarket Partner',
      contactPhone: phone || '9999999999',
      contactEmail: email,
      businessDetails: {
        businessLicenseNumber: businessLicenseNumber || null,
        gstNumber: gstNumber || null,
        fssaiLicenseNumber: fssaiLicenseNumber || null,
        cosmeticLicenseNumber: cosmeticLicenseNumber || null,
      },
      address: {
        street: address?.street || 'Retail Market Road',
        city: address?.city || 'Bangalore',
        state: address?.state || 'Karnataka',
        pincode: address?.pincode || '560001',
      },
      latitude: coordinates[1] || 12.9716,
      longitude: coordinates[0] || 77.5946,
      location: {
        type: 'Point',
        coordinates,
      },
      status: STORE_OPERATIONAL_STATUS.OPEN,
      verificationStatus: user.verificationStatus,
      isActive: true,
      fulfillmentModes: ['PICKUP', 'LOCAL_DELIVERY'],
      deliveryRadiusKm: 10,
    });
  } catch (err) {
    console.error('Error auto-provisioning store on seller registration:', err);
  }

  const token = generateAccessToken(user);

  return {
    user: user.toSafeObject(),
    token,
  };
};

export const registerAdminService = async (payload) => {
  const { name, email, phone, password } = payload;

  await ensureEmailNotTaken(email);

  const user = await User.create({
    name,
    email,
    phone: phone || null,
    password,
    role: USER_ROLES.ADMIN,
    verificationStatus: VERIFICATION_STATUS.APPROVED,
    lastLoginAt: new Date(),
  });

  const token = generateAccessToken(user);

  return {
    user: user.toSafeObject(),
    token,
  };
};

export const loginUserService = async ({ email, password }) => {
  const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');

  if (!user) {
    throw new ApiError(401, 'Invalid email or password.', 'INVALID_CREDENTIALS');
  }

  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    throw new ApiError(401, 'Invalid email or password.', 'INVALID_CREDENTIALS');
  }

  if (!user.isActive) {
    throw new ApiError(
      403,
      'Your account has been suspended or deactivated.',
      'ACCOUNT_DEACTIVATED'
    );
  }

  user.lastLoginAt = new Date();
  await user.save({ validateBeforeSave: false });

  const token = generateAccessToken(user);

  return {
    user: user.toSafeObject(),
    token,
  };
};

export const getCurrentUserService = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'User not found.', 'USER_NOT_FOUND');
  }
  return user.toSafeObject();
};

export const logoutUserService = async (userId) => {
  await User.findByIdAndUpdate(userId, { $inc: { tokenVersion: 1 } });
};
