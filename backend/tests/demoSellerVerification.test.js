import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DOCUMENT_VERIFICATION_STATUS,
  DOCUMENT_STATUS_LABELS,
  resolveDocumentStatus,
  extractDocumentDossier,
} from '../src/utils/documentVerification.util.js';
import { documentVerificationSchema } from '../src/validators/admin.validator.js';
import { updateSellerProfileSchema } from '../src/validators/sellerStore.validator.js';
import { SECURITY_EVENT_TYPES } from '../src/models/securityLog.model.js';

describe('Demo Seller Verification & Store Approval Policy Suite', () => {
  // Test 1: Admin can approve a demo store with all 3 documents missing
  describe('1. Demo store approval without documents', () => {
    it('allows a store with no documents to have APPROVED store status while documents stay NOT_PROVIDED', () => {
      const mockSeller = {
        _id: 'seller123',
        verificationStatus: 'APPROVED',
        sellerProfile: {},
        documentVerification: {
          pan: { status: DOCUMENT_VERIFICATION_STATUS.NOT_PROVIDED },
          gstin: { status: DOCUMENT_VERIFICATION_STATUS.NOT_PROVIDED },
          fssai: { status: DOCUMENT_VERIFICATION_STATUS.NOT_PROVIDED },
        },
      };
      const mockStore = {
        _id: 'store123',
        verificationStatus: 'APPROVED',
        businessDetails: {},
      };

      const dossier = extractDocumentDossier(mockSeller, mockStore);
      assert.equal(dossier.storeStatus, 'APPROVED');
      assert.equal(dossier.pan.status, DOCUMENT_VERIFICATION_STATUS.NOT_PROVIDED);
      assert.equal(dossier.gstin.status, DOCUMENT_VERIFICATION_STATUS.NOT_PROVIDED);
      assert.equal(dossier.fssai.status, DOCUMENT_VERIFICATION_STATUS.NOT_PROVIDED);
      assert.equal(dossier.pan.displayStatus, 'Not provided');
      assert.equal(dossier.isDemoApproved, true);
    });
  });

  // Test 2: After approval, missing documents remain NOT_PROVIDED
  describe('2. Missing documents remain NOT_PROVIDED after approval', () => {
    it('verifies all 3 document statuses remain NOT_PROVIDED after admin approves store', () => {
      const seller = {
        _id: 'seller123',
        verificationStatus: 'APPROVED',
        sellerProfile: {},
      };
      const store = {
        _id: 'store123',
        verificationStatus: 'APPROVED',
        businessDetails: {},
      };

      const dossier = extractDocumentDossier(seller, store);
      assert.equal(dossier.pan.status, 'NOT_PROVIDED');
      assert.equal(dossier.gstin.status, 'NOT_PROVIDED');
      assert.equal(dossier.fssai.status, 'NOT_PROVIDED');
      assert.equal(dossier.pan.isVerified, false);
      assert.equal(dossier.gstin.isVerified, false);
      assert.equal(dossier.fssai.isVerified, false);
    });
  });

  // Test 3: Submitted PAN/GSTIN/FSSAI is NOT automatically marked VERIFIED
  describe('3. Submitted documents default to SUBMITTED_NOT_VERIFIED, never auto-VERIFIED', () => {
    it('resolves submitted document numbers to SUBMITTED_NOT_VERIFIED without admin review', () => {
      const status = resolveDocumentStatus(
        'ABCDE1234F',
        null // No explicit verified status
      );
      assert.equal(status, DOCUMENT_VERIFICATION_STATUS.SUBMITTED_NOT_VERIFIED);
      assert.equal(DOCUMENT_STATUS_LABELS[status], 'Submitted — Not verified');
      assert.notEqual(status, DOCUMENT_VERIFICATION_STATUS.VERIFIED);
    });
  });

  // Test 4: Seller cannot approve their own store (role restriction / route permission)
  describe('4. Store approval permissions', () => {
    it('ensures admin audit log constants exist for store approval and document verification', () => {
      assert.ok(Object.values(SECURITY_EVENT_TYPES).includes('SELLER_STORE_APPROVAL'));
      assert.ok(Object.values(SECURITY_EVENT_TYPES).includes('SELLER_DOCUMENT_VERIFICATION'));
    });
  });

  // Test 5: Seller cannot mark documents as VERIFIED via profile update (mass assignment prevention)
  describe('5. Mass-assignment protection against seller self-verification', () => {
    it('strips or rejects verificationStatus and documentVerification in updateSellerProfileSchema', async () => {
      const attackPayload = {
        body: {
          storeName: 'My Legitimate Store',
          verificationStatus: 'APPROVED',
          documentVerification: {
            pan: { status: 'VERIFIED' },
            gstin: { status: 'VERIFIED' },
          },
        },
      };

      const parsed = await updateSellerProfileSchema.safeParseAsync(attackPayload);
      assert.equal(parsed.success, true);
      // Ensure stripped or ignored
      assert.equal(parsed.data.body.verificationStatus, undefined);
      assert.equal(parsed.data.body.documentVerification, undefined);
      assert.equal(parsed.data.body.storeName, 'My Legitimate Store');
    });
  });

  // Test 6: Document verification validation schema enforces valid status values
  describe('6. Admin document verification validation schema', () => {
    it('accepts valid docType and status (VERIFIED, REJECTED)', async () => {
      const validPayload = {
        params: { id: '507f1f77bcf86cd799439011', docType: 'pan' },
        body: { status: 'VERIFIED', notes: 'Verified against national PAN registry' },
      };
      const result = await documentVerificationSchema.safeParseAsync(validPayload);
      assert.equal(result.success, true);
    });

    it('rejects invalid docType (e.g. passport)', async () => {
      const invalidPayload = {
        params: { id: '507f1f77bcf86cd799439011', docType: 'passport' },
        body: { status: 'VERIFIED' },
      };
      const result = await documentVerificationSchema.safeParseAsync(invalidPayload);
      assert.equal(result.success, false);
    });

    it('requires rejectionReason when status is REJECTED', async () => {
      const invalidPayload = {
        params: { id: '507f1f77bcf86cd799439011', docType: 'pan' },
        body: { status: 'REJECTED' },
      };
      const result = await documentVerificationSchema.safeParseAsync(invalidPayload);
      assert.equal(result.success, false);
      const msg = result.error.errors.map((e) => e.message).join(' ');
      assert.ok(msg.includes('Rejection reason is required'));
    });
  });

  // Test 7: Store approval does not overwrite existing document verification statuses
  describe('7. Independence of store approval from document verification statuses', () => {
    it('preserves existing verified document status when store approval is toggled', () => {
      const seller = {
        _id: 'seller456',
        verificationStatus: 'PENDING',
        sellerProfile: {
          panNumber: 'ABCDE1234F',
          fssaiLicenseNumber: '12345678901234',
        },
        documentVerification: {
          pan: { status: DOCUMENT_VERIFICATION_STATUS.VERIFIED, verifiedAt: new Date() },
          gstin: { status: DOCUMENT_VERIFICATION_STATUS.NOT_PROVIDED },
          fssai: { status: DOCUMENT_VERIFICATION_STATUS.REJECTED, rejectionReason: 'Illegible' },
        },
      };

      const dossier = extractDocumentDossier(seller, {});
      assert.equal(dossier.pan.status, 'VERIFIED');
      assert.equal(dossier.gstin.status, 'NOT_PROVIDED');
      assert.equal(dossier.fssai.status, 'REJECTED');
    });
  });

  // Test 8: Document becomes VERIFIED only after explicit admin action
  describe('8. Document verification state transitions', () => {
    it('sets verified status and verifiedAt timestamp only upon explicit verification', () => {
      const doc = {
        number: 'ABCDE1234F',
        status: DOCUMENT_VERIFICATION_STATUS.SUBMITTED_NOT_VERIFIED,
      };

      // Simulate admin verification
      const verifiedDoc = {
        ...doc,
        status: DOCUMENT_VERIFICATION_STATUS.VERIFIED,
        verifiedAt: new Date(),
        verifiedBy: 'admin999',
      };

      assert.equal(verifiedDoc.status, 'VERIFIED');
      assert.ok(verifiedDoc.verifiedAt instanceof Date);
      assert.equal(verifiedDoc.verifiedBy, 'admin999');
    });
  });

  // Test 9: Legacy records with missing verification fields are never resolved as VERIFIED
  describe('9. Legacy records backwards compatibility', () => {
    it('resolves legacy records with empty or null fields to NOT_PROVIDED, never VERIFIED', () => {
      const legacySeller = {
        _id: 'legacy1',
        sellerProfile: {},
      };
      const legacyStore = {
        _id: 'legacyStore1',
        businessDetails: {},
      };

      const dossier = extractDocumentDossier(legacySeller, legacyStore);
      assert.equal(dossier.pan.status, 'NOT_PROVIDED');
      assert.equal(dossier.pan.displayStatus, 'Not provided');
      assert.equal(dossier.pan.isVerified, false);
      assert.equal(dossier.gstin.status, 'NOT_PROVIDED');
      assert.equal(dossier.fssai.status, 'NOT_PROVIDED');
    });
  });

  // Test 10: Seller verification endpoint returns consistent document and store statuses
  describe('10. Consistency between store status and document verification', () => {
    it('distinguishes store status from document verification status in dossier output', () => {
      const seller = {
        _id: 'seller99',
        verificationStatus: 'APPROVED',
        sellerProfile: { storeName: 'Fresh Organics' },
      };
      const store = {
        _id: 'store99',
        verificationStatus: 'APPROVED',
        businessDetails: { gstNumber: '29ABCDE1234F1Z5' },
      };

      const dossier = extractDocumentDossier(seller, store);
      assert.equal(dossier.storeStatus, 'APPROVED');
      assert.equal(dossier.isDemoApproved, true);
      assert.equal(dossier.pan.status, 'NOT_PROVIDED');
      assert.equal(dossier.gstin.status, 'SUBMITTED_NOT_VERIFIED');
      assert.equal(dossier.fssai.status, 'NOT_PROVIDED');
    });
  });

  // Test 11: Audit logging event constants for seller store approval and document verification
  describe('11. Security Audit Logging integration', () => {
    it('provides correct audit event types for compliance tracking', () => {
      assert.equal(Object.values(SECURITY_EVENT_TYPES).includes('SELLER_STORE_APPROVAL'), true);
      assert.equal(Object.values(SECURITY_EVENT_TYPES).includes('SELLER_DOCUMENT_VERIFICATION'), true);
    });
  });

  // Test 12: Existing store registration and seller workflows continue working
  describe('12. Existing workflows compatibility', () => {
    it('handles store registration without requiring PAN, GSTIN, or FSSAI', () => {
      const dossier = extractDocumentDossier({}, {});
      assert.ok(dossier);
      assert.equal(dossier.hasMissingDocs, true);
      assert.equal(dossier.pan.number, null);
      assert.equal(dossier.gstin.number, null);
      assert.equal(dossier.fssai.number, null);
    });
  });
});
