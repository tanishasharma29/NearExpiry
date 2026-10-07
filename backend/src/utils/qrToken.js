import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { ApiError } from './ApiError.js';

const base64UrlEncode = (str) =>
  Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

const base64UrlDecode = (str) => {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
};

/**
 * Generate a cryptographically signed, URL-safe QR verification token for a physical batch lot.
 */
export const generateSecureQrToken = (batchId, existingNonce = null) => {
  const secret =
    env.QR_SIGNING_SECRET || env.JWT_SECRET || 'nearexpiry_qr_hmac_signing_key_2026';
  const nonce = existingNonce || crypto.randomBytes(16).toString('hex');

  const header = { alg: 'HS256', typ: 'NE-QR' };
  const payload = {
    v: 1,
    bid: batchId.toString(),
    nonce,
    iat: Math.floor(Date.now() / 1000),
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const fullToken = `${data}.${signature}`;
  const tokenHash = crypto.createHash('sha256').update(fullToken).digest('hex');

  return {
    token: fullToken,
    nonce,
    tokenHash,
  };
};

/**
 * Verify and decode an HMAC-SHA256 signed Batch QR token.
 */
export const verifySecureQrToken = (token) => {
  if (!token || typeof token !== 'string') {
    throw new ApiError(400, 'QR verification token is required.', 'INVALID_TOKEN');
  }

  const parts = token.trim().split('.');
  if (parts.length !== 3) {
    throw new ApiError(400, 'Malformed QR token format.', 'MALFORMED_QR_TOKEN');
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  const secret =
    env.QR_SIGNING_SECRET || env.JWT_SECRET || 'nearexpiry_qr_hmac_signing_key_2026';
  const data = `${encodedHeader}.${encodedPayload}`;

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    sigBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
  ) {
    throw new ApiError(
      400,
      'Invalid or forged QR token signature. Do not trust unverified QR codes.',
      'INVALID_QR_SIGNATURE'
    );
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    if (!payload.bid || !payload.nonce) {
      throw new ApiError(400, 'Invalid QR token payload claims.', 'INVALID_TOKEN_CLAIMS');
    }

    const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');

    return {
      batchId: payload.bid,
      tokenNonce: payload.nonce,
      issuedAt: new Date(payload.iat * 1000),
      tokenHash,
    };
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(400, 'Unable to decode QR token payload.', 'INVALID_QR_PAYLOAD');
  }
};

/**
 * Generate a cryptographically signed, URL-safe QR pickup token for a customer self-pickup order.
 * Contains only nonces and opaque IDs with an expiry timestamp (default 48 hours).
 */
export const generatePickupQrToken = (orderId, customerId, storeId, ttlHours = 48) => {
  const secret =
    env.QR_SIGNING_SECRET || env.JWT_SECRET || 'nearexpiry_qr_hmac_signing_key_2026';
  const nonce = crypto.randomBytes(16).toString('hex');
  const nowSec = Math.floor(Date.now() / 1000);
  const expSec = nowSec + ttlHours * 3600;

  const header = { alg: 'HS256', typ: 'NE-PICKUP-QR' };
  const payload = {
    v: 1,
    typ: 'PICKUP',
    oid: orderId.toString(),
    cid: customerId.toString(),
    sid: storeId.toString(),
    nonce,
    exp: expSec,
    iat: nowSec,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const fullToken = `${data}.${signature}`;
  const tokenHash = crypto.createHash('sha256').update(fullToken).digest('hex');

  return {
    token: fullToken,
    nonce,
    tokenHash,
    expiresAt: new Date(expSec * 1000),
    generatedAt: new Date(nowSec * 1000),
  };
};

/**
 * Verify and decode an HMAC-SHA256 signed Self-Pickup QR token.
 * Rejects forged, malformed, or expired tokens.
 */
export const verifyPickupQrToken = (token) => {
  if (!token || typeof token !== 'string') {
    throw new ApiError(400, 'Invalid pickup QR.', 'INVALID_TOKEN');
  }

  const parts = token.trim().split('.');
  if (parts.length !== 3) {
    throw new ApiError(400, 'Invalid pickup QR.', 'MALFORMED_QR_TOKEN');
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  const secret =
    env.QR_SIGNING_SECRET || env.JWT_SECRET || 'nearexpiry_qr_hmac_signing_key_2026';
  const data = `${encodedHeader}.${encodedPayload}`;

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    sigBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
  ) {
    throw new ApiError(
      400,
      'Invalid pickup QR.',
      'INVALID_QR_SIGNATURE'
    );
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    if (!payload.oid || !payload.cid || !payload.sid || !payload.nonce) {
      throw new ApiError(400, 'Invalid pickup QR.', 'INVALID_TOKEN_CLAIMS');
    }

    if (payload.exp && Date.now() > payload.exp * 1000) {
      throw new ApiError(400, 'This pickup QR has expired.', 'EXPIRED_QR_TOKEN');
    }

    const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');

    return {
      orderId: payload.oid,
      customerId: payload.cid,
      storeId: payload.sid,
      tokenNonce: payload.nonce,
      expiresAt: payload.exp ? new Date(payload.exp * 1000) : null,
      issuedAt: new Date(payload.iat * 1000),
      tokenHash,
    };
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(400, 'Invalid pickup QR.', 'INVALID_QR_PAYLOAD');
  }
};
