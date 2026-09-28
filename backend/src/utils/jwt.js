import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from './ApiError.js';

/**
 * Generates a signed JWT access token containing user identity, role,
 * seller verification status, and tokenVersion (for instant logout revocation).
 */
export const generateAccessToken = (user) => {
  const payload = {
    sub: user._id.toString(),
    email: user.email,
    role: user.role,
    verificationStatus: user.verificationStatus,
    tokenVersion: user.tokenVersion ?? 0,
  };

  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });
};

/**
 * Verifies a JWT access token and throws structured 401 ApiErrors on failure.
 */
export const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, env.JWT_SECRET);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new ApiError(401, 'Session expired. Please log in again.', 'TOKEN_EXPIRED');
    }
    throw new ApiError(401, 'Invalid authentication token.', 'INVALID_TOKEN');
  }
};
