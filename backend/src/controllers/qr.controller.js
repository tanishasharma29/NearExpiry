import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import {
  generateBatchQrService,
  verifyBatchQrService,
  revokeBatchQrService,
  getBatchQrAuditLogsService,
} from '../services/qr.service.js';

/**
 * @desc    Generate Cryptographic QR for a Batch Lot
 * @route   POST /api/v1/qr/batch/:batchId
 * @access  Private (SELLER / ADMIN)
 */
export const generateBatchQr = asyncHandler(async (req, res) => {
  const result = await generateBatchQrService(req.params.batchId, req.user);
  return res.status(200).json(
    new ApiResponse(200, 'Batch QR generated successfully', result)
  );
});

/**
 * @desc    Public QR Batch Verification (Authenticates via MongoDB source of truth)
 * @route   POST /api/v1/qr/verify
 * @route   GET /api/v1/qr/verify
 * @access  Public
 */
export const verifyBatchQr = asyncHandler(async (req, res) => {
  const token = req.query.token || req.body?.token;
  const auditContext = {
    ipAddress: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
    userAgent: req.headers['user-agent'] || 'unknown',
    userActor: req.user || null,
  };

  const result = await verifyBatchQrService(token, auditContext);
  return res.status(200).json(
    new ApiResponse(200, 'QR verification completed', result)
  );
});

/**
 * @desc    Revoke QR Code for a Batch Lot
 * @route   POST /api/v1/qr/batch/:batchId/revoke
 * @access  Private (SELLER / ADMIN)
 */
export const revokeBatchQr = asyncHandler(async (req, res) => {
  const result = await revokeBatchQrService(
    req.params.batchId,
    req.user,
    req.body.reason
  );
  return res.status(200).json(
    new ApiResponse(200, 'Batch QR revoked successfully', result)
  );
});

/**
 * @desc    Get QR Scan Audit History
 * @route   GET /api/v1/qr/batch/:batchId/audit
 * @access  Private (SELLER / ADMIN)
 */
export const getBatchQrAuditLogs = asyncHandler(async (req, res) => {
  const result = await getBatchQrAuditLogsService(req.params.batchId, req.user);
  return res.status(200).json(
    new ApiResponse(200, 'Batch QR audit history retrieved', result)
  );
});
