import mongoose from 'mongoose';

export const PRODUCT_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  DRAFT: 'DRAFT',
  ARCHIVED: 'ARCHIVED',
});

export const PRODUCT_UNITS = Object.freeze([
  'pcs',
  'g',
  'kg',
  'ml',
  'l',
  'pack',
  'box',
  'bottle',
]);

/**
 * Product Mongoose Schema (Master SKU Catalog Entity).
 *
 * IMPORTANT ARCHITECTURAL INVARIANT:
 * Product and Batch are strictly separated concepts.
 * - A Product NEVER contains batchNumber, manufacturingDate, expiryDate, or dynamic batch prices.
 * - One Product has many Batches (1:N relationship via virtual 'batches').
 */
const productSchema = new mongoose.Schema(
  {
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Seller ID is required'],
      index: true,
    },
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      required: [true, 'Store ID is required'],
      index: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Product category is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      minlength: [2, 'Product name must be at least 2 characters'],
      maxlength: [160, 'Product name cannot exceed 160 characters'],
    },
    slug: {
      type: String,
      lowercase: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      required: [true, 'Product description is required'],
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    brand: {
      type: String,
      required: [true, 'Brand name is required'],
      trim: true,
      maxlength: [80, 'Brand name cannot exceed 80 characters'],
      index: true,
    },
    image: {
      type: String,
      trim: true,
      default: 'https://placehold.co/600x600?text=NearExpiry+Product',
    },
    unit: {
      type: String,
      required: [true, 'Product unit (e.g., pcs, g, kg, ml, l, pack) is required'],
      enum: {
        values: PRODUCT_UNITS,
        message: `Unit must be one of: ${PRODUCT_UNITS.join(', ')}`,
      },
      default: 'pcs',
    },
    status: {
      type: String,
      enum: Object.values(PRODUCT_STATUS),
      default: PRODUCT_STATUS.ACTIVE,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// 1:N Virtual relationship -> One Product can have many Batches
productSchema.virtual('batches', {
  ref: 'Batch',
  localField: '_id',
  foreignField: 'productId',
  justOne: false,
});

// Compound & Text Indexes for high-performance discovery, filtering, and sorting
productSchema.index({ status: 1, category: 1, createdAt: -1 });
productSchema.index({ sellerId: 1, status: 1, createdAt: -1 });
productSchema.index({ storeId: 1, status: 1, brand: 1 });
productSchema.index({ storeId: 1, slug: 1 }, { unique: true });
productSchema.index(
  { name: 'text', brand: 'text', description: 'text' },
  { weights: { name: 10, brand: 6, description: 2 } }
);

productSchema.pre('validate', function (next) {
  if (this.name && (!this.slug || this.isModified('name'))) {
    const baseSlug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const suffix = this._id ? this._id.toString().slice(-6) : Math.random().toString(36).slice(2, 8);
    this.slug = `${baseSlug}-${suffix}`;
  }
  next();
});

export const Product = mongoose.model('Product', productSchema);
