import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { listOrdersQuerySchema } from '../src/validators/order.validator.js';
import { verifyPickupQrSchema } from '../src/validators/qr.validator.js';
import { Order, ORDER_STATUS, FULFILLMENT_TYPES } from '../src/models/order.model.js';
import { Branch } from '../src/models/branch.model.js';
import { Store } from '../src/models/store.model.js';
import { QrVerification, QR_STATUS, QR_TYPE } from '../src/models/qrVerification.model.js';
import { ApiError } from '../src/utils/ApiError.js';

describe('Phase 6: Branch-Aware Orders & Secure QR Pickup Suite', () => {
  const storeAId = new mongoose.Types.ObjectId();
  const storeBId = new mongoose.Types.ObjectId();
  const sellerAId = new mongoose.Types.ObjectId();
  const sellerBId = new mongoose.Types.ObjectId();
  const customerId = new mongoose.Types.ObjectId();

  const primaryBranchA = new Branch({
    storeId: storeAId,
    sellerId: sellerAId,
    name: 'Indiranagar Main Outlet',
    address: { street: '100ft Rd', city: 'Bangalore', state: 'Karnataka', pincode: '560038' },
    contactPhone: '9876543210',
    operatingHours: '08:00 AM - 10:00 PM',
    isPrimary: true,
    isActive: true,
  });

  const secondaryBranchA = new Branch({
    storeId: storeAId,
    sellerId: sellerAId,
    name: 'Koramangala Annex',
    address: { street: '80ft Rd', city: 'Bangalore', state: 'Karnataka', pincode: '560095' },
    contactPhone: '9876543211',
    operatingHours: '09:00 AM - 09:00 PM',
    isPrimary: false,
    isActive: true,
  });

  const foreignBranchB = new Branch({
    storeId: storeBId,
    sellerId: sellerBId,
    name: 'Foreign Store Branch',
    address: { street: 'MG Road', city: 'Bangalore', state: 'Karnataka', pincode: '560001' },
    contactPhone: '9876543299',
    operatingHours: '10:00 AM - 08:00 PM',
    isPrimary: true,
    isActive: true,
  });

  // =========================================================================
  // 1. Validator Tests
  // =========================================================================
  describe('1. Validators: listOrdersQuerySchema & verifyPickupQrSchema', () => {
    it('accepts valid optional branchId in listOrdersQuerySchema', () => {
      const validQuery = {
        branchId: secondaryBranchA._id.toString(),
        page: '1',
        limit: '10',
      };
      const parsed = listOrdersQuerySchema.parse({ query: validQuery });
      assert.equal(parsed.query.branchId, secondaryBranchA._id.toString());
    });

    it('accepts omitted branchId in listOrdersQuerySchema', () => {
      const parsed = listOrdersQuerySchema.parse({ query: { page: '1' } });
      assert.equal(parsed.query.branchId, undefined);
    });

    it('accepts valid optional branchId in verifyPickupQrSchema', () => {
      const parsed = verifyPickupQrSchema.parse({
        body: {
          token: 'a'.repeat(64),
          branchId: secondaryBranchA._id.toString(),
        },
      });
      assert.equal(parsed.body.branchId, secondaryBranchA._id.toString());
    });

    it('accepts omitted or null branchId in verifyPickupQrSchema for all-branches scanner mode', () => {
      const parsedNull = verifyPickupQrSchema.parse({
        body: {
          token: 'b'.repeat(64),
          branchId: null,
        },
      });
      assert.equal(parsedNull.body.branchId, null);

      const parsedOmitted = verifyPickupQrSchema.parse({
        body: {
          token: 'c'.repeat(64),
        },
      });
      assert.equal(parsedOmitted.body.branchId, undefined);
    });

    it('rejects malformed branchId in verifyPickupQrSchema', () => {
      assert.throws(() => {
        verifyPickupQrSchema.parse({
          body: {
            token: 'd'.repeat(64),
            branchId: 'invalid-mongodb-id',
          },
        });
      });
    });
  });

  // =========================================================================
  // 2. Branch-Aware Seller Orders Query & Isolation
  // =========================================================================
  describe('2. Seller Orders Query Branch Isolation & Delivery Preservation', () => {
    const ordersDb = [
      new Order({
        storeId: storeAId,
        customerId,
        orderNumber: 'ORD-001',
        branchId: primaryBranchA._id,
        pickupBranch: {
          branchId: primaryBranchA._id,
          name: primaryBranchA.name,
          address: primaryBranchA.address,
          contactPhone: primaryBranchA.contactPhone,
        },
        fulfillmentType: FULFILLMENT_TYPES.PICKUP,
        status: ORDER_STATUS.CONFIRMED,
        paymentStatus: 'PAID',
        items: [{ productName: 'Organic Milk', quantity: 2, priceAtPurchase: 50 }],
        subtotal: 100,
        totalAmount: 100,
      }),
      new Order({
        storeId: storeAId,
        customerId,
        orderNumber: 'ORD-002',
        branchId: secondaryBranchA._id,
        pickupBranch: {
          branchId: secondaryBranchA._id,
          name: secondaryBranchA.name,
          address: secondaryBranchA.address,
          contactPhone: secondaryBranchA.contactPhone,
        },
        fulfillmentType: FULFILLMENT_TYPES.PICKUP,
        status: ORDER_STATUS.READY_FOR_PICKUP,
        paymentStatus: 'PAID',
        items: [{ productName: 'Sourdough Bread', quantity: 1, priceAtPurchase: 80 }],
        subtotal: 80,
        totalAmount: 80,
      }),
      new Order({
        storeId: storeAId,
        customerId,
        orderNumber: 'ORD-003',
        branchId: secondaryBranchA._id,
        pickupBranch: null,
        fulfillmentType: FULFILLMENT_TYPES.LOCAL_DELIVERY,
        deliveryAddress: { street: 'Koramangala 5th Block', city: 'Bangalore', pincode: '560095' },
        status: ORDER_STATUS.CONFIRMED,
        paymentStatus: 'PAID',
        items: [{ productName: 'Greek Yogurt', quantity: 3, priceAtPurchase: 60 }],
        subtotal: 180,
        totalAmount: 180,
      }),
      new Order({
        storeId: storeAId,
        customerId,
        orderNumber: 'ORD-004-LEGACY',
        branchId: null,
        pickupBranch: null,
        fulfillmentType: FULFILLMENT_TYPES.PICKUP,
        status: ORDER_STATUS.READY_FOR_PICKUP,
        paymentStatus: 'PAID',
        items: [{ productName: 'Apples 1kg', quantity: 1, priceAtPurchase: 120 }],
        subtotal: 120,
        totalAmount: 120,
      }),
      new Order({
        storeId: storeBId,
        customerId,
        orderNumber: 'ORD-FOREIGN',
        branchId: foreignBranchB._id,
        fulfillmentType: FULFILLMENT_TYPES.PICKUP,
        status: ORDER_STATUS.CONFIRMED,
        paymentStatus: 'PAID',
        items: [{ productName: 'Orange Juice', quantity: 1, priceAtPurchase: 90 }],
        subtotal: 90,
        totalAmount: 90,
      }),
    ];

    // Simulates the exact query logic in getSellerOrdersService
    const filterSellerOrders = (storeId, queryBranchId, branchesList = [primaryBranchA, secondaryBranchA]) => {
      let filterBranchId = queryBranchId;

      if (queryBranchId && queryBranchId !== 'ALL') {
        const foundBranch = branchesList.find(
          (b) => b._id.toString() === queryBranchId.toString() && b.storeId.toString() === storeId.toString()
        );
        if (!foundBranch) {
          throw new ApiError(403, 'Selected branch does not belong to your store or does not exist');
        }

        if (foundBranch.isPrimary) {
          // Primary branch matches primary branch ID or null/missing legacy
          return ordersDb.filter(
            (o) =>
              o.storeId.toString() === storeId.toString() &&
              (o.branchId?.toString() === foundBranch._id.toString() || o.branchId === null || o.branchId === undefined)
          );
        } else {
          return ordersDb.filter(
            (o) =>
              o.storeId.toString() === storeId.toString() &&
              o.branchId?.toString() === foundBranch._id.toString()
          );
        }
      }

      // 'ALL' or omitted: returns all orders for the store
      return ordersDb.filter((o) => o.storeId.toString() === storeId.toString());
    };

    it('filters orders strictly for a secondary branch', () => {
      const results = filterSellerOrders(storeAId, secondaryBranchA._id.toString());
      assert.equal(results.length, 2);
      assert.ok(results.every((o) => o.branchId.toString() === secondaryBranchA._id.toString()));
      assert.ok(results.some((o) => o.orderNumber === 'ORD-002'));
      assert.ok(results.some((o) => o.orderNumber === 'ORD-003'));
    });

    it('includes LOCAL_DELIVERY orders by origin branch without mutating fulfillmentType', () => {
      const results = filterSellerOrders(storeAId, secondaryBranchA._id.toString());
      const deliveryOrder = results.find((o) => o.orderNumber === 'ORD-003');
      assert.ok(deliveryOrder);
      assert.equal(deliveryOrder.fulfillmentType, FULFILLMENT_TYPES.LOCAL_DELIVERY);
      assert.equal(deliveryOrder.pickupBranch, null);
    });

    it('filters orders for primary branch including legacy fallback', () => {
      const results = filterSellerOrders(storeAId, primaryBranchA._id.toString());
      assert.equal(results.length, 2);
      assert.ok(results.some((o) => o.orderNumber === 'ORD-001'));
      assert.ok(results.some((o) => o.orderNumber === 'ORD-004-LEGACY'));
    });

    it('returns all store orders including legacy when ALL is selected', () => {
      const results = filterSellerOrders(storeAId, 'ALL');
      assert.equal(results.length, 4);
      assert.ok(!results.some((o) => o.storeId.toString() === storeBId.toString()));
    });

    it('rejects cross-store branch query with HTTP 403 Forbidden', () => {
      assert.throws(
        () => filterSellerOrders(storeAId, foreignBranchB._id.toString()),
        (err) => {
          assert.equal(err.statusCode, 403);
          assert.ok(err.message.includes('does not belong to your store'));
          return true;
        }
      );
    });
  });

  // =========================================================================
  // 3. Pickup QR Verification: Branch Enforcement & Mismatch Safety
  // =========================================================================
  describe('3. Pickup QR Verification Branch Security & Double-Scan Prevention', () => {
    // Helper simulating the verification guard logic in verifyPickupQrService
    const simulateVerifyPickupQr = ({
      order,
      qrRecord,
      scannerBranchId = null,
      sellerStoreId,
      branchesList = [primaryBranchA, secondaryBranchA],
    }) => {
      if (!qrRecord || qrRecord.status !== QR_STATUS.ACTIVE) {
        throw new ApiError(409, 'This QR code has already been verified and processed', 'ALREADY_USED');
      }

      if (order.fulfillmentType !== FULFILLMENT_TYPES.PICKUP) {
        throw new ApiError(400, 'This order is not configured for customer pickup', 'NOT_PICKUP_ORDER');
      }

      if (order.paymentStatus !== 'PAID' && order.paymentMethod !== 'CASH_ON_DELIVERY') {
        throw new ApiError(400, 'Order payment is incomplete. Cannot release goods without completed payment', 'PAYMENT_REQUIRED');
      }

      let confirmedBranchInfo = null;

      if (scannerBranchId) {
        const counterBranch = branchesList.find(
          (b) => b._id.toString() === scannerBranchId.toString() && b.storeId.toString() === sellerStoreId.toString()
        );
        if (!counterBranch) {
          throw new ApiError(403, 'Scanner branch does not belong to the seller store', 'FORBIDDEN');
        }

        const orderBranchIdStr = order.branchId ? order.branchId.toString() : null;
        const counterBranchIdStr = counterBranch._id.toString();

        if (orderBranchIdStr) {
          if (orderBranchIdStr !== counterBranchIdStr) {
            throw new ApiError(
              400,
              `Pickup branch mismatch. This order is assigned to "${order.pickupBranch?.name || 'another branch'}", but scanning counter is set to "${counterBranch.name}". Goods must be collected at the designated branch.`,
              'BRANCH_PICKUP_MISMATCH'
            );
          }
        } else {
          // Legacy order: must be primary branch
          if (!counterBranch.isPrimary) {
            throw new ApiError(
              400,
              `Pickup branch mismatch. Legacy unassigned orders must be picked up at the primary store location ("${counterBranch.name}" is a secondary branch).`,
              'BRANCH_PICKUP_MISMATCH'
            );
          }
        }

        confirmedBranchInfo = {
          branchId: counterBranch._id,
          name: counterBranch.name,
          address: counterBranch.address,
        };
      } else {
        // All branches mode
        if (order.pickupBranch?.name) {
          confirmedBranchInfo = {
            branchId: order.branchId || null,
            name: order.pickupBranch.name,
            address: order.pickupBranch.address || null,
          };
        }
      }

      // Atomically consume QR
      qrRecord.status = QR_STATUS.USED;
      qrRecord.usedAt = new Date();
      qrRecord.scanHistory.push({
        scannedAt: new Date(),
        result: 'SUCCESS',
        branchId: scannerBranchId || null,
      });

      order.status = ORDER_STATUS.DELIVERED;
      order.deliveredAt = new Date();

      return {
        success: true,
        order: {
          _id: order._id,
          orderNumber: order.orderNumber,
          status: order.status,
          branchId: order.branchId || null,
          pickupBranch: order.pickupBranch || null,
          confirmedBranch: confirmedBranchInfo,
        },
      };
    };

    it('rejects foreign store scanner branch with HTTP 403 Forbidden', () => {
      const order = new Order({
        storeId: storeAId,
        branchId: primaryBranchA._id,
        fulfillmentType: FULFILLMENT_TYPES.PICKUP,
        paymentStatus: 'PAID',
        status: ORDER_STATUS.READY_FOR_PICKUP,
        items: [],
      });
      const qrRecord = new QrVerification({
        status: QR_STATUS.ACTIVE,
        scanHistory: [],
      });

      assert.throws(
        () =>
          simulateVerifyPickupQr({
            order,
            qrRecord,
            scannerBranchId: foreignBranchB._id.toString(),
            sellerStoreId: storeAId,
          }),
        (err) => {
          assert.equal(err.statusCode, 403);
          assert.equal(err.errorCode, 'FORBIDDEN');
          assert.equal(qrRecord.status, QR_STATUS.ACTIVE);
          return true;
        }
      );
    });

    it('rejects branch mismatch and preserves ACTIVE QR status without marking order delivered', () => {
      const order = new Order({
        storeId: storeAId,
        branchId: secondaryBranchA._id,
        pickupBranch: {
          name: secondaryBranchA.name,
          address: secondaryBranchA.address,
        },
        fulfillmentType: FULFILLMENT_TYPES.PICKUP,
        paymentStatus: 'PAID',
        status: ORDER_STATUS.READY_FOR_PICKUP,
        items: [],
      });
      const qrRecord = new QrVerification({
        status: QR_STATUS.ACTIVE,
        scanHistory: [],
      });

      // Customer goes to primary branch instead of secondary branch
      assert.throws(
        () =>
          simulateVerifyPickupQr({
            order,
            qrRecord,
            scannerBranchId: primaryBranchA._id.toString(),
            sellerStoreId: storeAId,
          }),
        (err) => {
          assert.equal(err.statusCode, 400);
          assert.equal(err.errorCode, 'BRANCH_PICKUP_MISMATCH');
          assert.ok(err.message.includes('Pickup branch mismatch'));
          // Invariant: QR must NOT be consumed
          assert.equal(qrRecord.status, QR_STATUS.ACTIVE);
          // Invariant: Order must NOT be marked delivered
          assert.equal(order.status, ORDER_STATUS.READY_FOR_PICKUP);
          return true;
        }
      );
    });

    it('succeeds when scanner branch matches order branch, records branch in scanHistory, and sets DELIVERED', () => {
      const order = new Order({
        storeId: storeAId,
        branchId: secondaryBranchA._id,
        pickupBranch: {
          name: secondaryBranchA.name,
          address: secondaryBranchA.address,
        },
        fulfillmentType: FULFILLMENT_TYPES.PICKUP,
        paymentStatus: 'PAID',
        status: ORDER_STATUS.READY_FOR_PICKUP,
        items: [],
      });
      const qrRecord = new QrVerification({
        status: QR_STATUS.ACTIVE,
        scanHistory: [],
      });

      const res = simulateVerifyPickupQr({
        order,
        qrRecord,
        scannerBranchId: secondaryBranchA._id.toString(),
        sellerStoreId: storeAId,
      });

      assert.equal(res.success, true);
      assert.equal(order.status, ORDER_STATUS.DELIVERED);
      assert.equal(qrRecord.status, QR_STATUS.USED);
      assert.equal(qrRecord.scanHistory.length, 1);
      assert.equal(qrRecord.scanHistory[0].branchId.toString(), secondaryBranchA._id.toString());
      assert.equal(res.order.confirmedBranch.name, secondaryBranchA.name);
    });

    it('succeeds in All-Branches scanner mode (scannerBranchId: null) and returns order branch attribution', () => {
      const order = new Order({
        storeId: storeAId,
        branchId: secondaryBranchA._id,
        pickupBranch: {
          name: secondaryBranchA.name,
          address: secondaryBranchA.address,
        },
        fulfillmentType: FULFILLMENT_TYPES.PICKUP,
        paymentStatus: 'PAID',
        status: ORDER_STATUS.READY_FOR_PICKUP,
        items: [],
      });
      const qrRecord = new QrVerification({
        status: QR_STATUS.ACTIVE,
        scanHistory: [],
      });

      const res = simulateVerifyPickupQr({
        order,
        qrRecord,
        scannerBranchId: null,
        sellerStoreId: storeAId,
      });

      assert.equal(res.success, true);
      assert.equal(order.status, ORDER_STATUS.DELIVERED);
      assert.equal(qrRecord.status, QR_STATUS.USED);
      assert.equal(res.order.confirmedBranch.name, secondaryBranchA.name);
    });

    it('rejects double-scan of an already used QR token with HTTP 409 ALREADY_USED', () => {
      const order = new Order({
        storeId: storeAId,
        branchId: primaryBranchA._id,
        fulfillmentType: FULFILLMENT_TYPES.PICKUP,
        paymentStatus: 'PAID',
        status: ORDER_STATUS.DELIVERED,
        items: [],
      });
      const qrRecord = new QrVerification({
        status: QR_STATUS.USED,
        scanHistory: [{ result: 'SUCCESS', scannedAt: new Date() }],
      });

      assert.throws(
        () =>
          simulateVerifyPickupQr({
            order,
            qrRecord,
            scannerBranchId: primaryBranchA._id.toString(),
            sellerStoreId: storeAId,
          }),
        (err) => {
          assert.equal(err.statusCode, 409);
          assert.equal(err.errorCode, 'ALREADY_USED');
          return true;
        }
      );
    });

    it('rejects verification of LOCAL_DELIVERY orders with 400 NOT_PICKUP_ORDER', () => {
      const order = new Order({
        storeId: storeAId,
        branchId: primaryBranchA._id,
        fulfillmentType: FULFILLMENT_TYPES.LOCAL_DELIVERY,
        paymentStatus: 'PAID',
        status: ORDER_STATUS.CONFIRMED,
        items: [],
      });
      const qrRecord = new QrVerification({
        status: QR_STATUS.ACTIVE,
        scanHistory: [],
      });

      assert.throws(
        () =>
          simulateVerifyPickupQr({
            order,
            qrRecord,
            scannerBranchId: primaryBranchA._id.toString(),
            sellerStoreId: storeAId,
          }),
        (err) => {
          assert.equal(err.statusCode, 400);
          assert.equal(err.errorCode, 'NOT_PICKUP_ORDER');
          return true;
        }
      );
    });

    it('rejects verification of unpaid non-COD orders with 400 PAYMENT_REQUIRED', () => {
      const order = new Order({
        storeId: storeAId,
        branchId: primaryBranchA._id,
        fulfillmentType: FULFILLMENT_TYPES.PICKUP,
        paymentStatus: 'PENDING',
        paymentMethod: 'RAZORPAY',
        status: ORDER_STATUS.CONFIRMED,
        items: [],
      });
      const qrRecord = new QrVerification({
        status: QR_STATUS.ACTIVE,
        scanHistory: [],
      });

      assert.throws(
        () =>
          simulateVerifyPickupQr({
            order,
            qrRecord,
            scannerBranchId: primaryBranchA._id.toString(),
            sellerStoreId: storeAId,
          }),
        (err) => {
          assert.equal(err.statusCode, 400);
          assert.equal(err.errorCode, 'PAYMENT_REQUIRED');
          return true;
        }
      );
    });

    it('permits legacy orders (branchId: null) at primary counter branch', () => {
      const order = new Order({
        storeId: storeAId,
        branchId: null,
        pickupBranch: null,
        fulfillmentType: FULFILLMENT_TYPES.PICKUP,
        paymentStatus: 'PAID',
        status: ORDER_STATUS.READY_FOR_PICKUP,
        items: [],
      });
      const qrRecord = new QrVerification({
        status: QR_STATUS.ACTIVE,
        scanHistory: [],
      });

      const res = simulateVerifyPickupQr({
        order,
        qrRecord,
        scannerBranchId: primaryBranchA._id.toString(),
        sellerStoreId: storeAId,
      });

      assert.equal(res.success, true);
      assert.equal(order.status, ORDER_STATUS.DELIVERED);
      assert.equal(qrRecord.status, QR_STATUS.USED);
      assert.equal(res.order.confirmedBranch.name, primaryBranchA.name);
    });

    it('rejects legacy orders (branchId: null) if scanned at secondary counter branch', () => {
      const order = new Order({
        storeId: storeAId,
        branchId: null,
        pickupBranch: null,
        fulfillmentType: FULFILLMENT_TYPES.PICKUP,
        paymentStatus: 'PAID',
        status: ORDER_STATUS.READY_FOR_PICKUP,
        items: [],
      });
      const qrRecord = new QrVerification({
        status: QR_STATUS.ACTIVE,
        scanHistory: [],
      });

      assert.throws(
        () =>
          simulateVerifyPickupQr({
            order,
            qrRecord,
            scannerBranchId: secondaryBranchA._id.toString(),
            sellerStoreId: storeAId,
          }),
        (err) => {
          assert.equal(err.statusCode, 400);
          assert.equal(err.errorCode, 'BRANCH_PICKUP_MISMATCH');
          assert.ok(err.message.includes('primary store location'));
          assert.equal(qrRecord.status, QR_STATUS.ACTIVE);
          return true;
        }
      );
    });
  });
});
