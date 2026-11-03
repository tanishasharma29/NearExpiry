import { DOCUMENT_VERIFICATION_STATUS } from '../models/user.model.js';

export { DOCUMENT_VERIFICATION_STATUS };

export const DOCUMENT_STATUS_LABELS = Object.freeze({
  [DOCUMENT_VERIFICATION_STATUS.NOT_PROVIDED]: 'Not provided',
  [DOCUMENT_VERIFICATION_STATUS.SUBMITTED_NOT_VERIFIED]: 'Submitted — Not verified',
  [DOCUMENT_VERIFICATION_STATUS.VERIFIED]: 'Verified',
  [DOCUMENT_VERIFICATION_STATUS.REJECTED]: 'Rejected',
});

/**
 * Resolves the true document verification status.
 *
 * Rules:
 * 1. If no document value exists (or empty string), it is ALWAYS 'NOT_PROVIDED'.
 * 2. If a document value was submitted:
 *    - 'VERIFIED' only if an authorized administrator explicitly verified it.
 *    - 'REJECTED' only if an authorized administrator explicitly rejected it.
 *    - Otherwise 'SUBMITTED_NOT_VERIFIED'.
 * 3. Never infer verification from store approval status!
 */
export const resolveDocumentStatus = (docNumber, explicitStatus) => {
  if (!docNumber || typeof docNumber !== 'string' || !docNumber.trim()) {
    return DOCUMENT_VERIFICATION_STATUS.NOT_PROVIDED;
  }

  if (explicitStatus === DOCUMENT_VERIFICATION_STATUS.VERIFIED) {
    return DOCUMENT_VERIFICATION_STATUS.VERIFIED;
  }

  if (explicitStatus === DOCUMENT_VERIFICATION_STATUS.REJECTED) {
    return DOCUMENT_VERIFICATION_STATUS.REJECTED;
  }

  return DOCUMENT_VERIFICATION_STATUS.SUBMITTED_NOT_VERIFIED;
};

/**
 * Builds a structured document verification summary for a seller and store.
 */
export const extractDocumentDossier = (seller, store) => {
  const sellerProfile = seller?.sellerProfile || {};
  const businessDetails = store?.businessDetails || {};
  const userDocs = sellerProfile.documentVerification || seller?.documentVerification || {};
  const storeDocs = store?.documentVerification || {};

  // PAN / Business License
  const panValue =
    sellerProfile.panNumber ||
    businessDetails.panNumber ||
    sellerProfile.businessLicenseNumber ||
    businessDetails.businessLicenseNumber ||
    null;
  const panExplicitStatus = userDocs.pan?.status || storeDocs.pan?.status || null;
  const panStatus = resolveDocumentStatus(panValue, panExplicitStatus);

  // GSTIN
  const gstinValue = sellerProfile.gstNumber || businessDetails.gstNumber || null;
  const gstinExplicitStatus = userDocs.gstin?.status || storeDocs.gstin?.status || null;
  const gstinStatus = resolveDocumentStatus(gstinValue, gstinExplicitStatus);

  // FSSAI
  const fssaiValue = sellerProfile.fssaiLicenseNumber || businessDetails.fssaiLicenseNumber || null;
  const fssaiExplicitStatus = userDocs.fssai?.status || storeDocs.fssai?.status || null;
  const fssaiStatus = resolveDocumentStatus(fssaiValue, fssaiExplicitStatus);

  const hasMissingDocs =
    panStatus === DOCUMENT_VERIFICATION_STATUS.NOT_PROVIDED ||
    gstinStatus === DOCUMENT_VERIFICATION_STATUS.NOT_PROVIDED ||
    fssaiStatus === DOCUMENT_VERIFICATION_STATUS.NOT_PROVIDED;

  const hasUnverifiedDocs =
    panStatus === DOCUMENT_VERIFICATION_STATUS.SUBMITTED_NOT_VERIFIED ||
    gstinStatus === DOCUMENT_VERIFICATION_STATUS.SUBMITTED_NOT_VERIFIED ||
    fssaiStatus === DOCUMENT_VERIFICATION_STATUS.SUBMITTED_NOT_VERIFIED;

  const storeStatus = store?.verificationStatus || seller?.verificationStatus || 'PENDING';
  const isDemoApproved = storeStatus === 'APPROVED' && (hasMissingDocs || hasUnverifiedDocs);

  return {
    storeStatus,
    isDemoApproved,
    pan: {
      number: panValue,
      status: panStatus,
      label: DOCUMENT_STATUS_LABELS[panStatus],
      displayStatus: DOCUMENT_STATUS_LABELS[panStatus],
      isVerified: panStatus === DOCUMENT_VERIFICATION_STATUS.VERIFIED,
      verifiedAt: userDocs.pan?.verifiedAt || storeDocs.pan?.verifiedAt || null,
      verifiedBy: userDocs.pan?.verifiedBy || storeDocs.pan?.verifiedBy || null,
      notes: userDocs.pan?.notes || storeDocs.pan?.notes || null,
    },
    gstin: {
      number: gstinValue,
      status: gstinStatus,
      label: DOCUMENT_STATUS_LABELS[gstinStatus],
      displayStatus: DOCUMENT_STATUS_LABELS[gstinStatus],
      isVerified: gstinStatus === DOCUMENT_VERIFICATION_STATUS.VERIFIED,
      verifiedAt: userDocs.gstin?.verifiedAt || storeDocs.gstin?.verifiedAt || null,
      verifiedBy: userDocs.gstin?.verifiedBy || storeDocs.gstin?.verifiedBy || null,
      notes: userDocs.gstin?.notes || storeDocs.gstin?.notes || null,
    },
    fssai: {
      number: fssaiValue,
      status: fssaiStatus,
      label: DOCUMENT_STATUS_LABELS[fssaiStatus],
      displayStatus: DOCUMENT_STATUS_LABELS[fssaiStatus],
      isVerified: fssaiStatus === DOCUMENT_VERIFICATION_STATUS.VERIFIED,
      verifiedAt: userDocs.fssai?.verifiedAt || storeDocs.fssai?.verifiedAt || null,
      verifiedBy: userDocs.fssai?.verifiedBy || storeDocs.fssai?.verifiedBy || null,
      notes: userDocs.fssai?.notes || storeDocs.fssai?.notes || null,
    },
    allDocumentsVerified:
      panStatus === DOCUMENT_VERIFICATION_STATUS.VERIFIED &&
      gstinStatus === DOCUMENT_VERIFICATION_STATUS.VERIFIED &&
      fssaiStatus === DOCUMENT_VERIFICATION_STATUS.VERIFIED,
    hasMissingDocs,
    hasUnverifiedDocs,
  };
};
