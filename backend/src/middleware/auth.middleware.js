import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { User } from '../models/user.model.js';

/**
 * Mandatory JWT Authentication Middleware.
 */
export const authenticate = asyncHandler(async (req, res, next) => {
  let token = null;

  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1]?.trim();
  } else if (req.cookies && req.cookies.nearexpiry_token) {
    token = req.cookies.nearexpiry_token;
  }

  if (!token) {
    throw new ApiError(
      401,
      'Authentication required. Please provide a valid Bearer token.',
      'AUTH_TOKEN_MISSING'
    );
  }

  const decoded = verifyAccessToken(token);

  const user = await User.findById(decoded.sub);
  if (!user) {
    throw new ApiError(401, 'User belonging to this token no longer exists.', 'USER_NOT_FOUND');
  }

  if (!user.isActive) {
    throw new ApiError(
      403,
      'Your account has been deactivated. Please contact support.',
      'ACCOUNT_DEACTIVATED'
    );
  }

  if ((decoded.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)) {
    throw new ApiError(
      401,
      'Token has been invalidated due to logout. Please log in again.',
      'TOKEN_REVOKED'
    );
  }

  req.user = user;
  next();
});

/**
 * Optional Authentication Middleware.
 * Populates req.user if a valid Bearer token is supplied, or proceeds as guest if absent.
 * Used on public/shared endpoints (e.g., GET /stores/:id) where role determines visibility of PENDING stores.
 */
export const optionalAuthenticate = asyncHandler(async (req, res, next) => {
  let token = null;
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1]?.trim();
  } else if (req.cookies && req.cookies.nearexpiry_token) {
    token = req.cookies.nearexpiry_token;
  }

  if (!token) {
    return next();
  }

  try {
    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.sub);
    if (user && user.isActive && (decoded.tokenVersion ?? 0) === (user.tokenVersion ?? 0)) {
      req.user = user;
    }
  } catch (_) {
    // Ignore invalid token on optional public endpoints
  }

  next();
});
