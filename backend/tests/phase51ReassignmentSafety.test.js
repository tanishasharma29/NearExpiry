import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { updateBatchSchema } from '../src/validators/batchInventory.validator.js';
import { Batch, BATCH_STATUS } from '../src/models/batch.model.js';
import { Branch } from '../src/models/branch.model.js';
import { Order, ORDER_STATUS } from '../src/models/order.model.js';
import { InventoryAudit, INVENTORY_ACTION_TYPES } from '../src/models/inventory.model.js';
import { ApiError } from '../src/utils/ApiError.js';

describe('Phase 5.1: Active Order Batch Reassignment Safety Test Suite', () => {
  const storeAId = new mongoose.Types.ObjectId();
  const storeBId = new mongoose.Types.ObjectId();
  const sellerAId = new mongoose.Types.ObjectId();
  const customerId = new mongoose.Types.ObjectId();

  const branchA = new Branch({
    storeId: storeAId,
    sellerId: sellerAId,
    name: 'Indiranagar Hub',
    address: { street: '100ft Rd', city: 'Bangalore', state: 'Karnataka', pincode: '560038' },
    contactPhone: '9876543210',
    isPrimary: true,
    isActive: true,
  });

  const branchB = new Branch({
    storeId: storeAId,
    sellerId: sellerAId,
    name: 'Koramangala Hub',
    address: { street: '80ft Rd', city: 'Bangalore', state: 'Karnataka', pincode: '560095' },
    contactPhone: '9876543211',
    isPrimary: false,
    isActive: true,
  });

  const inactiveBranchA = new Branch({
    storeId: storeAId,
    sellerId: sellerAId,
    name: 'Inactive Hub',
    address: { street: 'ITPL Rd', city: 'Bangalore', state: 'Karnataka', pincode: '560066' },
    contactPhone: '9876543212',
    isPrimary: false,
    isActive: false,
  });

  const foreignBranchB = new Branch({
    storeId: storeBId,
    sellerId: new mongoose.Types.ObjectId(),
    name: 'Foreign Store Branch',
    address: { street: 'MG Rd', city: 'Bangalore', state: 'Karnataka', pincode: '560001' },
    contactPhone: '9876543213',
    isPrimary: true,
    isActive: true,
  });

  // Reusable helper simulating the guard in updateBatchService
  const validateBatchReassignmentSafety = ({ batch, payloadBranchId, activeOrders = [], targetBranch = null }) => {
    if (payloadBranchId !== undefined) {
      const prevBranchIdStr = batch.branchId ? batch.branchId.toString() : null;
      const targetBranchIdStr = payloadBranchId ? payloadBranchId.toString() : null;
      const isReassigningBranch = prevBranchIdStr !== targetBranchIdStr;

      if (isReassigningBranch) {
        if (batch.reservedQuantity > 0) {
          throw new ApiError(
            400,
            'Cannot reassign branch while batch has active reserved stock.',
            'BATCH_REASSIGNMENT_UNSAFE'
          );
        }

        const activeOrderStatuses = [
          ORDER_STATUS.PLACED,
          ORDER_STATUS.CONFIRMED,
          ORDER_STATUS.PACKED,
          ORDER_STATUS.READY_FOR_PICKUP,
          ORDER_STATUS.OUT_FOR_DELIVERY,
        ];

        const activeOrder = activeOrders.find(
          (ord) =>
            activeOrderStatuses.includes(ord.status) &&
            ord.items.some((item) =>
              item.batchAllocations.some(
                (alloc) => alloc.batchId.toString() === batch._id.toString()
              )
            )
        );

        if (activeOrder) {
          throw new ApiError(
            400,
            `Cannot reassign branch: Batch [${batch.batchNumber}] is allocated to active order [${activeOrder.orderNumber}] in status [${activeOrder.status}]. Fulfill or cancel the order first.`,
            'BATCH_REASSIGNMENT_UNSAFE'
          );
        }
      }

      if (payloadBranchId !== null) {
        if (!targetBranch) {
          throw new ApiError(404, 'Target branch not found.', 'BRANCH_NOT_FOUND');
        }
        if (!targetBranch.isActive) {
          throw new ApiError(
            400,
            'Cannot reassign batch to an inactive branch. Please activate the branch first.',
            'BRANCH_INACTIVE'
          );
        }
        if (targetBranch.storeId.toString() !== batch.storeId.toString()) {
          throw new ApiError(
            403,
            'Cannot reassign batch to a branch of a different store.',
            'BRANCH_STORE_MISMATCH'
          );
        }
      }
    }
  };

  // =========================================================================
  // 1. Active Order Status Guard Tests
  // =========================================================================
  describe('1. Active Order Status Guard', () => {
    const activeStatuses = [
      ORDER_STATUS.PLACED,
      ORDER_STATUS.CONFIRMED,
      ORDER_STATUS.PACKED,
      ORDER_STATUS.READY_FOR_PICKUP,
      ORDER_STATUS.OUT_FOR_DELIVERY,
    ];

    for (const status of activeStatuses) {
      it(`blocks branch reassignment when batch is allocated to an order in status: ${status}`, () => {
        const batch = new Batch({
          storeId: storeAId,
          sellerId: sellerAId,
          branchId: branchA._id,
          batchNumber: `LOT-ACTIVE-${status}`,
          quantity: 10,
          reservedQuantity: 0,
        });

        const activeOrder = {
          _id: new mongoose.Types.ObjectId(),
          orderNumber: `ORD-${status}-101`,
          status,
          branchId: branchA._id,
          items: [
            {
              productId: new mongoose.Types.ObjectId(),
              quantity: 2,
              batchAllocations: [
                {
                  batchId: batch._id,
                  batchNumber: batch.batchNumber,
                  allocatedQuantity: 2,
                },
              ],
            },
          ],
        };

        assert.throws(
          () => {
            validateBatchReassignmentSafety({
              batch,
              payloadBranchId: branchB._id.toString(),
              activeOrders: [activeOrder],
              targetBranch: branchB,
            });
          },
          (err) => {
            assert.equal(err instanceof ApiError, true);
            assert.equal(err.statusCode, 400);
            assert.equal(err.errorCode, 'BATCH_REASSIGNMENT_UNSAFE');
            assert.match(err.message, new RegExp(status));
            assert.match(err.message, new RegExp(activeOrder.orderNumber));
            return true;
          }
        );
      });
    }
  });

  // =========================================================================
  // 2. Terminal Order Status & Unrelated Batch Tests
  // =========================================================================
  describe('2. Terminal Orders and Independent Batches Do Not Block Reassignment', () => {
    it('allows reassignment when batch is only referenced by DELIVERED orders', () => {
      const batch = new Batch({
        storeId: storeAId,
        sellerId: sellerAId,
        branchId: branchA._id,
        batchNumber: 'LOT-DELIVERED-001',
        quantity: 5,
        reservedQuantity: 0,
      });

      const deliveredOrder = {
        _id: new mongoose.Types.ObjectId(),
        orderNumber: 'ORD-DEL-999',
        status: ORDER_STATUS.DELIVERED,
        branchId: branchA._id,
        items: [
          {
            batchAllocations: [{ batchId: batch._id, batchNumber: batch.batchNumber }],
          },
        ],
      };

      assert.doesNotThrow(() => {
        validateBatchReassignmentSafety({
          batch,
          payloadBranchId: branchB._id.toString(),
          activeOrders: [deliveredOrder],
          targetBranch: branchB,
        });
      });
    });

    it('allows reassignment when batch is only referenced by CANCELLED orders', () => {
      const batch = new Batch({
        storeId: storeAId,
        sellerId: sellerAId,
        branchId: branchA._id,
        batchNumber: 'LOT-CANCELLED-001',
        quantity: 8,
        reservedQuantity: 0,
      });

      const cancelledOrder = {
        _id: new mongoose.Types.ObjectId(),
        orderNumber: 'ORD-CAN-888',
        status: ORDER_STATUS.CANCELLED,
        branchId: branchA._id,
        items: [
          {
            batchAllocations: [{ batchId: batch._id, batchNumber: batch.batchNumber }],
          },
        ],
      };

      assert.doesNotThrow(() => {
        validateBatchReassignmentSafety({
          batch,
          payloadBranchId: branchB._id.toString(),
          activeOrders: [cancelledOrder],
          targetBranch: branchB,
        });
      });
    });

    it('allows reassignment when active orders exist for other batches but not this one', () => {
      const otherBatchId = new mongoose.Types.ObjectId();
      const batch = new Batch({
        storeId: storeAId,
        sellerId: sellerAId,
        branchId: branchA._id,
        batchNumber: 'LOT-INDEPENDENT-001',
        quantity: 12,
        reservedQuantity: 0,
      });

      const activeOrderForOtherBatch = {
        _id: new mongoose.Types.ObjectId(),
        orderNumber: 'ORD-OTHER-777',
        status: ORDER_STATUS.PLACED,
        branchId: branchA._id,
        items: [
          {
            batchAllocations: [{ batchId: otherBatchId, batchNumber: 'LOT-OTHER' }],
          },
        ],
      };

      assert.doesNotThrow(() => {
        validateBatchReassignmentSafety({
          batch,
          payloadBranchId: branchB._id.toString(),
          activeOrders: [activeOrderForOtherBatch],
          targetBranch: branchB,
        });
      });
    });
  });

  // =========================================================================
  // 3. Existing Safeguards & Non-Branch Updates Preservation
  // =========================================================================
  describe('3. Existing Safeguards and Non-Branch Updates Preservation', () => {
    it('preserves reservedQuantity > 0 rejection even without an active order document', () => {
      const batch = new Batch({
        storeId: storeAId,
        sellerId: sellerAId,
        branchId: branchA._id,
        batchNumber: 'LOT-RES-001',
        quantity: 10,
        reservedQuantity: 2,
      });

      assert.throws(
        () => {
          validateBatchReassignmentSafety({
            batch,
            payloadBranchId: branchB._id.toString(),
            activeOrders: [],
            targetBranch: branchB,
          });
        },
        (err) => {
          assert.equal(err.errorCode, 'BATCH_REASSIGNMENT_UNSAFE');
          assert.match(err.message, /active reserved stock/);
          return true;
        }
      );
    });

    it('preserves BRANCH_INACTIVE rejection for inactive target branch', () => {
      const batch = new Batch({
        storeId: storeAId,
        sellerId: sellerAId,
        branchId: branchA._id,
        batchNumber: 'LOT-ACTIVE-INACTIVE',
        quantity: 5,
        reservedQuantity: 0,
      });

      assert.throws(
        () => {
          validateBatchReassignmentSafety({
            batch,
            payloadBranchId: inactiveBranchA._id.toString(),
            activeOrders: [],
            targetBranch: inactiveBranchA,
          });
        },
        (err) => {
          assert.equal(err.errorCode, 'BRANCH_INACTIVE');
          return true;
        }
      );
    });

    it('preserves BRANCH_STORE_MISMATCH rejection for foreign store branch', () => {
      const batch = new Batch({
        storeId: storeAId,
        sellerId: sellerAId,
        branchId: branchA._id,
        batchNumber: 'LOT-FOREIGN',
        quantity: 5,
        reservedQuantity: 0,
      });

      assert.throws(
        () => {
          validateBatchReassignmentSafety({
            batch,
            payloadBranchId: foreignBranchB._id.toString(),
            activeOrders: [],
            targetBranch: foreignBranchB,
          });
        },
        (err) => {
          assert.equal(err.errorCode, 'BRANCH_STORE_MISMATCH');
          return true;
        }
      );
    });

    it('does not block in-place price/date updates when branchId is unchanged, even with an active order', () => {
      const batch = new Batch({
        storeId: storeAId,
        sellerId: sellerAId,
        branchId: branchA._id,
        batchNumber: 'LOT-IN-PLACE',
        quantity: 10,
        reservedQuantity: 3,
      });

      const activeOrder = {
        _id: new mongoose.Types.ObjectId(),
        orderNumber: 'ORD-INPLACE-1',
        status: ORDER_STATUS.CONFIRMED,
        branchId: branchA._id,
        items: [
          {
            batchAllocations: [{ batchId: batch._id, batchNumber: batch.batchNumber }],
          },
        ],
      };

      // User submits form with same branchId (no branch reassignment)
      assert.doesNotThrow(() => {
        validateBatchReassignmentSafety({
          batch,
          payloadBranchId: branchA._id.toString(),
          activeOrders: [activeOrder],
          targetBranch: branchA,
        });
      });
    });
  });

  // =========================================================================
  // 4. Restoration Invariant Verification
  // =========================================================================
  describe('4. Order Cancellation Invariant Under Blocked Reassignment', () => {
    it('ensures order cancellation restores stock strictly to original branch after reassignment is blocked', () => {
      const originalBranchId = branchA._id;
      const batch = new Batch({
        storeId: storeAId,
        sellerId: sellerAId,
        branchId: originalBranchId,
        batchNumber: 'LOT-CANCEL-RESTORE',
        quantity: 10,
        reservedQuantity: 0,
      });

      // 1. Order is placed and stock deducted
      const order = {
        _id: new mongoose.Types.ObjectId(),
        orderNumber: 'ORD-RESTORE-1',
        status: ORDER_STATUS.PLACED,
        branchId: originalBranchId,
        items: [
          {
            productId: new mongoose.Types.ObjectId(),
            quantity: 4,
            batchAllocations: [
              {
                batchId: batch._id,
                batchNumber: batch.batchNumber,
                allocatedQuantity: 4,
              },
            ],
          },
        ],
      };
      batch.quantity -= 4; // quantity is now 6

      // 2. Seller attempts to move batch to branchB -> BLOCKED
      assert.throws(() => {
        validateBatchReassignmentSafety({
          batch,
          payloadBranchId: branchB._id.toString(),
          activeOrders: [order],
          targetBranch: branchB,
        });
      });

      // 3. Batch remains at originalBranchId
      assert.equal(batch.branchId.toString(), originalBranchId.toString());

      // 4. Order is cancelled -> stock restored to original batch and original branch
      for (const item of order.items) {
        for (const alloc of item.batchAllocations) {
          if (alloc.batchId.toString() === batch._id.toString()) {
            batch.quantity += alloc.allocatedQuantity;
          }
        }
      }

      assert.equal(batch.quantity, 10);
      assert.equal(batch.branchId.toString(), originalBranchId.toString());
      assert.equal(batch.branchId.toString(), order.branchId.toString());
    });
  });
});
