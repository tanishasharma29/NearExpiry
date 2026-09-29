import mongoose from 'mongoose';

export const INVENTORY_ACTION_TYPES = Object.freeze({
  INITIAL_STOCK: 'INITIAL_STOCK',
  STOCK_ADJUSTMENT: 'STOCK_ADJUSTMENT',
  STOCK_RESERVATION: 'STOCK_RESERVATION',
  STOCK_RELEASE: 'STOCK_RELEASE',
  STOCK_COMMITTED_SALE: 'STOCK_COMMITTED_SALE',
  EXPIRED_WRITE_OFF: 'EXPIRED_WRITE_OFF',
});

/**
 * Immutable Batch-Level Inventory Audit Ledger.
 * Every stock creation, manual adjustment, reservation, release, or expiry write-off
 * is recorded here for full traceability.
 */
const inventoryAuditSchema = new mongoose.Schema(
  {
    batchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Batch',
      required: [true, 'batchId is required'],
      index: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'productId is required'],
      index: true,
    },
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      required: [true, 'storeId is required'],
      index: true,
    },
    batchNumber: {
      type: String,
      required: true,
      trim: true,
    },
    actionType: {
      type: String,
      enum: Object.values(INVENTORY_ACTION_TYPES),
      required: true,
      index: true,
    },
    quantityChange: {
      type: Number,
      required: true,
    },
    previousQuantity: {
      type: Number,
      required: true,
      min: 0,
    },
    newQuantity: {
      type: Number,
      required: true,
      min: 0,
    },
    previousReserved: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    newReserved: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    batchStatusAfter: {
      type: String,
      required: true,
    },
    referenceId: {
      type: String,
      default: null,
      trim: true,
    },
    reason: {
      type: String,
      required: [true, 'Audit reason is required for inventory movement'],
      trim: true,
      maxlength: 500,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    performedByRole: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

inventoryAuditSchema.index({ storeId: 1, createdAt: -1 });
inventoryAuditSchema.index({ batchId: 1, createdAt: -1 });
inventoryAuditSchema.index({ productId: 1, createdAt: -1 });

export const InventoryAudit = mongoose.model('InventoryAudit', inventoryAuditSchema);
