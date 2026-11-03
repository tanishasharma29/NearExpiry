import { z } from 'zod';
import { VERIFICATION_STATUS } from '../models/user.model.js';
import { PRODUCT_STATUS } from '../models/product.model.js';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const sellerApprovalSchema = z.object({
  params: z.object({
    id: z.string().regex(objectIdRegex, 'Invalid seller ID format'),
  }),
  body: z.object({
    status: z.enum([
      VERIFICATION_STATUS.APPROVED,
      VERIFICATION_STATUS.REJECTED,
      VERIFICATION_STATUS.SUSPENDED,
    ]),
    rejectionReason: z.string().trim().max(500).optional(),
  }),
});

export const documentVerificationSchema = z.object({
  params: z.object({
    id: z.string().regex(objectIdRegex, 'Invalid seller ID format'),
    docType: z.enum(['pan', 'gstin', 'fssai']),
  }),
  body: z
    .object({
      status: z.enum(['VERIFIED', 'REJECTED', 'SUBMITTED_NOT_VERIFIED', 'NOT_PROVIDED']),
      rejectionReason: z.string().trim().max(500).optional(),
      notes: z.string().trim().max(500).optional(),
    })
    .refine(
      (data) => {
        if (data.status === 'REJECTED') {
          return Boolean(data.rejectionReason && data.rejectionReason.trim().length > 0);
        }
        return true;
      },
      {
        message: 'Rejection reason is required when document status is REJECTED',
        path: ['rejectionReason'],
      }
    ),
});

export const userStatusSchema = z.object({
  params: z.object({
    id: z.string().regex(objectIdRegex, 'Invalid user ID format'),
  }),
  body: z.object({
    isActive: z.boolean({ required_error: 'isActive boolean flag is required' }),
    reason: z.string().trim().max(300).optional(),
  }),
});

export const storeStatusSchema = z.object({
  params: z.object({
    id: z.string().regex(objectIdRegex, 'Invalid store ID format'),
  }),
  body: z.object({
    isActive: z.boolean().optional(),
    verificationStatus: z
      .enum([
        VERIFICATION_STATUS.APPROVED,
        VERIFICATION_STATUS.REJECTED,
        VERIFICATION_STATUS.SUSPENDED,
      ])
      .optional(),
  }),
});

export const productModerationSchema = z.object({
  params: z.object({
    id: z.string().regex(objectIdRegex, 'Invalid product ID format'),
  }),
  body: z.object({
    status: z.enum([
      PRODUCT_STATUS.ACTIVE,
      PRODUCT_STATUS.INACTIVE,
      PRODUCT_STATUS.ARCHIVED,
    ]),
    moderationNote: z.string().trim().max(500).optional(),
  }),
});

export const idParamSchema = z.object({
  params: z.object({
    id: z.string().regex(objectIdRegex, 'Invalid ID format'),
  }),
});
