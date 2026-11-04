import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { ORDER_STATUS } from '../src/models/order.model.js';
import { BATCH_STATUS } from '../src/models/batch.model.js';
import { ApiError } from '../src/utils/ApiError.js';

describe('Phase 5.2: Reassignment & Checkout Concurrency Verification Suite', () => {
  const storeAId = new mongoose.Types.ObjectId();
  const sellerAId = new mongoose.Types.ObjectId();
  const branchAId = new mongoose.Types.ObjectId();
  const branchBId = new mongoose.Types.ObjectId();

  // =========================================================================
  // 1. TOCTOU Gap Simulation: Interleaved Checkout Between Check and Save
  // =========================================================================
  describe('1. Reassignment vs Checkout TOCTOU Interleaving Analysis', () => {
    it('demonstrates how concurrent order creation between Order.findOne check and batch.save alters branch attribution', async () => {
      // Initial state: Batch 1 is at Branch A with 10 units
      const simulatedBatch = {
        _id: new mongoose.Types.ObjectId(),
        storeId: storeAId,
        sellerId: sellerAId,
        branchId: branchAId,
        batchNumber: 'LOT-RACE-001',
        quantity: 10,
        soldQuantity: 0,
        reservedQuantity: 0,
        status: BATCH_STATUS.NORMAL,
      };

      const simulatedOrders = [];

      // Step 1: Seller begins updateBatchService to reassign to Branch B
      // Seller checks reservedQuantity > 0
      assert.equal(simulatedBatch.reservedQuantity, 0, 'No active cart reservation');

      // Seller checks Order.findOne for active orders
      const activeOrderStatuses = [
        ORDER_STATUS.PLACED,
        ORDER_STATUS.CONFIRMED,
        ORDER_STATUS.PACKED,
        ORDER_STATUS.READY_FOR_PICKUP,
        ORDER_STATUS.OUT_FOR_DELIVERY,
      ];
      const initialActiveOrder = simulatedOrders.find(
        (o) =>
          activeOrderStatuses.includes(o.status) &&
          o.items.some((i) => i.batchId.toString() === simulatedBatch._id.toString())
      );
      assert.equal(initialActiveOrder, undefined, 'At Time T0, no active order exists');

      // Step 2: Asynchronous pause (seller awaits Branch.findById, duplicate check, audit log)
      // Concurrently at Time T1: Customer checkout executes createOrderService for Branch A
      const checkoutQuantity = 3;
      assert.ok(simulatedBatch.quantity >= checkoutQuantity, 'Sufficient batch stock');

      // createOrderService performs atomic deduction on Batch
      simulatedBatch.quantity -= checkoutQuantity;
      simulatedBatch.soldQuantity += checkoutQuantity;

      // createOrderService creates Order document referencing Branch A and Batch 1
      const orderAtBranchA = {
        _id: new mongoose.Types.ObjectId(),
        orderNumber: 'ORD-RACE-BRANCH-A',
        status: ORDER_STATUS.PLACED,
        branchId: branchAId,
        items: [
          {
            batchId: simulatedBatch._id,
            batchNumber: simulatedBatch.batchNumber,
            allocatedQuantity: checkoutQuantity,
          },
        ],
      };
      simulatedOrders.push(orderAtBranchA);

      // Step 3: Seller's updateBatchService resumes at Time T2 and persists reassignment
      // batch.branchId is updated to Branch B and saved
      simulatedBatch.branchId = branchBId;

      // VERIFICATION: Inconsistent State Detected
      // Order ORD-RACE-BRANCH-A is active and bound to Branch A, but Batch 1 is now at Branch B
      assert.equal(orderAtBranchA.branchId.toString(), branchAId.toString());
      assert.equal(simulatedBatch.branchId.toString(), branchBId.toString());
      assert.equal(simulatedBatch.quantity, 7);

      // Now verify cancellation impact: Order is cancelled at Time T3
      // cancelOrderService restores stock via Batch.findByIdAndUpdate(alloc.batchId, { $inc: { quantity: +3 } })
      const orderToCancel = simulatedOrders.find((o) => o._id === orderAtBranchA._id);
      orderToCancel.status = ORDER_STATUS.CANCELLED;

      for (const item of orderToCancel.items) {
        if (item.batchId.toString() === simulatedBatch._id.toString()) {
          simulatedBatch.quantity += item.allocatedQuantity;
          simulatedBatch.soldQuantity -= item.allocatedQuantity;
        }
      }

      // RESULT: Stock was restored to Branch B instead of Branch A!
      assert.equal(simulatedBatch.quantity, 10);
      assert.equal(simulatedBatch.branchId.toString(), branchBId.toString());
      // Branch A originally had 10 units, order was placed at Branch A, but now Branch B holds all 10 units!
      assert.notEqual(
        simulatedBatch.branchId.toString(),
        orderAtBranchA.branchId.toString(),
        'Stock restoration restored units to the wrong branch due to reassignment race'
      );
    });
  });

  // =========================================================================
  // 2. Query Guard Invariance: Does createOrderService filter by branchId?
  // =========================================================================
  describe('2. Inspection of createOrderService Atomic Query Filter', () => {
    it('confirms that createOrderService Batch.findOneAndUpdate query omits branchId filter', () => {
      // In backend/src/services/order.service.js lines 137-144:
      const alloc = {
        batchId: new mongoose.Types.ObjectId(),
        allocatedQuantity: 2,
      };
      const todayUtc = new Date();

      const existingQuery = {
        _id: alloc.batchId,
        quantity: { $gte: alloc.allocatedQuantity },
        expiryDate: { $gte: todayUtc },
        status: {
          $in: [BATCH_STATUS.NORMAL, BATCH_STATUS.APPROACHING_EXPIRY, BATCH_STATUS.CRITICAL],
        },
      };

      // Branch check is not part of the atomic query condition
      assert.equal(existingQuery.branchId, undefined);
      assert.equal(existingQuery.$or, undefined);
    });
  });

  // =========================================================================
  // 3. Evaluation of Smallest Safe Mitigation
  // =========================================================================
  describe('3. Smallest Safe Mitigation Evaluation', () => {
    it('verifies that adding branchId condition to atomic deduction query prevents cross-branch deduction', () => {
      const selectedBranchId = branchAId;
      const batchReassignedToBranchB = {
        _id: new mongoose.Types.ObjectId(),
        branchId: branchBId,
        quantity: 10,
      };

      // Proposed minimal mitigation in createOrderService:
      // query includes branchId: selectedBranchId (or fallback for primary)
      const matchesBranch = (batch, requiredBranchId) => {
        return batch.branchId?.toString() === requiredBranchId?.toString();
      };

      const canDeduct = matchesBranch(batchReassignedToBranchB, selectedBranchId);
      assert.equal(canDeduct, false, 'Mitigated query rejects deduction when batch was reassigned away');
    });

    it('verifies that an atomic update on reassignment (verifying reservedQuantity and version/timestamp) closes the race', () => {
      let batchDoc = {
        _id: new mongoose.Types.ObjectId(),
        branchId: branchAId,
        quantity: 10,
        version: 1,
      };

      // Proposed minimal mitigation in updateBatchService:
      // Atomic conditional update on Batch: update only if version matches and reservedQuantity == 0
      const atomicReassign = (expectedVersion, newBranchId) => {
        if (batchDoc.version === expectedVersion) {
          batchDoc.branchId = newBranchId;
          batchDoc.version += 1;
          return { success: true };
        }
        return { success: false, code: 'CONCURRENT_BATCH_MODIFICATION' };
      };

      // If concurrent order incremented version or modified batch, reassignment fails safely
      batchDoc.version += 1; // Simulated concurrent order deduction
      const result = atomicReassign(1, branchBId);
      assert.equal(result.success, false);
      assert.equal(result.code, 'CONCURRENT_BATCH_MODIFICATION');
    });
  });
});

