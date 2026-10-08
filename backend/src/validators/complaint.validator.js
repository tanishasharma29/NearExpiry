import { z } from 'zod';
import {
  COMPLAINT_STATUS,
  COMPLAINT_CATEGORY,
  COMPLAINT_PRIORITY,
  RESOLUTION_DECISION,
  RESOLUTION_ACTION_TYPE,
} from '../models/complaint.model.js';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const createComplaintSchema = z.object({
  body: z.object({
    orderId: z
      .string({ required_error: 'Order ID is required' })
      .regex(objectIdRegex, 'Invalid Order ID format'),
    category: z.enum(Object.values(COMPLAINT_CATEGORY), {
      required_error: 'Complaint category is required',
    }),
    subject: z
      .string({ required_error: 'Subject is required' })
      .trim()
      .min(3, 'Subject must be at least 3 characters')
      .max(200, 'Subject cannot exceed 200 characters'),
    description: z
      .string({ required_error: 'Description is required' })
      .trim()
      .min(10, 'Description must be at least 10 characters')
      .max(3000, 'Description cannot exceed 3000 characters'),
    relatedItemId: z
      .string()
      .regex(objectIdRegex, 'Invalid Item ID format')
      .optional()
      .nullable(),
    evidenceUrls: z
      .array(z.string().trim().url('Each evidence URL must be a valid URL'))
      .max(10, 'Maximum 10 evidence items allowed')
      .optional()
      .default([]),
  }),
});

export const complaintIdParamSchema = z.object({
  params: z.object({
    complaintId: z
      .string({ required_error: 'Complaint ID is required' })
      .regex(objectIdRegex, 'Invalid Complaint ID format'),
  }),
});

export const customerReplySchema = z.object({
  params: z.object({
    complaintId: z
      .string({ required_error: 'Complaint ID is required' })
      .regex(objectIdRegex, 'Invalid Complaint ID format'),
  }),
  body: z.object({
    message: z
      .string({ required_error: 'Message is required' })
      .trim()
      .min(1, 'Message cannot be empty')
      .max(2000, 'Message cannot exceed 2000 characters'),
    attachments: z
      .array(z.string().trim().url('Each attachment must be a valid URL'))
      .max(5, 'Maximum 5 attachments allowed')
      .optional()
      .default([]),
  }),
});

export const adminStatusUpdateSchema = z.object({
  params: z.object({
    complaintId: z
      .string({ required_error: 'Complaint ID is required' })
      .regex(objectIdRegex, 'Invalid Complaint ID format'),
  }),
  body: z.object({
    status: z.enum(Object.values(COMPLAINT_STATUS), {
      required_error: 'Status is required',
    }),
    note: z
      .string()
      .trim()
      .max(500, 'Status note cannot exceed 500 characters')
      .optional(),
  }),
});

export const adminPriorityUpdateSchema = z.object({
  params: z.object({
    complaintId: z
      .string({ required_error: 'Complaint ID is required' })
      .regex(objectIdRegex, 'Invalid Complaint ID format'),
  }),
  body: z.object({
    priority: z.enum(Object.values(COMPLAINT_PRIORITY), {
      required_error: 'Priority is required',
    }),
    note: z
      .string()
      .trim()
      .max(500, 'Priority note cannot exceed 500 characters')
      .optional(),
  }),
});

export const adminAssignSchema = z.object({
  params: z.object({
    complaintId: z
      .string({ required_error: 'Complaint ID is required' })
      .regex(objectIdRegex, 'Invalid Complaint ID format'),
  }),
  body: z.object({
    adminId: z
      .string()
      .regex(objectIdRegex, 'Invalid Admin User ID format')
      .nullable()
      .optional(),
  }),
});

export const adminMessageSchema = z.object({
  params: z.object({
    complaintId: z
      .string({ required_error: 'Complaint ID is required' })
      .regex(objectIdRegex, 'Invalid Complaint ID format'),
  }),
  body: z.object({
    message: z
      .string({ required_error: 'Message is required' })
      .trim()
      .min(1, 'Message cannot be empty')
      .max(3000, 'Message cannot exceed 3000 characters'),
    attachments: z
      .array(z.string().trim().url('Each attachment must be a valid URL'))
      .max(5, 'Maximum 5 attachments allowed')
      .optional()
      .default([]),
    isInternalNote: z.boolean().optional().default(false),
  }),
});

export const adminInternalNoteSchema = z.object({
  params: z.object({
    complaintId: z
      .string({ required_error: 'Complaint ID is required' })
      .regex(objectIdRegex, 'Invalid Complaint ID format'),
  }),
  body: z.object({
    note: z
      .string({ required_error: 'Internal note is required' })
      .trim()
      .min(2, 'Internal note must be at least 2 characters')
      .max(3000, 'Internal note cannot exceed 3000 characters'),
  }),
});

export const adminResolveComplaintSchema = z.object({
  params: z.object({
    complaintId: z
      .string({ required_error: 'Complaint ID is required' })
      .regex(objectIdRegex, 'Invalid Complaint ID format'),
  }),
  body: z.object({
    decision: z.enum(Object.values(RESOLUTION_DECISION), {
      required_error: 'Resolution decision is required',
    }),
    notes: z
      .string({ required_error: 'Resolution notes are required' })
      .trim()
      .min(5, 'Resolution notes must be at least 5 characters')
      .max(2000, 'Resolution notes cannot exceed 2000 characters'),
    refundAmount: z
      .number()
      .min(0, 'Refund amount cannot be negative')
      .optional()
      .default(0),
    actionRequested: z
      .enum(Object.values(RESOLUTION_ACTION_TYPE))
      .optional()
      .default(RESOLUTION_ACTION_TYPE.NONE),
  }),
});

