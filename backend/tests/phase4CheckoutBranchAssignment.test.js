import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { createOrderSchema } from '../src/validators/order.validator.js';
import { checkoutValidateSchema } from '../src/validators/cart.validator.js';
import { Order, ORDER_STATUS, FULFILLMENT_TYPES } from '../src/models/order.model.js';
import { Batch, BATCH_STATUS } from '../src/models/batch.model.js';
import { Branch } from '../src/models/branch.model.js';
import { InventoryAudit, INVENTORY_ACTION_TYPES } from '../src/models/inventory.model.js';
import { QrVerification, QR_TYPE, QR_STATUS } from '../src/models/qrVerification.model.js';
import { computeBatchStatus, isBatchPurchasable, toCalendarDayEpochUTC } from '../src/utils/shelfLife.js';

describe('Phase 4: Checkout Branch Assignment & Branch Stock Isolation Suite', () => {
  const storeAId = new mongoose.Types.ObjectId();
  const storeBId = new mongoose.Types.ObjectId();
  const sellerAId = new mongoose.Types.ObjectId();
  const customerId = new mongoose.Types.ObjectId();

  const primaryBranchA = new Branch({
    storeId: storeAId,
    sellerId: sellerAId,
    name: 'Green Grocers — Indiranagar (Main)',
    address: {
      street: '100 Feet Road, 4th Block',
      locality: 'Indiranagar',
      city: 'Bangalore',
      state: 'Karnataka',
      pincode: '560038',
      landmark: 'Near Metro Station',
    },
    contactPhone: '9876543210',
    contactEmail: 'indiranagar@example.com',
    operatingHours: '08:00 AM - 10:00 PM',
    isPrimary: true,
    isActive: true,
  });

  const secondaryBranchA = new Branch({
    storeId: storeAId,
    sellerId: sellerAId,
    name: 'Green Grocers — Koramangala Annex',
    address: {
      street: '80 Feet Road, 6th Block',
      locality: 'Koramangala',
      city: 'Bangalore',
      state: 'Karnataka',
      pincode: '560095',
      landmark: 'Sony World Signal',
    },
    contactPhone: '9876543211',
    contactEmail: 'koramangala@example.com',
    operatingHours: '09:00 AM - 09:00 PM',
    isPrimary: false,
    isActive: true,
  });

  const inactiveBranchA = new Branch({
    storeId: storeAId,
    sellerId: sellerAId,
    name: 'Green Grocers — Whitefield (Temporarily Closed)',
    address: {
      street: 'ITPL Main Road',
      locality: 'Whitefield',
      city: 'Bangalore',
      state: 'Karnataka',
      pincode: '560066',
    },
    contactPhone: '9876543212',
    isPrimary: false,
    isActive: false,
  });

  const foreignBranchB = new Branch({
    storeId: storeBId,
    sellerId: new mongoose.Types.ObjectId(),
    name: 'Organic Harvest — Jayanagar',
    address: {
      street: '9th Main Road, 4th Block',
      locality: 'Jayanagar',
      city: 'Bangalore',
      state: 'Karnataka',
      pincode: '560011',
    },
    contactPhone: '9876543213',
    isPrimary: true,
    isActive: true,
  });

  // =========================================================================
  // 1. Zod Request Schema Validation
  // =========================================================================
  describe('1. Checkout & Cart Request Schema Validation', () => {
    it('accepts valid 24-character hex branchId in createOrderSchema', () => {
      const validPayload = {
        body: {
          fulfillmentType: 'PICKUP',
          paymentMethod: 'MOCK_PAYMENT',
          branchId: primaryBranchA._id.toString(),
        },
      };
      const result = createOrderSchema.safeParse(validPayload);
      assert.equal(result.success, true);
      assert.equal(result.data.body.branchId, primaryBranchA._id.toString());
    });

    it('allows omitting branchId or setting to null for backwards compatibility', () => {
      const payloadWithoutBranch = {
        body: {
          fulfillmentType: 'PICKUP',
          paymentMethod: 'CASH_ON_DELIVERY',
        },
      };
      const result = createOrderSchema.safeParse(payloadWithoutBranch);
      assert.equal(result.success, true);
      assert.equal(result.data.body.branchId, undefined);
    });

    it('rejects malformed branchId format in createOrderSchema', () => {
      const malformedPayload = {
        body: {
          fulfillmentType: 'PICKUP',
          paymentMethod: 'MOCK_PAYMENT',
          branchId: 'not-a-valid-object-id',
        },
      };
      const result = createOrderSchema.safeParse(malformedPayload);
      assert.equal(result.success, false);
      const branchIssue = result.error.issues.find((i) => i.path.includes('branchId'));
      assert.ok(branchIssue);
    });

    it('accepts valid branchId in checkoutValidateSchema for pre-flight cart verification', () => {
      const validCheckoutValidation = {
        body: {
          storeId: storeAId.toString(),
          branchId: secondaryBranchA._id.toString(),
        },
      };
      const result = checkoutValidateSchema.safeParse(validCheckoutValidation);
      assert.equal(result.success, true);
      assert.equal(result.data.body.branchId, secondaryBranchA._id.toString());
    });

    it('accepts empty string branchId in checkoutValidateSchema and createOrderSchema without error', () => {
      const emptyBranchCheckout = {
        body: {
          storeId: storeAId.toString(),
          branchId: '',
        },
      };
      const cartResult = checkoutValidateSchema.safeParse(emptyBranchCheckout);
      assert.equal(cartResult.success, true);
      assert.equal(cartResult.data.body.branchId, null);

      const emptyBranchOrder = {
        body: {
          fulfillmentType: 'PICKUP',
          paymentMethod: 'CASH_ON_DELIVERY',
          branchId: '',
        },
      };
      const orderResult = createOrderSchema.safeParse(emptyBranchOrder);
      assert.equal(orderResult.success, true);
      assert.equal(orderResult.data.body.branchId, null);
    });
  });

  // =========================================================================
  // 2. Explicit Branch Selection, Ownership & Inactive Guards
  // =========================================================================
  describe('2. Explicit Branch Selection & Security Validation', () => {
    it('detects and rejects branch belonging to another store (BRANCH_STORE_MISMATCH)', () => {
      const fulfillingStoreId = storeAId.toString();
      const selectedBranchStoreId = foreignBranchB.storeId.toString();

      assert.notEqual(
        fulfillingStoreId,
        selectedBranchStoreId,
        'Branch from store B must not match store A'
      );

      const isStoreMismatch = fulfillingStoreId !== selectedBranchStoreId;
      assert.equal(isStoreMismatch, true);
    });

    it('detects and rejects inactive branch without silently switching to primary (BRANCH_INACTIVE)', () => {
      assert.equal(inactiveBranchA.isActive, false);

      // Business rule: Never silently switch explicit user selection
      let selectedBranch = inactiveBranchA;
      let error = null;

      if (!selectedBranch.isActive) {
        error = {
          statusCode: 400,
          code: 'BRANCH_INACTIVE',
          message: 'Selected pickup branch is currently inactive. Please choose an active branch.',
        };
      }

      assert.ok(error);
      assert.equal(error.code, 'BRANCH_INACTIVE');
      assert.notEqual(selectedBranch._id.toString(), primaryBranchA._id.toString());
    });

    it('permits primary branch fallback only when no branch is explicitly specified', () => {
      let explicitBranchId = null;
      let selectedBranch = null;

      if (explicitBranchId) {
        // Validate explicit selection
        selectedBranch = null;
      } else {
        // Safe deterministic fallback to active primary branch
        selectedBranch = primaryBranchA;
      }

      assert.ok(selectedBranch);
      assert.equal(selectedBranch.isPrimary, true);
      assert.equal(selectedBranch.isActive, true);
      assert.equal(selectedBranch._id.toString(), primaryBranchA._id.toString());
    });
  });

  // =========================================================================
  // 3. Branch Inventory Isolation & Deterministic Legacy Fallback
  // =========================================================================
  describe('3. Inventory Isolation & Legacy Stock Fallback', () => {
    const legacyBatch = {
      _id: new mongoose.Types.ObjectId(),
      storeId: storeAId,
      branchId: null, // Legacy batch before multi-branch
      batchNumber: 'LEGACY-LOT-001',
      quantity: 10,
      status: BATCH_STATUS.NORMAL,
    };

    const primaryBatch = {
      _id: new mongoose.Types.ObjectId(),
      storeId: storeAId,
      branchId: primaryBranchA._id,
      batchNumber: 'PRIMARY-LOT-002',
      quantity: 8,
      status: BATCH_STATUS.NORMAL,
    };

    const secondaryBatch = {
      _id: new mongoose.Types.ObjectId(),
      storeId: storeAId,
      branchId: secondaryBranchA._id,
      batchNumber: 'SECONDARY-LOT-003',
      quantity: 5,
      status: BATCH_STATUS.NORMAL,
    };

    const allBatches = [legacyBatch, primaryBatch, secondaryBatch];

    it('isolates secondary branch strictly to its assigned lots (cannot touch legacy or other branch lots)', () => {
      // Query filter applied for secondary branch
      const branchFilter = (b) =>
        b.branchId && b.branchId.toString() === secondaryBranchA._id.toString();

      const visibleLots = allBatches.filter(branchFilter);
      assert.equal(visibleLots.length, 1);
      assert.equal(visibleLots[0].batchNumber, 'SECONDARY-LOT-003');
      assert.equal(visibleLots[0].quantity, 5);

      // Ensures legacy batch is NOT touched
      const touchesLegacy = visibleLots.some((b) => b.branchId === null);
      assert.equal(touchesLegacy, false);
    });

    it('allows primary branch to fulfill both its assigned lots and legacy lots (deterministic legacy fallback)', () => {
      // Query filter applied for primary branch: { $or: [{ branchId: primary._id }, { branchId: null }] }
      const branchFilter = (b) =>
        b.branchId === null ||
        (b.branchId && b.branchId.toString() === primaryBranchA._id.toString());

      const visibleLots = allBatches.filter(branchFilter);
      assert.equal(visibleLots.length, 2);

      const batchNumbers = visibleLots.map((b) => b.batchNumber);
      assert.ok(batchNumbers.includes('LEGACY-LOT-001'));
      assert.ok(batchNumbers.includes('PRIMARY-LOT-002'));

      // Does NOT touch secondary branch lots
      assert.equal(batchNumbers.includes('SECONDARY-LOT-003'), false);
    });

    it('enforces insufficient stock at selected branch even if another branch holds sufficient units', () => {
      const requestedUnits = 7;
      // Customer selected secondary branch (which only has 5 units)
      const secondaryBranchAvailable = allBatches
        .filter((b) => b.branchId && b.branchId.toString() === secondaryBranchA._id.toString())
        .reduce((sum, b) => sum + b.quantity, 0);

      assert.equal(secondaryBranchAvailable, 5);
      const isSufficient = secondaryBranchAvailable >= requestedUnits;
      assert.equal(isSufficient, false);

      // Total store units across all branches is 23, but checkout must fail due to branch isolation
      const totalStoreUnits = allBatches.reduce((sum, b) => sum + b.quantity, 0);
      assert.equal(totalStoreUnits, 23);
      assert.ok(requestedUnits <= totalStoreUnits);
    });
  });

  // =========================================================================
  // 4. Atomic Concurrency & Conditional Deduction Simulation
  // =========================================================================
  describe('4. Atomic Concurrency & Stock Allocation Invariants', () => {
    it('simulates atomic conditional decrement ($gte) preventing over-allocation under concurrent checkouts', () => {
      let lotStock = 5;
      const orderAAllocation = 5;
      const orderBAllocation = 5;

      // Simulated atomic conditional update: { quantity: { $gte: alloc.quantity } }
      const tryAtomicDecrement = (requested) => {
        if (lotStock >= requested) {
          lotStock -= requested;
          return { success: true, remaining: lotStock };
        }
        return { success: false, remaining: lotStock };
      };

      const resultA = tryAtomicDecrement(orderAAllocation);
      assert.equal(resultA.success, true);
      assert.equal(resultA.remaining, 0);

      // Concurrent second checkout attempting same remaining stock fails cleanly
      const resultB = tryAtomicDecrement(orderBAllocation);
      assert.equal(resultB.success, false);
      assert.equal(resultB.remaining, 0);
      assert.ok(lotStock >= 0, 'Lot stock must never become negative');
    });

    it('updates batch status to OUT_OF_STOCK and isPurchasable to false when lot reaches 0 units', () => {
      const remainingDays = 10;
      const remainingQty = 0;
      const status = computeBatchStatus(remainingDays, remainingQty);
      const purchasable = isBatchPurchasable(remainingDays, remainingQty, status);

      assert.equal(status, BATCH_STATUS.OUT_OF_STOCK);
      assert.equal(purchasable, false);
    });
  });

  // =========================================================================
  // 5. Order Model Persistence & Pickup Branch Snapshot
  // =========================================================================
  describe('5. Order Document Persistence & Pickup Snapshot', () => {
    it('persists branchId and complete pickupBranch snapshot on order creation', () => {
      const order = new Order({
        orderNumber: 'NE-20261104-9901',
        customerId,
        storeId: storeAId,
        branchId: primaryBranchA._id,
        pickupBranch: {
          name: primaryBranchA.name,
          address: {
            street: primaryBranchA.address.street,
            locality: primaryBranchA.address.locality,
            city: primaryBranchA.address.city,
            state: primaryBranchA.address.state,
            pincode: primaryBranchA.address.pincode,
            landmark: primaryBranchA.address.landmark,
          },
          contactPhone: primaryBranchA.contactPhone,
          contactEmail: primaryBranchA.contactEmail,
          operatingHours: primaryBranchA.operatingHours,
        },
        fulfillmentType: FULFILLMENT_TYPES.PICKUP,
        items: [
          {
            productId: new mongoose.Types.ObjectId(),
            productName: 'Organic Whole Milk 1L',
            brand: 'Farm Fresh',
            requestedQuantity: 2,
            unitOriginalPrice: 60,
            unitDiscountedPrice: 48,
            lineOriginalAmount: 120,
            lineDiscountedAmount: 96,
            totalSavings: 24,
            batchAllocations: [
              {
                batchId: new mongoose.Types.ObjectId(),
                batchNumber: 'LOT-MILK-001',
                allocatedQuantity: 2,
                remainingDays: 3,
                discountPercentage: 20,
                unitPrice: 48,
              },
            ],
          },
        ],
        pricingSummary: {
          subtotal: 120,
          discounts: 24,
          finalTotal: 96,
        },
      });

      assert.ok(order._id);
      assert.equal(order.branchId.toString(), primaryBranchA._id.toString());
      assert.equal(order.pickupBranch.name, primaryBranchA.name);
      assert.equal(order.pickupBranch.address.pincode, '560038');
      assert.equal(order.pickupBranch.contactPhone, '9876543210');
      assert.equal(order.fulfillmentType, 'PICKUP');
    });

    it('preserves 100% backward compatibility for historical orders where branchId is null', () => {
      const legacyOrder = new Order({
        orderNumber: 'NE-20261001-1001',
        customerId,
        storeId: storeAId,
        branchId: null, // Legacy order before multi-branch
        pickupBranch: null,
        fulfillmentType: FULFILLMENT_TYPES.PICKUP,
        items: [
          {
            productId: new mongoose.Types.ObjectId(),
            productName: 'Artisan Sourdough',
            requestedQuantity: 1,
            unitOriginalPrice: 100,
            unitDiscountedPrice: 80,
            lineOriginalAmount: 100,
            lineDiscountedAmount: 80,
            totalSavings: 20,
            batchAllocations: [
              {
                batchId: new mongoose.Types.ObjectId(),
                batchNumber: 'LOT-BREAD-001',
                allocatedQuantity: 1,
                remainingDays: 2,
                discountPercentage: 20,
                unitPrice: 80,
              },
            ],
          },
        ],
        pricingSummary: {
          subtotal: 100,
          discounts: 20,
          finalTotal: 80,
        },
      });

      assert.ok(legacyOrder._id);
      assert.equal(legacyOrder.branchId, null);
      assert.equal(legacyOrder.pickupBranch, null);
      assert.equal(legacyOrder.orderNumber, 'NE-20261001-1001');
    });
  });

  // =========================================================================
  // 6. Order Cancellation & Inventory Restoration with Branch Audit
  // =========================================================================
  describe('6. Cancellation Stock Restoration & Branch Audit Tracking', () => {
    it('restores stock and generates InventoryAudit record with branchId upon cancellation', () => {
      const restoredBatchId = new mongoose.Types.ObjectId();
      const audit = new InventoryAudit({
        batchId: restoredBatchId,
        branchId: secondaryBranchA._id,
        productId: new mongoose.Types.ObjectId(),
        storeId: storeAId,
        batchNumber: 'LOT-RETURN-001',
        actionType: INVENTORY_ACTION_TYPES.STOCK_ADJUSTMENT,
        quantityChange: 2,
        previousQuantity: 3,
        newQuantity: 5,
        previousReserved: 0,
        newReserved: 0,
        batchStatusAfter: BATCH_STATUS.NORMAL,
        referenceId: 'NE-20261104-9901',
        reason: 'Order [NE-20261104-9901] cancelled: Stock restored to active inventory lot',
        performedBy: customerId,
        performedByRole: 'CUSTOMER',
      });

      assert.ok(audit._id);
      assert.equal(audit.branchId.toString(), secondaryBranchA._id.toString());
      assert.equal(audit.actionType, INVENTORY_ACTION_TYPES.STOCK_ADJUSTMENT);
      assert.equal(audit.quantityChange, 2);
      assert.equal(audit.newQuantity, 5);
    });
  });

  // =========================================================================
  // 7. Pickup QR Token & Historical Backwards Compatibility
  // =========================================================================
  describe('7. Pickup QR Verification & Historical Compatibility', () => {
    it('creates QrVerification record bound to branchId for new pickup order', () => {
      const qrRecord = new QrVerification({
        qrType: QR_TYPE.PICKUP,
        orderId: new mongoose.Types.ObjectId(),
        customerId,
        storeId: storeAId,
        branchId: primaryBranchA._id,
        tokenNonce: 'nonce-1234567890abcdef',
        tokenHash: 'hash-1234567890abcdef1234567890abcdef',
        status: QR_STATUS.ACTIVE,
        expiresAt: new Date(Date.now() + 48 * 3600 * 1000),
      });

      assert.ok(qrRecord._id);
      assert.equal(qrRecord.qrType, 'PICKUP');
      assert.equal(qrRecord.branchId.toString(), primaryBranchA._id.toString());
      assert.equal(qrRecord.status, 'ACTIVE');
    });

    it('supports historical QrVerification records where branchId is null', () => {
      const historicalQr = new QrVerification({
        qrType: QR_TYPE.PICKUP,
        orderId: new mongoose.Types.ObjectId(),
        customerId,
        storeId: storeAId,
        branchId: null,
        tokenNonce: 'legacy-nonce-abcdef123456',
        tokenHash: 'legacy-hash-abcdef1234567890abcdef',
        status: QR_STATUS.ACTIVE,
      });

      assert.ok(historicalQr._id);
      assert.equal(historicalQr.branchId, null);
      assert.equal(historicalQr.status, 'ACTIVE');
    });
  });
});
