import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const verifyQrSchema = z.object({
  query: z
    .object({
      token: z.string().trim().min(20, 'QR token is too short').optional(),
    })
    .optional(),
  body: z
    .object({
      token: z.string().trim().min(20, 'QR token is too short').optional(),
    })
    .optional(),
});

export const batchIdParamSchema = z.object({
  params: z.object({
    batchId: z
      .string({ required_error: 'Batch ID is required' })
      .regex(objectIdRegex, 'Invalid Batch ID format'),
  }),
});

export const revokeQrSchema = z.object({
  params: z.object({
    batchId: z
      .string({ required_error: 'Batch ID is required' })
      .regex(objectIdRegex, 'Invalid Batch ID format'),
  }),
  body: z.object({
    reason: z
      .string({ required_error: 'Revocation reason is required' })
      .trim()
      .min(3, 'Revocation reason must be at least 3 characters')
      .max(300, 'Revocation reason cannot exceed 300 characters'),
  }),
});
