import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { recordSecurityEvent, SECURITY_EVENT_TYPES } from '../utils/securityAudit.js';

export const apiRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.isDevelopment ? 10000 : env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    recordSecurityEvent({
      eventType: SECURITY_EVENT_TYPES.RATE_LIMIT_HIT,
      ipAddress: req.ip,
      path: req.originalUrl,
      method: req.method,
      statusCode: 429,
      details: { limiter: 'global' },
    });
    next(
      new ApiError(
        429,
        'Too many requests from this IP address. Please try again later.',
        'RATE_LIMIT_EXCEEDED'
      )
    );
  },
});

/**
 * Dedicated Strict Rate Limiter for Authentication Endpoints (Login & Register).
 * Prevents password dictionary attacks, credential stuffing, and bot account creation.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.isDevelopment ? 1000 : 15, // 15 attempts in production
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  handler: (req, res, next) => {
    recordSecurityEvent({
      eventType: SECURITY_EVENT_TYPES.RATE_LIMIT_HIT,
      ipAddress: req.ip,
      path: req.originalUrl,
      method: req.method,
      statusCode: 429,
      details: { limiter: 'auth' },
    });
    next(
      new ApiError(
        429,
        'Too many authentication attempts. Please try again after 15 minutes.',
        'AUTH_RATE_LIMIT_EXCEEDED'
      )
    );
  },
});

/**
 * Dedicated Rate Limiter for Payment Operations.
 * Prevents automated card testing and transaction flooding.
 */
export const paymentRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.isDevelopment ? 1000 : 30, // 30 payments in production
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    recordSecurityEvent({
      eventType: SECURITY_EVENT_TYPES.RATE_LIMIT_HIT,
      ipAddress: req.ip,
      path: req.originalUrl,
      method: req.method,
      statusCode: 429,
      details: { limiter: 'payment' },
    });
    next(
      new ApiError(
        429,
        'Payment request threshold exceeded. Please try again later.',
        'PAYMENT_RATE_LIMIT_EXCEEDED'
      )
    );
  },
});

/**
 * Dedicated Rate Limiter for Public QR Code Verification.
 * Prevents automated token enumeration and timing scans.
 */
export const qrRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: env.isDevelopment ? 2000 : 60, // 60 scans per minute in production
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(
      new ApiError(
        429,
        'Too many QR code verification requests. Please slow down.',
        'QR_RATE_LIMIT_EXCEEDED'
      )
    );
  },
});
