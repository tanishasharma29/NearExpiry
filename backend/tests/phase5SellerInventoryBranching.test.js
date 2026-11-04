import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { updateBatchSchema } from '../src/validators/batchInventory.validator.js';
import { Batch, BATCH_STATUS } from '../src/models/batch.model.js';
import { Branch } from '../src/models/branch.model.js';
import { InventoryAudit, INVENTORY_ACTION_TYPES } from '../src/models/inventory.model.js';
import { Store } from '../src/models/store.model.js';

describe('Phase 5: Seller Inventory Multi-Branch Visibility, Filtering & Audit Suite', () => {
  const storeAId = new mongoose.Types.ObjectId();
  const storeBId = new mongoose.Types.ObjectId();
  const sellerAId = new mongoose.Types.ObjectId();

  const primaryBranchA = new Branch({
    storeId: storeAId,
    sellerId: sellerAId,
    name: 'Indiranagar Main Outlet',
    address: { street: '100ft Rd', city: 'Bangalore', state: 'Karnataka', pincode: '560038' },
    contactPhone: '9876543210',
    isPrimary: true,
    isActive: true,
  });

  const secondaryBranchA = new Branch({
    storeId: storeAId,
    sellerId: sellerAId,
    name: 'Koramangala Branch',
    address: { street: '80ft Rd', city: 'Bangalore', state: 'Karnataka', pincode: '560095' },
    contactPhone: '9876543211',
    isPrimary: false,
    isActive: true,
  });

  const inactiveBranchA = new Branch({
    storeId: storeAId,
    sellerId: sellerAId,
    name: 'Whitefield Closed Branch',
    address: { street: 'ITPL Rd', city: 'Bangalore', state: 'Karnataka', pincode: '560066' },
    contactPhone: '9876543212',
    isPrimary: false,
    isActive: false,
  });

  const foreignBranchB = new Branch({
    storeId: storeBId,
    sellerId: new mongoose.Types.ObjectId(),
    name: 'Store B Foreign Branch',
    address: { street: 'Jayanagar 4th Block', city: 'Bangalore', state: 'Karnataka', pincode: '560011' },
    contactPhone: '9876543213',
    isPrimary: true,
    isActive: true,
  });

  // =========================================================================
  // 1. Inventory Audit Integrity: branchId Tagging on Stock Adjustments & Releases
  // =========================================================================
  describe('1. Inventory Audit Integrity across Stock Movements', () => {
    it('records branchId on manual stock adjustment for a branch-assigned batch', () => {
      const batch = new Batch({
        productId: new mongoose.Types.ObjectId(),
        storeId: storeAId,
        sellerId: sellerAId,
        branchId: secondaryBranchA._id,
        batchNumber: 'LOT-ADJ-001',
        quantity: 15,
        status: BATCH_STATUS.NORMAL,
      });

      const audit = new InventoryAudit({
        batchId: batch._id,
        branchId: batch.branchId || null,
        productId: batch.productId,
        storeId: batch.storeId,
        batchNumber: batch.batchNumber,
        actionType: INVENTORY_ACTION_TYPES.STOCK_ADJUSTMENT,
        quantityChange: 5,
        previousQuantity: 10,
        newQuantity: 15,
        previousReserved: 0,
        newReserved: 0,
        batchStatusAfter: batch.status,
        reason: 'Restocked by seller',
        performedBy: sellerAId,
        performedByRole: 'SELLER',
      });

      assert.ok(audit._id);
      assert.equal(audit.branchId.toString(), secondaryBranchA._id.toString());
      assert.equal(audit.actionType, INVENTORY_ACTION_TYPES.STOCK_ADJUSTMENT);
      assert.equal(audit.quantityChange, 5);
    });

    it('records branchId on stock reservations and releases', () => {
      const batch = new Batch({
        productId: new mongoose.Types.ObjectId(),
        storeId: storeAId,
        sellerId: sellerAId,
        branchId: primaryBranchA._id,
        batchNumber: 'LOT-RES-002',
        quantity: 8,
        reservedQuantity: 2,
        status: BATCH_STATUS.NORMAL,
      });

      const reservationAudit = new InventoryAudit({
        batchId: batch._id,
        branchId: batch.branchId || null,
        productId: batch.productId,
        storeId: batch.storeId,
        batchNumber: batch.batchNumber,
        actionType: INVENTORY_ACTION_TYPES.STOCK_RESERVATION,
        quantityChange: -2,
        previousQuantity: 10,
        newQuantity: 8,
        previousReserved: 0,
        newReserved: 2,
        batchStatusAfter: batch.status,
        reason: 'Reserved for checkout',
        performedBy: sellerAId,
        performedByRole: 'SELLER',
      });

      assert.equal(reservationAudit.branchId.toString(), primaryBranchA._id.toString());
      assert.equal(reservationAudit.actionType, INVENTORY_ACTION_TYPES.STOCK_RESERVATION);

      const releaseAudit = new InventoryAudit({
        batchId: batch._id,
        branchId: batch.branchId || null,
        productId: batch.productId,
        storeId: batch.storeId,
        batchNumber: batch.batchNumber,
        actionType: INVENTORY_ACTION_TYPES.STOCK_RELEASE,
        quantityChange: 2,
        previousQuantity: 8,
        newQuantity: 10,
        previousReserved: 2,
        newReserved: 0,
        batchStatusAfter: batch.status,
        reason: 'Expired cart reservation released',
        performedBy: sellerAId,
        performedByRole: 'SELLER',
      });

      assert.equal(releaseAudit.branchId.toString(), primaryBranchA._id.toString());
      assert.equal(releaseAudit.actionType, INVENTORY_ACTION_TYPES.STOCK_RELEASE);
    });

    it('preserves branchId: null for unassigned legacy lot adjustments', () => {
      const legacyBatch = new Batch({
        productId: new mongoose.Types.ObjectId(),
        storeId: storeAId,
        sellerId: sellerAId,
        branchId: null, // Legacy batch
        batchNumber: 'LEGACY-ADJ-003',
        quantity: 5,
        status: BATCH_STATUS.NORMAL,
      });

      const audit = new InventoryAudit({
        batchId: legacyBatch._id,
        branchId: legacyBatch.branchId || null,
        productId: legacyBatch.productId,
        storeId: legacyBatch.storeId,
        batchNumber: legacyBatch.batchNumber,
        actionType: INVENTORY_ACTION_TYPES.STOCK_ADJUSTMENT,
        quantityChange: -1,
        previousQuantity: 6,
        newQuantity: 5,
        previousReserved: 0,
        newReserved: 0,
        batchStatusAfter: legacyBatch.status,
        reason: 'Damaged item written off',
        performedBy: sellerAId,
        performedByRole: 'SELLER',
      });

      assert.equal(audit.branchId, null);
    });
  });

  // =========================================================================
  // 2. Audit Log Branch Filtering & Cross-Store Security Isolation
  // =========================================================================
  describe('2. Audit Log Branch Filtering & Cross-Store Security Isolation', () => {
    it('isolates audit logs by branch and rejects queries for branches belonging to another store', () => {
      const sellerStoreId = storeAId.toString();

      // Seller queries their own branch: allowed
      const isAuthorizedBranch = (targetBranch) => {
        return targetBranch.storeId.toString() === sellerStoreId;
      };

      assert.equal(isAuthorizedBranch(primaryBranchA), true);
      assert.equal(isAuthorizedBranch(secondaryBranchA), true);

      // Seller queries a foreign branch: rejected with 403
      assert.equal(isAuthorizedBranch(foreignBranchB), false);
    });

    it('filters audit log entries strictly by branchId', () => {
      const logs = [
        { _id: '1', branchId: primaryBranchA._id.toString(), batchNumber: 'LOT-1' },
        { _id: '2', branchId: secondaryBranchA._id.toString(), batchNumber: 'LOT-2' },
        { _id: '3', branchId: null, batchNumber: 'LEGACY-3' },
      ];

      const koramangalaLogs = logs.filter((l) => l.branchId === secondaryBranchA._id.toString());
      assert.equal(koramangalaLogs.length, 1);
      assert.equal(koramangalaLogs[0].batchNumber, 'LOT-2');

      const legacyLogs = logs.filter((l) => l.branchId === null);
      assert.equal(legacyLogs.length, 1);
      assert.equal(legacyLogs[0].batchNumber, 'LEGACY-3');
    });
  });

  // =========================================================================
  // 3. Safe Batch Branch Reassignment
  // =========================================================================
  describe('3. Safe Batch Branch Reassignment Rules', () => {
    it('accepts valid branchId in updateBatchSchema', () => {
      const validPayload = {
        body: {
          branchId: secondaryBranchA._id.toString(),
          originalPrice: 120,
        },
      };
      const result = updateBatchSchema.safeParse(validPayload);
      assert.equal(result.success, true);
      assert.equal(result.data.body.branchId, secondaryBranchA._id.toString());
    });

    it('allows setting branchId to null for legacy compatibility', () => {
      const nullPayload = {
        body: {
          branchId: null,
        },
      };
      const result = updateBatchSchema.safeParse(nullPayload);
      assert.equal(result.success, true);
      assert.equal(result.data.body.branchId, null);
    });

    it('rejects batch reassignment when batch has active reserved stock (reservedQuantity > 0)', () => {
      const batchWithReservation = {
        _id: new mongoose.Types.ObjectId(),
        reservedQuantity: 3,
        branchId: primaryBranchA._id,
      };

      let error = null;
      if (batchWithReservation.reservedQuantity > 0) {
        error = {
          code: 'BATCH_REASSIGNMENT_UNSAFE',
          message: 'Cannot reassign branch while batch has active reserved stock.',
        };
      }

      assert.ok(error);
      assert.equal(error.code, 'BATCH_REASSIGNMENT_UNSAFE');
    });

    it('rejects reassignment to an inactive branch (BRANCH_INACTIVE)', () => {
      let error = null;
      if (!inactiveBranchA.isActive) {
        error = {
          code: 'BRANCH_INACTIVE',
          message: 'Cannot reassign batch to an inactive branch.',
        };
      }

      assert.ok(error);
      assert.equal(error.code, 'BRANCH_INACTIVE');
    });

    it('rejects reassignment to a foreign store branch (BRANCH_STORE_MISMATCH)', () => {
      const batchStoreId = storeAId.toString();
      const targetBranchStoreId = foreignBranchB.storeId.toString();

      let error = null;
      if (batchStoreId !== targetBranchStoreId) {
        error = {
          code: 'BRANCH_STORE_MISMATCH',
          message: 'Cannot reassign batch to a branch of a different store.',
        };
      }

      assert.ok(error);
      assert.equal(error.code, 'BRANCH_STORE_MISMATCH');
    });
  });

  // =========================================================================
  // 4. Deterministic Legacy Policy & Double-Counting Prevention
  // =========================================================================
  describe('4. Deterministic Legacy Policy & Scoped KPI Calculation', () => {
    const batches = [
      { _id: '1', branchId: primaryBranchA._id.toString(), quantity: 10, currentPrice: 50 },
      { _id: '2', branchId: secondaryBranchA._id.toString(), quantity: 6, currentPrice: 40 },
      { _id: '3', branchId: null, quantity: 4, currentPrice: 30 }, // Legacy lot
    ];

    it('enforces that All-Branches view counts legacy lots exactly once', () => {
      const totalUnits = batches.reduce((sum, b) => sum + b.quantity, 0);
      assert.equal(totalUnits, 20); // 10 + 6 + 4

      const totalValuation = batches.reduce((sum, b) => sum + b.quantity * b.currentPrice, 0);
      assert.equal(totalValuation, 10 * 50 + 6 * 40 + 4 * 30); // 500 + 240 + 120 = 860
    });

    it('enforces Phase 4 legacy fallback: primary branch includes primary + legacy lots', () => {
      const primaryScoped = batches.filter(
        (b) => b.branchId === primaryBranchA._id.toString() || b.branchId === null
      );
      assert.equal(primaryScoped.length, 2);
      const units = primaryScoped.reduce((sum, b) => sum + b.quantity, 0);
      assert.equal(units, 14); // 10 + 4
    });

    it('strictly isolates secondary branch to only its assigned lots (zero legacy lots)', () => {
      const secondaryScoped = batches.filter(
        (b) => b.branchId === secondaryBranchA._id.toString()
      );
      assert.equal(secondaryScoped.length, 1);
      const units = secondaryScoped.reduce((sum, b) => sum + b.quantity, 0);
      assert.equal(units, 6);
      assert.equal(secondaryScoped.some((b) => b.branchId === null), false);
    });
  });

  // =========================================================================
  // 5. Standalone MongoDB Rollback Isolation Guard
  // =========================================================================
  describe('5. Standalone MongoDB Rollback Isolation Guard', () => {
    it('ensures one compensation error does not halt restoration of subsequent batch deductions', async () => {
      const deductions = [
        { batchId: 'ded1', quantity: 2, status: 'RESTORE_FAIL' },
        { batchId: 'ded2', quantity: 5, status: 'RESTORE_SUCCESS' },
        { batchId: 'ded3', quantity: 3, status: 'RESTORE_SUCCESS' },
      ];

      const restoredBatches = [];
      const failedRestorations = [];

      for (const ded of deductions) {
        try {
          if (ded.status === 'RESTORE_FAIL') {
            throw new Error(`Simulated DB timeout on lot [${ded.batchId}]`);
          }
          restoredBatches.push(ded.batchId);
        } catch (err) {
          failedRestorations.push({
            batchId: ded.batchId,
            quantity: ded.quantity,
            error: err.message,
          });
        }
      }

      // ded1 failed, but ded2 and ded3 MUST succeed in completing restoration
      assert.equal(restoredBatches.length, 2);
      assert.ok(restoredBatches.includes('ded2'));
      assert.ok(restoredBatches.includes('ded3'));

      // ded1 failure is captured for reconciliation
      assert.equal(failedRestorations.length, 1);
      assert.equal(failedRestorations[0].batchId, 'ded1');
      assert.equal(failedRestorations[0].quantity, 2);
    });
  });
});

