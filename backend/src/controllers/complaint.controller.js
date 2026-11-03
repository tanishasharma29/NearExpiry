import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import {
  createCustomerComplaintService,
  listCustomerComplaintsService,
  getCustomerComplaintByIdService,
  replyCustomerComplaintService,
  closeCustomerComplaintService,
  listAdminComplaintsService,
  getAdminComplaintDossierService,
  updateAdminComplaintStatusService,
  updateAdminComplaintPriorityService,
  assignAdminComplaintService,
  sendAdminMessageService,
  addAdminInternalNoteService,
  resolveAdminComplaintService,
} from '../services/complaint.service.js';

// =========================================================================
// CUSTOMER CONTROLLERS
// =========================================================================

export const createCustomerComplaint = asyncHandler(async (req, res) => {
  const complaint = await createCustomerComplaintService(req.user, req.body);
  return res.status(201).json(new ApiResponse(201, 'Complaint created successfully', complaint));
});

export const listCustomerComplaints = asyncHandler(async (req, res) => {
  const result = await listCustomerComplaintsService(req.user, req.query);
  return res
    .status(200)
    .json(new ApiResponse(200, 'Customer complaints retrieved successfully', result.complaints, result.pagination));
});

export const getCustomerComplaintDetails = asyncHandler(async (req, res) => {
  const complaint = await getCustomerComplaintByIdService(req.params.complaintId, req.user);
  return res.status(200).json(new ApiResponse(200, 'Complaint details retrieved successfully', complaint));
});

export const replyCustomerComplaint = asyncHandler(async (req, res) => {
  const complaint = await replyCustomerComplaintService(req.params.complaintId, req.user, req.body);
  return res.status(200).json(new ApiResponse(200, 'Reply sent successfully', complaint));
});

export const closeCustomerComplaint = asyncHandler(async (req, res) => {
  const complaint = await closeCustomerComplaintService(req.params.complaintId, req.user, req.body.reason);
  return res.status(200).json(new ApiResponse(200, 'Complaint closed successfully', complaint));
});

export const uploadComplaintEvidence = asyncHandler(async (req, res) => {
  const { image, filename } = req.body;
  if (!image || typeof image !== 'string') {
    throw new ApiError(400, 'Image data is required.', 'IMAGE_REQUIRED');
  }

  // Support base64 data URLs: data:image/(png|jpeg|jpg|webp);base64,...
  const matches = image.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i);
  if (!matches) {
    throw new ApiError(
      400,
      'Unsupported image format. Allowed formats are PNG, JPG, and WEBP.',
      'INVALID_IMAGE_FORMAT'
    );
  }

  const mimeType = matches[1].toLowerCase();
  const base64Data = matches[2];
  const buffer = Buffer.from(base64Data, 'base64');

  // Enforce 5MB limit
  const maxBytes = 5 * 1024 * 1024;
  if (buffer.length > maxBytes) {
    throw new ApiError(400, 'Image file size exceeds the 5MB limit.', 'IMAGE_TOO_LARGE');
  }

  // Create uploads/evidence directory if it doesn't exist
  const uploadsDir = path.resolve(process.cwd(), 'uploads', 'evidence');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const ext = mimeType === 'jpeg' ? 'jpg' : mimeType;
  const uniqueName = `evidence-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
  const filePath = path.join(uploadsDir, uniqueName);

  await fs.promises.writeFile(filePath, buffer);

  // Return full accessible URL
  const host = req.get('host');
  const protocol = req.protocol;
  const publicUrl = `${protocol}://${host}/uploads/evidence/${uniqueName}`;

  return res.status(200).json(
    new ApiResponse(200, 'Evidence image uploaded successfully', {
      url: publicUrl,
      filename: uniqueName,
      size: buffer.length,
      mimeType: `image/${mimeType}`,
    })
  );
});

// =========================================================================
// ADMIN CONTROLLERS
// =========================================================================

export const listAdminComplaints = asyncHandler(async (req, res) => {
  const result = await listAdminComplaintsService(req.query);
  return res
    .status(200)
    .json(new ApiResponse(200, 'Platform complaints retrieved successfully', result.complaints, result.pagination));
});

export const getAdminComplaintDossier = asyncHandler(async (req, res) => {
  const dossier = await getAdminComplaintDossierService(req.params.complaintId);
  return res.status(200).json(new ApiResponse(200, 'Complaint dossier retrieved successfully', dossier));
});

export const updateAdminComplaintStatus = asyncHandler(async (req, res) => {
  const complaint = await updateAdminComplaintStatusService(req.params.complaintId, req.user, req.body);
  return res.status(200).json(new ApiResponse(200, 'Complaint status updated successfully', complaint));
});

export const updateAdminComplaintPriority = asyncHandler(async (req, res) => {
  const complaint = await updateAdminComplaintPriorityService(req.params.complaintId, req.user, req.body);
  return res.status(200).json(new ApiResponse(200, 'Complaint priority updated successfully', complaint));
});

export const assignAdminComplaint = asyncHandler(async (req, res) => {
  const complaint = await assignAdminComplaintService(req.params.complaintId, req.user, req.body);
  return res.status(200).json(new ApiResponse(200, 'Complaint assigned successfully', complaint));
});

export const sendAdminMessage = asyncHandler(async (req, res) => {
  const complaint = await sendAdminMessageService(req.params.complaintId, req.user, req.body);
  return res.status(200).json(new ApiResponse(200, 'Message processed successfully', complaint));
});

export const addAdminInternalNote = asyncHandler(async (req, res) => {
  const complaint = await addAdminInternalNoteService(req.params.complaintId, req.user, req.body);
  return res.status(200).json(new ApiResponse(200, 'Internal note added successfully', complaint));
});

export const resolveAdminComplaint = asyncHandler(async (req, res) => {
  const complaint = await resolveAdminComplaintService(req.params.complaintId, req.user, req.body);
  return res.status(200).json(new ApiResponse(200, 'Complaint resolution processed successfully', complaint));
});

