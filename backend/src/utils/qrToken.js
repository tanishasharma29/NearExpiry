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
 * Generate a cryptographically signed, URL-safe QR verification token.
 * Note: Expiry date is intentionally NOT stored inside the token.
 * The token only points securely to the batch ID and cryptographic nonce.
 */
export const generateSecureQrToken = (batchId) => {
  const secret = env.JWT_SECRET || 'nearexpiry-qr-fallback-secret';
  const nonce = crypto.randomBytes(16).toString('hex');

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
 * Verify and decode an HMAC-SHA256 signed QR token.
 * Rejects forged, truncated, or tampered tokens.
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
  const secret = env.JWT_SECRET || 'nearexpiry-qr-fallback-secret';
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
