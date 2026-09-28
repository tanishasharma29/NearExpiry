import mongoose from 'mongoose';
import { VERIFICATION_STATUS } from './user.model.js';

export const STORE_OPERATIONAL_STATUS = Object.freeze({
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
  MAINTENANCE: 'MAINTENANCE',
  INACTIVE: 'INACTIVE',
});

const addressSchema = new mongoose.Schema(
  {
    street: { type: String, required: [true, 'Street address is required'], trim: true },
    landmark: { type: String, trim: true, default: '' },
    city: { type: String, required: [true, 'City is required'], trim: true, index: true },
    state: { type: String, required: [true, 'State is required'], trim: true },
    pincode: { type: String, required: [true, 'Pincode is required'], trim: true, index: true },
  },
  { _id: false }
);

const storeSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Store owner (Seller) ID is required'],
      unique: true,
      index: true,
    },
    storeName: {
      type: String,
      required: [true, 'Store name is required'],
      trim: true,
      minlength: [2, 'Store name must be at least 2 characters'],
      maxlength: [120, 'Store name cannot exceed 120 characters'],
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
      default: '',
    },
    contactPhone: {
      type: String,
      required: [true, 'Store contact phone is required'],
      trim: true,
    },
    contactEmail: {
      type: String,
      lowercase: true,
      trim: true,
      default: null,
    },
    businessDetails: {
      businessLicenseNumber: { type: String, trim: true, default: null },
      gstNumber: { type: String, trim: true, default: null },
      fssaiLicenseNumber: { type: String, trim: true, default: null },
      cosmeticLicenseNumber: { type: String, trim: true, default: null },
    },
    address: {
      type: addressSchema,
      required: [true, 'Store physical address is required'],
    },
    latitude: {
      type: Number,
      required: [true, 'Store latitude is required'],
      min: [-90, 'Latitude must be between -90 and 90'],
      max: [90, 'Latitude must be between -90 and 90'],
    },
    longitude: {
      type: Number,
      required: [true, 'Store longitude is required'],
      min: [-180, 'Longitude must be between -180 and 180'],
      max: [180, 'Longitude must be between -180 and 180'],
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
      },
    },
    status: {
      type: String,
      enum: Object.values(STORE_OPERATIONAL_STATUS),
      default: STORE_OPERATIONAL_STATUS.OPEN,
      index: true,
    },
    verificationStatus: {
      type: String,
      enum: Object.values(VERIFICATION_STATUS),
      default: VERIFICATION_STATUS.PENDING,
      index: true,
    },
    verificationAudit: {
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      reviewedAt: { type: Date, default: null },
      rejectionReason: { type: String, default: null },
    },
    fulfillmentModes: {
      type: [String],
      enum: ['PICKUP', 'LOCAL_DELIVERY'],
      default: ['PICKUP', 'LOCAL_DELIVERY'],
    },
    deliveryRadiusKm: {
      type: Number,
      min: 1,
      max: 50,
      default: 10,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// 2dsphere index for hyperlocal geospatial queries
storeSchema.index({ location: '2dsphere' });
storeSchema.index({ verificationStatus: 1, isActive: 1, status: 1 });

// Automatically synchronize GeoJSON location.coordinates and slug before validation/save
storeSchema.pre('validate', function (next) {
  if (typeof this.longitude === 'number' && typeof this.latitude === 'number') {
    this.location = {
      type: 'Point',
      coordinates: [this.longitude, this.latitude],
    };
  }

  if (!this.slug && this.storeName) {
    const baseSlug = this.storeName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const suffix = this._id ? this._id.toString().slice(-6) : Math.random().toString(36).slice(2, 8);
    this.slug = `${baseSlug}-${suffix}`;
  }

  next();
});

export const Store = mongoose.model('Store', storeSchema);
