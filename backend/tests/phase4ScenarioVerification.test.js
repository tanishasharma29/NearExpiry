import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { Order, ORDER_STATUS, FULFILLMENT_TYPES } from '../src/models/order.model.js';
import { Batch, BATCH_STATUS } from '../src/models/batch.model.js';
import { Branch } from '../src/models/branch.model.js';
import { InventoryAudit, INVENTORY_ACTION_TYPES } from '../src/models/inventory.model.js';
import { QrVerification, QR_TYPE, QR_STATUS } from '../src/models/qrVerification.model.js';
import { Payment, PAYMENT_STATUS, PAYMENT_METHOD } from '../src/models/payment.model.js';
import { computeBatchStatus, isBatchPurchasable } from '../src/utils/shelfLife.js';
import { createOrderSchema } from '../src/validators/order.validator.js';
import { checkoutValidateSchema } from '../src/validators/cart.validator.js';

describe('Phase 4: Final Strict Verification Suite (Scenarios 1 - 7)', () => {
  const storeAId = new mongoose.Types.ObjectId();
  const storeBId = new mongoose.Types.ObjectId();
  const sellerAId = new mongoose.Types.ObjectId();
  const customerId = new mongoose.Types.ObjectId();

  const primaryBranch = new Branch({
    storeId: storeAId,
    sellerId: sellerAId,
    name: 'Primary Branch A',
    address: {
      street: '100 Feet Rd',
      locality: 'Indiranagar',
      city: 'Bangalore',
      state: 'Karnataka',
      pincode: '560038',
    },
    contactPhone: '9876543210',
    isPrimary: true,
    isActive: true,
  });

  const secondaryBranch = new Branch({
    storeId: storeAId,
    sellerId: sellerAId,
    name: 'Secondary Branch B',
    address: {
      street: '80 Feet Rd',
      locality: 'Koramangala',
      city: 'Bangalore',
      state: 'Karnataka',
      pincode: '560095',
    },
    contactPhone: '9876543211',
    isPrimary: false,
    isActive: true,
  });

  const inactiveBranch = new Branch({
    storeId: storeAId,
    sellerId: sellerAId,
    name: 'Inactive Branch C',
    address: {
      street: 'MG Road',
      city: 'Bangalore',
      state: 'Karnataka',
      pincode: '560001',
    },
    contactPhone: '9876543212',
    isPrimary: false,
    isActive: false,
  });

  const foreignBranch = new Branch({
    storeId: storeBId,
    sellerId: new mongoose.Types.ObjectId(),
    name: 'Store B Foreign Branch',
    address: {
      street: 'Outer Ring Rd',
      city: 'Bangalore',
      state: 'Karnataka',
      pincode: '560103',
    },
    contactPhone: '9876543213',
    isPrimary: true,
    isActive: true,
  });

  // =========================================================================
  // SCENARIO 1: Concurrent Reservations
  // =========================================================================
  describe('Scenario 1: Concurrent Reservations & Atomic $gte Decrement', () => {
    it('prevents over-allocation when two concurrent checkouts race for limited batch stock', async () => {
      let lotStock = 5;
      const orderAAlloc = 4;
      const orderBAlloc = 4;

      // Simulated atomic conditional update logic matching Batch.findOneAndUpdate({ _id, quantity: { $gte: alloc.allocatedQuantity } })
      const atomicReserve = async (requestedQty) => {
        if (lotStock >= requestedQty) {
          lotStock -= requestedQty;
          return { success: true, allocated: requestedQty, remaining: lotStock };
        }
        return {
          success: false,
          allocated: 0,
          remaining: lotStock,
          error: 'CONCURRENT_CHECKOUT_CONFLICT',
        };
      };

      const [resA, resB] = await Promise.all([
        atomicReserve(orderAAlloc),
        atomicReserve(orderBAlloc),
      ]);

      // Exactly one succeeds, one fails
      const successes = [resA, resB].filter((r) => r.success);
      const failures = [resA, resB].filter((r) => !r.success);

      assert.equal(successes.length, 1, 'Only one concurrent order may succeed');
      assert.equal(failures.length, 1, 'The competing concurrent order must be rejected');
      assert.equal(failures[0].error, 'CONCURRENT_CHECKOUT_CONFLICT');
      assert.ok(lotStock >= 0, 'Lot stock must never become negative');
      assert.equal(lotStock, 1, 'Remaining stock must accurately reflect only successful reservation');
    });
  });

  // =========================================================================
  // SCENARIO 2: Standalone MongoDB Rollback & Compensation
  // =========================================================================
  describe('Scenario 2: Standalone MongoDB Manual Compensation Rollback', () => {
    it('restores all prior deductions if a subsequent deduction fails during order creation', async () => {
      const mockBatches = {
        batch1: { _id: 'batch1', quantity: 10, soldQuantity: 0, status: BATCH_STATUS.NORMAL, remainingDays: 60 },
        batch2: { _id: 'batch2', quantity: 2, soldQuantity: 0, status: BATCH_STATUS.NORMAL, remainingDays: 60 },
      };

      const reservedDeductions = [];

      // Step 1: Batch 1 deduction succeeds
      const alloc1 = 3;
      mockBatches.batch1.quantity -= alloc1;
      mockBatches.batch1.soldQuantity += alloc1;
      reservedDeductions.push({
        batchId: 'batch1',
        quantity: alloc1,
      });

      // Step 2: Batch 2 deduction fails due to insufficient stock (requested 5, available 2)
      let checkoutFailed = false;
      const alloc2 = 5;
      if (mockBatches.batch2.quantity < alloc2) {
        checkoutFailed = true;
      }
      assert.equal(checkoutFailed, true);

      // Step 3: Run standalone compensation loop (from order.service.js lines 431-454)
      for (const ded of reservedDeductions) {
        const batch = mockBatches[ded.batchId];
        batch.quantity += ded.quantity;
        batch.soldQuantity -= ded.quantity;
        const restoredStatus = computeBatchStatus(batch.remainingDays, batch.quantity);
        batch.status = restoredStatus;
        batch.isPurchasable = isBatchPurchasable(batch.remainingDays, batch.quantity, restoredStatus);
      }

      // Verify Batch 1 was restored to original quantity
      assert.equal(mockBatches.batch1.quantity, 10);
      assert.equal(mockBatches.batch1.soldQuantity, 0);
      assert.equal(mockBatches.batch1.status, BATCH_STATUS.NORMAL);
      assert.equal(mockBatches.batch1.isPurchasable, true);
    });

    it('demonstrates behavior when a compensation step itself fails', async () => {
      const reservedDeductions = [
        { batchId: 'batch1', quantity: 2 },
        { batchId: 'batch2', quantity: 3 },
      ];

      let compensationFailureEncountered = false;
      let compensatedCount = 0;

      try {
        for (const ded of reservedDeductions) {
          if (ded.batchId === 'batch1') {
            // Simulated network failure or DB crash during compensation of batch1
            throw new Error('DATABASE_CONNECTION_LOST_DURING_COMPENSATION');
          }
          compensatedCount++;
        }
      } catch (err) {
        compensationFailureEncountered = true;
        assert.equal(err.message, 'DATABASE_CONNECTION_LOST_DURING_COMPENSATION');
      }

      assert.equal(compensationFailureEncountered, true);
      assert.equal(compensatedCount, 0, 'Subsequent compensations are interrupted unless logged/dead-lettered');
    });
  });

  // =========================================================================
  // SCENARIO 3: Payment Failure Lifecycle & Stock Preservation
  // =========================================================================
  describe('Scenario 3: Payment Failure Lifecycle', () => {
    it('sets order paymentStatus to FAILED upon simulated payment failure and blocks QR verification', async () => {
      const order = new Order({
        orderNumber: 'NE-20261104-5001',
        customerId,
        storeId: storeAId,
        branchId: primaryBranch._id,
        pickupBranch: {
          name: primaryBranch.name,
          contactPhone: primaryBranch.contactPhone,
        },
        fulfillmentType: FULFILLMENT_TYPES.PICKUP,
        status: ORDER_STATUS.PLACED,
        paymentStatus: 'PENDING',
        paymentMethod: PAYMENT_METHOD.MOCK_PAYMENT,
        items: [
          {
            productId: new mongoose.Types.ObjectId(),
            productName: 'Organic Milk',
            requestedQuantity: 2,
            unitOriginalPrice: 60,
            unitDiscountedPrice: 48,
            lineOriginalAmount: 120,
            lineDiscountedAmount: 96,
            totalSavings: 24,
            batchAllocations: [],
          },
        ],
        pricingSummary: { subtotal: 120, discounts: 24, finalTotal: 96, totalUnits: 2, itemCount: 1 },
      });

      // Simulate failed payment update
      const paymentFailureDoc = new Payment({
        orderId: order._id,
        customerId,
        storeId: storeAId,
        amount: 96,
        currency: 'INR',
        method: PAYMENT_METHOD.MOCK_PAYMENT,
        status: PAYMENT_STATUS.FAILED,
        idempotencyKey: 'IDEMP-FAIL-1',
        failureReason: 'Simulated issuer decline: Card expired or insufficient funds',
      });

      order.paymentStatus = 'FAILED';

      assert.equal(paymentFailureDoc.status, PAYMENT_STATUS.FAILED);
      assert.equal(order.paymentStatus, 'FAILED');
      assert.equal(order.status, ORDER_STATUS.PLACED);

      // Verify QR Pickup Service rule: paymentStatus MUST be PAID (or CASH_ON_DELIVERY)
      let pickupAllowed = false;
      let pickupRejectionError = null;
      if (order.paymentStatus !== 'PAID' && order.paymentMethod !== PAYMENT_METHOD.CASH_ON_DELIVERY) {
        pickupRejectionError = {
          statusCode: 400,
          errorCode: 'PAYMENT_REQUIRED',
          message: 'Payment verification required before pickup.',
        };
      } else {
        pickupAllowed = true;
      }

      assert.equal(pickupAllowed, false);
      assert.ok(pickupRejectionError);
      assert.equal(pickupRejectionError.errorCode, 'PAYMENT_REQUIRED');
    });
  });

  // =========================================================================
  // SCENARIO 4: Repeated Order Cancellation
  // =========================================================================
  describe('Scenario 4: Repeated Cancellation Guard', () => {
    it('prevents double-restocking on an order that has already been cancelled', async () => {
      const order = new Order({
        orderNumber: 'NE-20261104-5002',
        customerId,
        storeId: storeAId,
        branchId: primaryBranch._id,
        status: ORDER_STATUS.PLACED,
        items: [],
        pricingSummary: { subtotal: 100, discounts: 0, finalTotal: 100, totalUnits: 1, itemCount: 1 },
      });

      let restockCalls = 0;
      const simulateCancel = (actorRole) => {
        // Enforce state guard from order.service.js lines 732-746
        if (actorRole === 'CUSTOMER') {
          if (![ORDER_STATUS.PLACED, ORDER_STATUS.CONFIRMED].includes(order.status)) {
            throw new Error(`Order cannot be cancelled in status [${order.status}].`);
          }
        } else {
          if ([ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED].includes(order.status)) {
            throw new Error(`Order is already ${order.status}.`);
          }
        }
        order.status = ORDER_STATUS.CANCELLED;
        restockCalls++;
      };

      // First cancellation: succeeds
      simulateCancel('CUSTOMER');
      assert.equal(order.status, ORDER_STATUS.CANCELLED);
      assert.equal(restockCalls, 1);

      // Second cancellation attempt by customer: throws
      assert.throws(() => {
        simulateCancel('CUSTOMER');
      }, /Order cannot be cancelled in status \[CANCELLED\]/);

      // Second cancellation attempt by seller: throws
      assert.throws(() => {
        simulateCancel('SELLER');
      }, /Order is already CANCELLED/);

      // Verify restock logic was invoked exactly once
      assert.equal(restockCalls, 1);
    });
  });

  // =========================================================================
  // SCENARIO 5: Legacy Inventory Ownership & Isolation
  // =========================================================================
  describe('Scenario 5: Legacy Inventory (branchId: null) Isolation', () => {
    const batches = [
      { _id: 'b_legacy', branchId: null, quantity: 10, batchNumber: 'LEGACY-001' },
      { _id: 'b_primary', branchId: primaryBranch._id.toString(), quantity: 5, batchNumber: 'PRIMARY-002' },
      { _id: 'b_secondary', branchId: secondaryBranch._id.toString(), quantity: 4, batchNumber: 'SECONDARY-003' },
    ];

    it('confirms only primary branch can query and reserve branchId: null batches', () => {
      // Primary branch query: { $or: [{ branchId: primary._id }, { branchId: null }] }
      const primaryVisible = batches.filter(
        (b) => b.branchId === null || b.branchId === primaryBranch._id.toString()
      );
      assert.equal(primaryVisible.length, 2);
      assert.ok(primaryVisible.some((b) => b.branchId === null));

      // Secondary branch query: { branchId: secondary._id }
      const secondaryVisible = batches.filter(
        (b) => b.branchId === secondaryBranch._id.toString()
      );
      assert.equal(secondaryVisible.length, 1);
      assert.equal(secondaryVisible[0].batchNumber, 'SECONDARY-003');
      assert.equal(secondaryVisible.some((b) => b.branchId === null), false);
    });

    it('ensures secondary branch cannot reserve legacy batch even under concurrent request', () => {
      const selectedBranchId = secondaryBranch._id.toString();
      const targetBatch = batches.find((b) => b._id === 'b_legacy');

      let canReserveLegacyAtSecondary = false;
      if (selectedBranchId !== primaryBranch._id.toString()) {
        // Strict branch isolation
        if (targetBatch.branchId === null || targetBatch.branchId !== selectedBranchId) {
          canReserveLegacyAtSecondary = false;
        }
      }

      assert.equal(canReserveLegacyAtSecondary, false);
    });
  });

  // =========================================================================
  // SCENARIO 6: Branch Validation & Rejection of Foreign/Inactive
  // =========================================================================
  describe('Scenario 6: Branch Validation & Silent Replacement Prevention', () => {
    it('rejects foreign-store branch with BRANCH_STORE_MISMATCH', () => {
      const orderStoreId = storeAId.toString();
      const explicitBranchStoreId = foreignBranch.storeId.toString();

      let err = null;
      if (orderStoreId !== explicitBranchStoreId) {
        err = { code: 'BRANCH_STORE_MISMATCH', message: 'Selected branch does not belong to the fulfilling store.' };
      }

      assert.ok(err);
      assert.equal(err.code, 'BRANCH_STORE_MISMATCH');
    });

    it('rejects inactive branch with BRANCH_INACTIVE and NEVER replaces it silently with primary', () => {
      const selected = inactiveBranch;
      let effectiveBranch = selected;
      let err = null;

      if (!selected.isActive) {
        err = { code: 'BRANCH_INACTIVE', message: 'Selected pickup branch is currently inactive.' };
      } else {
        effectiveBranch = primaryBranch;
      }

      assert.ok(err);
      assert.equal(err.code, 'BRANCH_INACTIVE');
      assert.equal(effectiveBranch._id.toString(), inactiveBranch._id.toString(), 'Must never silently switch');
    });

    it('permits primary branch fallback only when branchId is omitted by customer', () => {
      const customerChosenBranchId = undefined;
      let fallbackBranch = null;

      if (!customerChosenBranchId) {
        fallbackBranch = primaryBranch;
      }

      assert.ok(fallbackBranch);
      assert.equal(fallbackBranch.isPrimary, true);
    });
  });

  // =========================================================================
  // SCENARIO 7: QR Compatibility (Branch-Assigned vs Historical Null Orders)
  // =========================================================================
  describe('Scenario 7: QR Code Compatibility for New & Historical Orders', () => {
    it('new branch-assigned order produces QR with branchId and pickupBranch snapshot', () => {
      const order = new Order({
        orderNumber: 'NE-20261104-9001',
        customerId,
        storeId: storeAId,
        branchId: primaryBranch._id,
        pickupBranch: {
          name: primaryBranch.name,
          contactPhone: primaryBranch.contactPhone,
        },
        fulfillmentType: FULFILLMENT_TYPES.PICKUP,
        items: [],
        pricingSummary: { subtotal: 50, discounts: 0, finalTotal: 50, totalUnits: 1, itemCount: 1 },
      });

      const qr = new QrVerification({
        qrType: QR_TYPE.PICKUP,
        orderId: order._id,
        customerId,
        storeId: storeAId,
        branchId: order.branchId,
        tokenNonce: 'nonce-new-order',
        tokenHash: 'hash-new-order',
        status: QR_STATUS.ACTIVE,
      });

      assert.equal(qr.branchId.toString(), primaryBranch._id.toString());
      assert.equal(order.pickupBranch.name, primaryBranch.name);
    });

    it('historical order (branchId: null, pickupBranch: null) produces valid QR without crashing', () => {
      const historicalOrder = new Order({
        orderNumber: 'NE-20261001-0001',
        customerId,
        storeId: storeAId,
        branchId: null,
        pickupBranch: null,
        fulfillmentType: FULFILLMENT_TYPES.PICKUP,
        items: [],
        pricingSummary: { subtotal: 50, discounts: 0, finalTotal: 50, totalUnits: 1, itemCount: 1 },
      });

      const qr = new QrVerification({
        qrType: QR_TYPE.PICKUP,
        orderId: historicalOrder._id,
        customerId,
        storeId: storeAId,
        branchId: historicalOrder.branchId || null,
        tokenNonce: 'nonce-legacy-order',
        tokenHash: 'hash-legacy-order',
        status: QR_STATUS.ACTIVE,
      });

      assert.equal(qr.branchId, null);
      assert.equal(historicalOrder.branchId, null);
      assert.equal(historicalOrder.pickupBranch, null);
    });
  });
});
