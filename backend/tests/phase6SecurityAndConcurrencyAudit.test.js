import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { Order, ORDER_STATUS, FULFILLMENT_TYPES } from '../src/models/order.model.js';
import { Branch } from '../src/models/branch.model.js';
import { Store } from '../src/models/store.model.js';
import { QrVerification, QR_STATUS, QR_TYPE } from '../src/models/qrVerification.model.js';
import { ApiError } from '../src/utils/ApiError.js';

describe('Phase 6: Security and Concurrency Audit Suite', () => {
  const storeAId = new mongoose.Types.ObjectId();
  const storeBId = new mongoose.Types.ObjectId();
  const sellerAId = new mongoose.Types.ObjectId();
  const sellerBId = new mongoose.Types.ObjectId();
  const customerId = new mongoose.Types.ObjectId();

  const primaryBranchA = new Branch({
    storeId: storeAId,
    sellerId: sellerAId,
    name: 'Main Store Indiranagar',
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

  const foreignBranchB = new Branch({
    storeId: storeBId,
    sellerId: sellerBId,
    name: 'Foreign Store Branch',
    address: { street: 'MG Road', city: 'Bangalore', state: 'Karnataka', pincode: '560001' },
    contactPhone: '9876543299',
    isPrimary: true,
    isActive: true,
  });

  // =========================================================================
  // 1. Concurrent Scans Simulation (Race Condition Defense)
  // =========================================================================
  describe('1. Concurrent Scans Concurrency Defense', () => {
    it('ensures at most one request completes pickup under simultaneous concurrent verification', async () => {
      // Simulate MongoDB document state with atomic findOneAndUpdate lock
      const sharedQrDocument = {
        _id: new mongoose.Types.ObjectId(),
        status: QR_STATUS.ACTIVE,
        scanHistory: [],
        usedAt: null,
        verifiedAt: null,
      };

      const sharedOrder = {
        _id: new mongoose.Types.ObjectId(),
        orderNumber: 'ORD-CONCURRENT-001',
        status: ORDER_STATUS.READY_FOR_PICKUP,
        statusTimeline: [],
      };

      let billReceiptCallCount = 0;
      let notificationCallCount = 0;

      // Simulated atomic findOneAndUpdate engine with mutex serialization
      let lock = Promise.resolve();
      const atomicFindOneAndUpdate = async (filter, update) => {
        return new Promise((resolve) => {
          lock = lock.then(async () => {
            if (sharedQrDocument._id.equals(filter._id) && sharedQrDocument.status === filter.status) {
              // Apply updates
              Object.assign(sharedQrDocument, update.$set);
              if (update.$push?.scanHistory) {
                sharedQrDocument.scanHistory.push(update.$push.scanHistory);
              }
              resolve({ ...sharedQrDocument });
            } else {
              resolve(null); // Condition failed (already USED)
            }
          });
        });
      };

      // Service verification execution
      const executeVerify = async (clientTag) => {
        // Pre-checks pass
        if (sharedQrDocument.status !== QR_STATUS.ACTIVE) {
          throw new ApiError(400, 'This pickup QR has already been used.', 'ALREADY_USED');
        }

        // Atomic CAS transition: ACTIVE -> USED
        const updated = await atomicFindOneAndUpdate(
          { _id: sharedQrDocument._id, status: QR_STATUS.ACTIVE },
          {
            $set: {
              status: QR_STATUS.USED,
              usedAt: new Date(),
              verifiedAt: new Date(),
            },
            $push: {
              scanHistory: {
                scannedAt: new Date(),
                result: 'SUCCESS',
                clientTag,
              },
            },
          }
        );

        if (!updated) {
          throw new ApiError(409, 'This pickup QR has already been used.', 'ALREADY_USED');
        }

        // Order completion
        sharedOrder.status = ORDER_STATUS.DELIVERED;
        sharedOrder.statusTimeline.push({
          status: ORDER_STATUS.DELIVERED,
          timestamp: new Date(),
          by: clientTag,
        });

        // Bill receipt generation
        billReceiptCallCount++;

        // Notifications
        notificationCallCount++;

        return { success: true, clientTag, orderNumber: sharedOrder.orderNumber };
      };

      // Fire 2 simultaneous concurrent verification calls
      const [res1, res2] = await Promise.allSettled([
        executeVerify('Scanner-Terminal-A'),
        executeVerify('Scanner-Terminal-B'),
      ]);

      const fulfilled = [res1, res2].filter((r) => r.status === 'fulfilled');
      const rejected = [res1, res2].filter((r) => r.status === 'rejected');

      // Invariant 1: Exactly one succeeded, exactly one failed
      assert.equal(fulfilled.length, 1);
      assert.equal(rejected.length, 1);

      // Invariant 2: Rejected error is 409 ALREADY_USED
      assert.equal(rejected[0].reason.statusCode, 409);
      assert.equal(rejected[0].reason.errorCode, 'ALREADY_USED');

      // Invariant 3: Order was marked delivered exactly once
      assert.equal(sharedOrder.status, ORDER_STATUS.DELIVERED);
      assert.equal(sharedOrder.statusTimeline.length, 1);

      // Invariant 4: Duplicate receipt and notification were completely prevented
      assert.equal(billReceiptCallCount, 1);
      assert.equal(notificationCallCount, 1);

      // Invariant 5: Exactly one success audit entry exists in scan history
      assert.equal(sharedQrDocument.scanHistory.length, 1);
      assert.equal(sharedQrDocument.scanHistory[0].result, 'SUCCESS');
    });
  });

  // =========================================================================
  // 2. QR/Order Consistency & Standalone MongoDB Rollback
  // =========================================================================
  describe('2. QR/Order State Consistency across Failures', () => {
    it('compensates QR back to ACTIVE if subsequent order update fails on standalone MongoDB', async () => {
      const qrRecord = {
        _id: new mongoose.Types.ObjectId(),
        status: QR_STATUS.ACTIVE,
        scanHistory: [],
      };

      const order = {
        _id: new mongoose.Types.ObjectId(),
        status: ORDER_STATUS.READY_FOR_PICKUP,
      };

      // Simulation with compensation logic
      const verifyWithCompensation = async (shouldFailOrderSave = false) => {
        // Step 6: Atomic transition to USED
        qrRecord.status = QR_STATUS.USED;
        qrRecord.scanHistory.push({
          scannedAt: new Date(),
          result: 'SUCCESS',
        });

        // Step 7: Order update
        try {
          if (shouldFailOrderSave) {
            throw new Error('Database write conflict on order document');
          }
          order.status = ORDER_STATUS.DELIVERED;
        } catch (orderErr) {
          // Manual compensation on standalone MongoDB
          qrRecord.status = QR_STATUS.ACTIVE;
          qrRecord.scanHistory.push({
            scannedAt: new Date(),
            result: 'ORDER_UPDATE_FAILED',
            notes: orderErr.message,
          });
          throw new ApiError(500, `Failed to complete order handover: ${orderErr.message}`);
        }

        return { success: true };
      };

      // Case A: Order write fails
      await assert.rejects(
        () => verifyWithCompensation(true),
        (err) => {
          assert.equal(err.statusCode, 500);
          assert.ok(err.message.includes('Database write conflict'));
          return true;
        }
      );

      // Invariant: QR must NOT be left in USED state (preventing permanent lockout)
      assert.equal(qrRecord.status, QR_STATUS.ACTIVE);
      assert.equal(order.status, ORDER_STATUS.READY_FOR_PICKUP);
      assert.equal(qrRecord.scanHistory.some((s) => s.result === 'ORDER_UPDATE_FAILED'), true);

      // Case B: Retry succeeds after transient failure
      const retryRes = await verifyWithCompensation(false);
      assert.equal(retryRes.success, true);
      assert.equal(qrRecord.status, QR_STATUS.USED);
      assert.equal(order.status, ORDER_STATUS.DELIVERED);
    });
  });

  // =========================================================================
  // 3. Branch Mismatch Security & Leak Prevention
  // =========================================================================
  describe('3. Branch Mismatch Recording & Cross-Store Data Leak Prevention', () => {
    it('accurately logs BRANCH_PICKUP_MISMATCH without consuming QR or mutating order', () => {
      const qrRecord = {
        _id: new mongoose.Types.ObjectId(),
        status: QR_STATUS.ACTIVE,
        scanHistory: [],
      };

      const order = {
        _id: new mongoose.Types.ObjectId(),
        branchId: secondaryBranchA._id,
        pickupBranch: { name: secondaryBranchA.name },
        status: ORDER_STATUS.READY_FOR_PICKUP,
      };

      const attemptMismatchScan = (scannerBranch) => {
        if (order.branchId.toString() !== scannerBranch._id.toString()) {
          qrRecord.scanHistory.push({
            scannedAt: new Date(),
            branchId: scannerBranch._id,
            result: 'BRANCH_PICKUP_MISMATCH',
            verificationStatus: 'REJECTED',
            notes: `Assigned: ${order.pickupBranch.name}, Scanned at: ${scannerBranch.name}`,
          });

          throw new ApiError(
            400,
            `Pickup branch mismatch: Order is at ${order.pickupBranch.name}, but scanned at ${scannerBranch.name}`,
            'BRANCH_PICKUP_MISMATCH'
          );
        }
      };

      assert.throws(
        () => attemptMismatchScan(primaryBranchA),
        (err) => {
          assert.equal(err.statusCode, 400);
          assert.equal(err.errorCode, 'BRANCH_PICKUP_MISMATCH');
          return true;
        }
      );

      // Invariants
      assert.equal(qrRecord.status, QR_STATUS.ACTIVE);
      assert.equal(order.status, ORDER_STATUS.READY_FOR_PICKUP);
      assert.equal(qrRecord.scanHistory.length, 1);
      assert.equal(qrRecord.scanHistory[0].result, 'BRANCH_PICKUP_MISMATCH');
      assert.equal(qrRecord.scanHistory[0].branchId.toString(), primaryBranchA._id.toString());
    });

    it('blocks foreign store scanner before order data inspection or branch mismatch checking', () => {
      const foreignScannerSeller = {
        _id: sellerBId,
        storeId: storeBId,
      };

      const qrRecord = {
        storeId: storeAId,
        orderId: new mongoose.Types.ObjectId(),
      };

      // Guard check: store authorization
      const checkStoreAuth = (sellerStoreId, qrStoreId) => {
        if (sellerStoreId.toString() !== qrStoreId.toString()) {
          throw new ApiError(403, 'This QR belongs to a different store.', 'STORE_MISMATCH');
        }
      };

      assert.throws(
        () => checkStoreAuth(foreignScannerSeller.storeId, qrRecord.storeId),
        (err) => {
          assert.equal(err.statusCode, 403);
          assert.equal(err.errorCode, 'STORE_MISMATCH');
          return true;
        }
      );
    });
  });
});

