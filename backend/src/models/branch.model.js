import mongoose from 'mongoose';

const branchAddressSchema = new mongoose.Schema(
  {
    street: { type: String, required: [true, 'Street address is required'], trim: true },
    locality: { type: String, trim: true, default: '' },
    city: { type: String, required: [true, 'City is required'], trim: true, index: true },
    state: { type: String, required: [true, 'State is required'], trim: true },
    pincode: { type: String, required: [true, 'Pincode is required'], trim: true, index: true },
    landmark: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const branchSchema = new mongoose.Schema(
  {
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      required: [true, 'Store reference is required'],
      index: true,
    },
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Seller reference is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Branch name is required'],
      trim: true,
      minlength: [2, 'Branch name must be at least 2 characters'],
      maxlength: [100, 'Branch name cannot exceed 100 characters'],
    },
    address: {
      type: branchAddressSchema,
      required: [true, 'Branch physical address is required'],
    },
    contactPhone: {
      type: String,
      required: [true, 'Contact phone is required'],
      trim: true,
    },
    contactEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    operatingHours: {
      type: String,
      trim: true,
      default: '09:00 AM - 09:00 PM',
    },
    latitude: {
      type: Number,
      default: null,
      min: -90,
      max: 90,
    },
    longitude: {
      type: Number,
      default: null,
      min: -180,
      max: 180,
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: undefined,
      },
    },
    isPrimary: {
      type: Boolean,
      default: false,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// High performance query indexes
branchSchema.index({ storeId: 1, isActive: 1 });
branchSchema.index({ sellerId: 1, isActive: 1 });
branchSchema.index({ 'address.pincode': 1, isActive: 1 });
branchSchema.index({ 'address.city': 1, isActive: 1 });
branchSchema.index({ location: '2dsphere' }, { sparse: true });

// Pre-save synchronization for location coordinates
branchSchema.pre('validate', function () {
  if (
    typeof this.longitude === 'number' &&
    typeof this.latitude === 'number' &&
    !Number.isNaN(this.longitude) &&
    !Number.isNaN(this.latitude)
  ) {
    this.location = {
      type: 'Point',
      coordinates: [this.longitude, this.latitude],
    };
  } else if (!this.latitude || !this.longitude) {
    this.location = undefined;
  }
});

export const Branch = mongoose.model('Branch', branchSchema);
export default Branch;
