import { ApiError } from '../utils/ApiError.js';
import { USER_ROLES, VERIFICATION_STATUS } from '../models/user.model.js';
import { Store } from '../models/store.model.js';

/**
 * Role-Based Access Control (RBAC) Middleware Factory.
 * Restricts route access to the specified user roles (CUSTOMER, SELLER, ADMIN).
 */
export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(
        new ApiError(401, 'Authentication required before role authorization.', 'UNAUTHORIZED')
      );
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ApiError(
          403,
          `Access denied. Role [${req.user.role}] is not authorized to access this resource. Required: [${allowedRoles.join(', ')}]`,
          'FORBIDDEN_ROLE'
        )
      );
    }

    next();
  };
};

/**
 * Ensures a SELLER account and store have been verified (APPROVED) by an ADMIN
 * before performing restricted operational actions (product creation/editing,
 * batch management, inventory adjustments, order status updates, and QR verification).
 *
 * Rules:
 * 1. ADMIN users have platform oversight and bypass this check.
 * 2. Non-SELLER users are blocked with 403 SELLER_ROLE_REQUIRED.
 * 3. Explicitly REJECTED sellers/stores are blocked with 403 STORE_REJECTED.
 * 4. Explicitly SUSPENDED sellers/stores are blocked with 403 STORE_SUSPENDED.
 * 5. PENDING sellers/stores are blocked with 403 SELLER_NOT_APPROVED.
 * 6. Symmetrically checks both User.verificationStatus and Store.verificationStatus.
 */
export const requireApprovedSeller = async (req, res, next) => {
  try {
    if (!req.user) {
      return next(
        new ApiError(401, 'Authentication required before verification check.', 'UNAUTHORIZED')
      );
    }

    // Admins bypass seller verification checks for operational oversight
    if (req.user.role === USER_ROLES.ADMIN) {
      return next();
    }

    if (req.user.role !== USER_ROLES.SELLER) {
      return next(
        new ApiError(403, 'Access denied. Seller account required.', 'SELLER_ROLE_REQUIRED')
      );
    }

    // Retrieve seller's store if not already cached on req
    let store = req.sellerStore;
    if (!store) {
      store = await Store.findOne({ ownerId: req.user._id });
      if (store) {
        req.sellerStore = store;
      }
    }

    // Check for explicit REJECTED status on user or store
    if (
      req.user.verificationStatus === VERIFICATION_STATUS.REJECTED ||
      store?.verificationStatus === VERIFICATION_STATUS.REJECTED
    ) {
      return next(
        new ApiError(
          403,
          'Your store application has been rejected. Operational actions are restricted.',
          'STORE_REJECTED'
        )
      );
    }

    // Check for explicit SUSPENDED status on user or store
    if (
      req.user.verificationStatus === VERIFICATION_STATUS.SUSPENDED ||
      store?.verificationStatus === VERIFICATION_STATUS.SUSPENDED
    ) {
      return next(
        new ApiError(
          403,
          'Your store account is currently suspended. Operational actions are restricted.',
          'STORE_SUSPENDED'
        )
      );
    }

    // Symmetrically check User and Store approval status
    const isApproved =
      req.user.verificationStatus === VERIFICATION_STATUS.APPROVED ||
      store?.verificationStatus === VERIFICATION_STATUS.APPROVED;

    if (!isApproved) {
      const currentStatus = req.user.verificationStatus || store?.verificationStatus || 'PENDING';
      return next(
        new ApiError(
          403,
          `Seller verification status is currently [${currentStatus}]. Admin approval is required before performing this action.`,
          'SELLER_NOT_APPROVED'
        )
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};
