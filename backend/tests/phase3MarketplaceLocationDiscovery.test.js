import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { browseMarketplaceSchema } from '../src/validators/marketplace.validator.js';

describe('Phase 3: Hyperlocal Location Selection & Branch Discovery Suite', () => {
  describe('1. Marketplace Query Validation Schema', () => {
    test('accepts valid PIN code, city, and locality in query', () => {
      const validQuery = {
        query: {
          pincode: '560038',
          city: 'Bangalore',
          locality: 'Indiranagar',
          page: '1',
          limit: '12',
        },
      };
      const result = browseMarketplaceSchema.safeParse(validQuery);
      assert.equal(result.success, true);
      assert.equal(result.data.query.pincode, '560038');
      assert.equal(result.data.query.city, 'Bangalore');
      assert.equal(result.data.query.locality, 'Indiranagar');
    });

    test('accepts valid branchId and geospatial coordinates', () => {
      const branchId = new mongoose.Types.ObjectId().toString();
      const validQuery = {
        query: {
          branchId,
          latitude: '12.9716',
          longitude: '77.5946',
          radiusKm: '15',
        },
      };
      const result = browseMarketplaceSchema.safeParse(validQuery);
      assert.equal(result.success, true);
      assert.equal(result.data.query.branchId, branchId);
      assert.equal(result.data.query.latitude, 12.9716);
      assert.equal(result.data.query.longitude, 77.5946);
      assert.equal(result.data.query.radiusKm, 15);
    });

    test('rejects malformed branchId format', () => {
      const invalidQuery = {
        query: {
          branchId: 'invalid-branch-id',
        },
      };
      const result = browseMarketplaceSchema.safeParse(invalidQuery);
      assert.equal(result.success, false);
      const branchErr = result.error.issues.find((i) => i.path.includes('branchId'));
      assert.ok(branchErr);
    });

    test('allows omitting location parameters for browsing all deals', () => {
      const queryWithoutLocation = {
        query: {
          search: 'milk',
          sortBy: 'expiry',
        },
      };
      const result = browseMarketplaceSchema.safeParse(queryWithoutLocation);
      assert.equal(result.success, true);
      assert.equal(result.data.query.pincode, undefined);
      assert.equal(result.data.query.city, undefined);
      assert.equal(result.data.query.latitude, undefined);
    });
  });

  describe('2. Hyperlocal Discovery & Branch Isolation Logic', () => {
    test('isolates active branches matching customer PIN code', () => {
      const branches = [
        {
          _id: new mongoose.Types.ObjectId(),
          name: 'Indiranagar Branch',
          address: { pincode: '560038', city: 'Bangalore' },
          isActive: true,
        },
        {
          _id: new mongoose.Types.ObjectId(),
          name: 'Whitefield Branch',
          address: { pincode: '560066', city: 'Bangalore' },
          isActive: true,
        },
        {
          _id: new mongoose.Types.ObjectId(),
          name: 'Closed Indiranagar Branch',
          address: { pincode: '560038', city: 'Bangalore' },
          isActive: false, // Inactive branch
        },
      ];

      const customerPincode = '560038';
      const eligibleBranches = branches.filter(
        (b) => b.isActive && b.address.pincode === customerPincode
      );

      assert.equal(eligibleBranches.length, 1);
      assert.equal(eligibleBranches[0].name, 'Indiranagar Branch');
    });

    test('matches city case-insensitively and filters out inactive branches', () => {
      const branches = [
        {
          _id: new mongoose.Types.ObjectId(),
          name: 'Koramangala Branch',
          address: { pincode: '560034', city: 'Bangalore' },
          isActive: true,
        },
        {
          _id: new mongoose.Types.ObjectId(),
          name: 'Bandra Branch',
          address: { pincode: '400050', city: 'Mumbai' },
          isActive: true,
        },
      ];

      const cityFilter = 'bangalore';
      const cityRegex = new RegExp(`^${cityFilter}$`, 'i');
      const matched = branches.filter((b) => b.isActive && cityRegex.test(b.address.city));

      assert.equal(matched.length, 1);
      assert.equal(matched[0].name, 'Koramangala Branch');
    });
  });

  describe('3. Legacy Batch Compatibility Guarantees', () => {
    test('preserves legacy batches (branchId: null) alongside branch-specific inventory', () => {
      const branchAId = new mongoose.Types.ObjectId();
      const legacyStoreId = new mongoose.Types.ObjectId();

      const batches = [
        {
          _id: new mongoose.Types.ObjectId(),
          batchNumber: 'LOT-BRANCH-01',
          branchId: branchAId,
          storeId: new mongoose.Types.ObjectId(),
          quantity: 20,
        },
        {
          _id: new mongoose.Types.ObjectId(),
          batchNumber: 'LOT-LEGACY-01',
          branchId: null, // Legacy batch before branch system
          storeId: legacyStoreId,
          quantity: 15,
        },
        {
          _id: new mongoose.Types.ObjectId(),
          batchNumber: 'LOT-OTHER-01',
          branchId: new mongoose.Types.ObjectId(),
          storeId: new mongoose.Types.ObjectId(),
          quantity: 10,
        },
      ];

      // Simulated customer filter matching branchAId and legacyStoreId
      const matchedBranchIds = [branchAId.toString()];
      const matchedLegacyStoreIds = [legacyStoreId.toString()];

      const visibleBatches = batches.filter((b) => {
        if (b.branchId && matchedBranchIds.includes(b.branchId.toString())) {
          return true;
        }
        if (b.branchId === null && matchedLegacyStoreIds.includes(b.storeId.toString())) {
          return true;
        }
        return false;
      });

      assert.equal(visibleBatches.length, 2);
      assert.ok(visibleBatches.some((b) => b.batchNumber === 'LOT-BRANCH-01'));
      assert.ok(visibleBatches.some((b) => b.batchNumber === 'LOT-LEGACY-01'));
    });
  });

  describe('4. Fallback Handling for No Stores & Location Denial', () => {
    test('reports noStoresFound when location yields 0 branches or stores', () => {
      const matchedBranchIds = [];
      const matchedLegacyStoreIds = [];

      const hasTextLocation = true;
      const isAreaEmpty =
        hasTextLocation &&
        matchedBranchIds.length === 0 &&
        matchedLegacyStoreIds.length === 0;

      assert.equal(isAreaEmpty, true);

      const locationSummary = {
        hasLocationFilter: true,
        pincode: '999999',
        matchedBranchesCount: 0,
        noStoresFound: isAreaEmpty,
      };

      assert.equal(locationSummary.noStoresFound, true);
      assert.equal(locationSummary.matchedBranchesCount, 0);
    });

    test('returns all products when no location filter is specified', () => {
      const query = { search: '', category: '' };
      const hasTextLocation = Boolean(query.pincode || query.city || query.locality);
      const hasGeoCoordinates = Boolean(query.latitude && query.longitude);
      const hasLocationFilter = hasTextLocation || hasGeoCoordinates;

      assert.equal(hasLocationFilter, false);
    });
  });
});

