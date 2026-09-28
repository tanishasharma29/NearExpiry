import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';

export const USER_ROLES = Object.freeze({
  CUSTOMER: 'CUSTOMER',
  SELLER: 'SELLER',
  ADMIN: 'ADMIN',
});

export const VERIFICATION_STATUS = Object.freeze({
  NOT_APPLICABLE: 'NOT_APPLICABLE',
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  SUSPENDED: 'SUSPENDED',
});

const sellerProfileSchema = new mongoose.Schema(
  {
    storeName: { type: String, trim: true, required: true },
    businessLicenseNumber: { type: String, trim: true, default: null },
    gstNumber: { type: String, trim: true, default: null },
    fssaiLicenseNumber: { type: String, trim: true, default: null },
    cosmeticLicenseNumber: { type: String, trim: true, default: null },
    address: {
      street: { type: String, trim: true, default: '' },
      city: { type: String, trim: true, default: '' },
      state: { type: String, trim: true, default: '' },
      pincode: { type: String, trim: true, default: '' },
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [77.5946, 12.9716],
      },
    },
    submittedAt: { type: Date, default: Date.now },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    rejectionReason: { type: String, default: null },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [80, 'Name cannot exceed 80 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email address is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email address'],
      index: true,
    },
    phone: {
      type: String,
      trim: true,
      default: null,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
    role: {
      type: String,
      enum: Object.values(USER_ROLES),
      default: USER_ROLES.CUSTOMER,
      index: true,
    },
    verificationStatus: {
      type: String,
      enum: Object.values(VERIFICATION_STATUS),
      default: function () {
        if (this.role === USER_ROLES.SELLER) return VERIFICATION_STATUS.PENDING;
        if (this.role === USER_ROLES.ADMIN) return VERIFICATION_STATUS.APPROVED;
        return VERIFICATION_STATUS.NOT_APPLICABLE;
      },
      index: true,
    },
    sellerProfile: {
      type: sellerProfileSchema,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    tokenVersion: {
      type: Number,
      default: 0,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook: enforce SELLER initial PENDING verification & hash modified passwords
userSchema.pre('save', async function (next) {
  if (this.isNew && this.role === USER_ROLES.SELLER) {
    this.verificationStatus = VERIFICATION_STATUS.PENDING;
  }

  if (!this.isModified('password')) {
    return next();
  }

  const salt = await bcrypt.genSalt(env.BCRYPT_SALT_ROUNDS);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Instance method: Verify plaintext password against bcrypt hash
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Instance method: Sanitize user document for API responses
userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.__v;
  delete obj.tokenVersion;
  return obj;
};

export const User = mongoose.model('User', userSchema);
