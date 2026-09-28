import { ApiError } from '../utils/ApiError.js';
import { USER_ROLES, VERIFICATION_STATUS } from '../models/user.model.js';

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
 * Ensures a SELLER account has been verified (APPROVED) by an ADMIN
 * before performing restricted operational actions (such as listing batches).
 */
export const requireApprovedSeller = (req, res, next) => {
  if (!req.user || req.user.role !== USER_ROLES.SELLER) {
    return next(new ApiError(403, 'Seller account required.', 'SELLER_ROLE_REQUIRED'));
  }

  if (req.user.verificationStatus !== VERIFICATION_STATUS.APPROVED) {
    return next(
      new ApiError(
        403,
        `Seller verification status is currently [${req.user.verificationStatus}]. Admin approval is required before performing this action.`,
        'SELLER_NOT_APPROVED'
      )
    );
  }

  next();
};
