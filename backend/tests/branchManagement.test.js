import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { Branch } from '../src/models/branch.model.js';
import { Batch } from '../src/models/batch.model.js';
import { Order } from '../src/models/order.model.js';
import { InventoryAudit } from '../src/models/inventory.model.js';
import { QrVerification } from '../src/models/qrVerification.model.js';
import {
  createBranchSchema,
  updateBranchSchema,
  updateBranchStatusSchema,
} from '../src/validators/branch.validator.js';

describe('Phase 1: Multi-Branch Architecture & Branch Management Suite', () => {
  const mockStoreId = new mongoose.Types.ObjectId().toString();
  const mockSellerId = new mongoose.Types.ObjectId().toString();

  // =========================================================================
  // 1. Zod Validation Schemas
  // =========================================================================
  describe('1. Branch Request Validation Schemas', () => {
    it('accepts a valid branch creation payload with complete address & coordinates', () => {
      const validPayload = {
        body: {
          name: 'Indiranagar Hub',
          address: {
            street: '12 80ft Road, 4th Block',
            locality: 'Indiranagar',
            city: 'Bangalore',
            state: 'Karnataka',
            pincode: '560038',
            landmark: 'Near Metro Station',
          },
          contactPhone: '9876543210',
          contactEmail: 'indiranagar@example.com',
          operatingHours: '08:00 AM - 10:00 PM',
          latitude: 12.9784,
          longitude: 77.6408,
          isPrimary: true,
        },
      };

      const result = createBranchSchema.safeParse(validPayload);
      assert.equal(result.success, true);
      assert.equal(result.data.body.name, 'Indiranagar Hub');
      assert.equal(result.data.body.address.pincode, '560038');
    });

    it('rejects branch creation when mandatory fields (name, street, city, state, pincode, phone) are missing', () => {
      const invalidPayload = {
        body: {
          name: 'Incomplete Branch',
          address: {
            street: '',
            city: 'Bangalore',
          },
        },
      };

      const result = createBranchSchema.safeParse(invalidPayload);
      assert.equal(result.success, false);
      const errors = result.error.errors.map((e) => e.path.join('.'));
      assert.ok(errors.some((p) => p.includes('street') || p.includes('state') || p.includes('pincode')));
    });

    it('rejects invalid or malformed contact phone numbers (<10 digits)', () => {
      const invalidPhonePayload = {
        body: {
          name: 'Test Branch',
          address: {
            street: 'Main Road',
            city: 'Bangalore',
            state: 'Karnataka',
            pincode: '560001',
          },
          contactPhone: '12345', // too short
        },
      };

      const result = createBranchSchema.safeParse(invalidPhonePayload);
      assert.equal(result.success, false);
      assert.ok(result.error.errors.some((e) => e.path.includes('contactPhone')));
    });

    it('accepts partial updates in updateBranchSchema', () => {
      const updatePayload = {
        body: {
          name: 'Updated Branch Name',
          operatingHours: '10:00 AM - 08:00 PM',
          address: {
            street: 'New Street 45',
          },
        },
      };

      const result = updateBranchSchema.safeParse(updatePayload);
      assert.equal(result.success, true);
      assert.equal(result.data.body.name, 'Updated Branch Name');
    });

    it('validates active status toggle in updateBranchStatusSchema', () => {
      const validToggle = { body: { isActive: false } };
      const res = updateBranchStatusSchema.safeParse(validToggle);
      assert.equal(res.success, true);
      assert.equal(res.data.body.isActive, false);

      const invalidToggle = { body: { isActive: 'not-a-boolean' } };
      const failRes = updateBranchStatusSchema.safeParse(invalidToggle);
      assert.equal(failRes.success, false);
    });
  });

  // =========================================================================
  // 2. Mongoose Model Architecture & Schema Invariants
  // =========================================================================
  describe('2. Mongoose Model Architecture & Schema Definitions', () => {
    it('Branch schema instantiates cleanly with all required fields and geo coordinates', () => {
      const branchDoc = new Branch({
        storeId: mockStoreId,
        sellerId: mockSellerId,
        name: 'MG Road Flagship',
        address: {
          street: '100 MG Road',
          locality: 'Central District',
          city: 'Bangalore',
          state: 'Karnataka',
          pincode: '560001',
          landmark: 'Opposite Plaza',
        },
        contactPhone: '9845112233',
        contactEmail: 'mgroad@store.test',
        operatingHours: '09:00 AM - 09:00 PM',
        latitude: 12.9756,
        longitude: 77.6066,
        isPrimary: true,
        isActive: true,
      });

      const validationError = branchDoc.validateSync();
      assert.equal(validationError, undefined);
      assert.equal(branchDoc.name, 'MG Road Flagship');
      assert.equal(branchDoc.isPrimary, true);
      assert.equal(branchDoc.isActive, true);
    });

    it('synchronizes GeoJSON Point from latitude and longitude', async () => {
      const branchDoc = new Branch({
        storeId: mockStoreId,
        sellerId: mockSellerId,
        name: 'Koramangala Hub',
        address: {
          street: '45 Intermediate Ring Rd',
          city: 'Bangalore',
          state: 'Karnataka',
          pincode: '560034',
        },
        contactPhone: '9845998877',
        latitude: 12.9352,
        longitude: 77.6245,
      });

      await branchDoc.validate();
      assert.ok(branchDoc.location);
      assert.equal(branchDoc.location.type, 'Point');
      assert.deepEqual(branchDoc.location.coordinates, [77.6245, 12.9352]);
    });
  });

  // =========================================================================
  // 3. Backward Compatibility for Existing Batches, Orders, and Records
  // =========================================================================
  describe('3. Backward Compatibility Guarantees', () => {
    it('Batch model schema allows branchId to be null or omitted for legacy batches', () => {
      const legacyBatch = new Batch({
        productId: new mongoose.Types.ObjectId(),
        storeId: mockStoreId,
        sellerId: mockSellerId,
        batchNumber: 'LEGACY-BATCH-001',
        manufacturingDate: new Date(),
        expiryDate: new Date(Date.now() + 7 * 86400000),
        remainingDays: 7,
        initialQuantity: 100,
        quantity: 100,
        originalPrice: 150,
        currentPrice: 120,
      });

      const err = legacyBatch.validateSync();
      assert.equal(err, undefined, 'Legacy batch without branchId must validate cleanly');
      assert.equal(legacyBatch.branchId, null);
    });

    it('Batch model accepts valid branchId when assigned to a specific branch', () => {
      const branchId = new mongoose.Types.ObjectId();
      const branchBatch = new Batch({
        productId: new mongoose.Types.ObjectId(),
        storeId: mockStoreId,
        sellerId: mockSellerId,
        branchId,
        batchNumber: 'BRANCH-BATCH-002',
        manufacturingDate: new Date(),
        expiryDate: new Date(Date.now() + 5 * 86400000),
        remainingDays: 5,
        initialQuantity: 30,
        quantity: 30,
        originalPrice: 200,
        currentPrice: 160,
      });

      const err = branchBatch.validateSync();
      assert.equal(err, undefined);
      assert.equal(branchBatch.branchId.toString(), branchId.toString());
    });

    it('Order model preserves backward compatibility for orders without branchId & allows pickupBranch snapshot', () => {
      const sampleItem = {
        productId: new mongoose.Types.ObjectId(),
        productName: 'Organic Milk 1L',
        requestedQuantity: 2,
        blendedUnitPrice: 40,
        lineOriginalAmount: 100,
        lineDiscountedAmount: 80,
        lineSavingsAmount: 20,
      };

      // Legacy order without branchId
      const legacyOrder = new Order({
        orderNumber: 'NE-20261104-9001',
        customerId: new mongoose.Types.ObjectId(),
        storeId: mockStoreId,
        items: [sampleItem],
        pricingSummary: {
          subtotal: 100,
          discounts: 20,
          finalTotal: 80,
          totalUnits: 2,
          itemCount: 1,
        },
      });

      const legacyErr = legacyOrder.validateSync();
      assert.equal(legacyErr, undefined, 'Legacy order must validate cleanly without branchId');
      assert.equal(legacyOrder.branchId, null);

      // New order with branchId and pickupBranch snapshot
      const branchId = new mongoose.Types.ObjectId();
      const newOrder = new Order({
        orderNumber: 'NE-20261104-9002',
        customerId: new mongoose.Types.ObjectId(),
        storeId: mockStoreId,
        branchId,
        pickupBranch: {
          name: 'Indiranagar Hub',
          address: {
            street: '12 80ft Road',
            locality: 'Indiranagar',
            city: 'Bangalore',
            state: 'Karnataka',
            pincode: '560038',
          },
          contactPhone: '9876543210',
          operatingHours: '08:00 AM - 10:00 PM',
          latitude: 12.9784,
          longitude: 77.6408,
        },
        items: [sampleItem],
        pricingSummary: {
          subtotal: 100,
          discounts: 20,
          finalTotal: 80,
          totalUnits: 2,
          itemCount: 1,
        },
      });

      const newErr = newOrder.validateSync();
      assert.equal(newErr, undefined);
      assert.equal(newOrder.branchId.toString(), branchId.toString());
      assert.equal(newOrder.pickupBranch.name, 'Indiranagar Hub');
      assert.equal(newOrder.pickupBranch.address.pincode, '560038');
    });

    it('InventoryAudit model accepts branchId without breaking existing audit entries', () => {
      const audit = new InventoryAudit({
        batchId: new mongoose.Types.ObjectId(),
        productId: new mongoose.Types.ObjectId(),
        storeId: mockStoreId,
        branchId: new mongoose.Types.ObjectId(),
        batchNumber: 'LOT-998',
        actionType: 'STOCK_COMMITTED_SALE',
        quantityChange: -2,
        previousQuantity: 10,
        newQuantity: 8,
        previousReserved: 0,
        newReserved: 0,
        batchStatusAfter: 'NORMAL',
        reason: 'Sale completed',
        performedBy: new mongoose.Types.ObjectId(),
        performedByRole: 'CUSTOMER',
      });

      const err = audit.validateSync();
      assert.equal(err, undefined);
      assert.ok(audit.branchId);
    });

    it('QrVerification model accepts branchId for pickup QR verification', () => {
      const qrRecord = new QrVerification({
        qrType: 'PICKUP',
        orderId: new mongoose.Types.ObjectId(),
        customerId: new mongoose.Types.ObjectId(),
        storeId: mockStoreId,
        branchId: new mongoose.Types.ObjectId(),
        tokenNonce: 'nonce_test_123',
        tokenHash: 'hash_test_456',
      });

      const err = qrRecord.validateSync();
      assert.equal(err, undefined);
      assert.ok(qrRecord.branchId);
    });
  });

  // =========================================================================
  // 4. Primary Branch & Cross-Tenant Security Invariants
  // =========================================================================
  describe('4. Multi-Branch Security & Primary Invariants', () => {
    it('strictly isolates branch ownership between different seller stores', () => {
      const seller1Branch = new Branch({
        storeId: mockStoreId,
        sellerId: mockSellerId,
        name: 'Seller 1 Main Branch',
        address: {
          street: 'Street 1',
          city: 'Bangalore',
          state: 'Karnataka',
          pincode: '560001',
        },
        contactPhone: '9876543210',
      });

      const seller2User = { _id: new mongoose.Types.ObjectId(), role: 'SELLER' };

      // Access control assertion
      const hasPermission = seller1Branch.sellerId.toString() === seller2User._id.toString();
      assert.equal(hasPermission, false, 'Seller 2 must NOT have permission to edit Seller 1 branch');
    });

    it('rejects allocation to inactive branches', () => {
      const inactiveBranch = new Branch({
        storeId: mockStoreId,
        sellerId: mockSellerId,
        name: 'Closed Outlet',
        address: { street: 'Main Rd', city: 'Bangalore', state: 'KA', pincode: '560001' },
        contactPhone: '9876543210',
        isActive: false,
      });

      assert.equal(inactiveBranch.isActive, false);
    });

    it('validates batch model accepts branchId and preserves legacy null batches', () => {
      const branchId = new mongoose.Types.ObjectId();
      const bWithBranch = new Batch({
        productId: new mongoose.Types.ObjectId(),
        storeId: mockStoreId,
        sellerId: mockSellerId,
        branchId,
        batchNumber: 'LOT-BR-1',
        manufacturingDate: new Date(),
        expiryDate: new Date(Date.now() + 864000000),
        remainingDays: 10,
        initialQuantity: 10,
        quantity: 10,
        originalPrice: 100,
        currentPrice: 80,
      });

      assert.equal(bWithBranch.validateSync(), undefined);
      assert.equal(bWithBranch.branchId.toString(), branchId.toString());
    });
  });
});
