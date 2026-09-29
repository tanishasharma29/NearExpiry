import { z } from 'zod';

const objectIdString = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'Must be a valid 24-character MongoDB ObjectId');

export const createPriceRuleSchema = z.object({
  body: z
    .object({
      name: z
        .string({ required_error: 'Rule name is required' })
        .trim()
        .min(2, 'Rule name must be at least 2 characters')
        .max(120),
      minDays: z.coerce
        .number({ required_error: 'minDays is required' })
        .int('minDays must be an integer')
        .min(0, 'minDays must be >= 0'),
      maxDays: z
        .union([
          z.coerce.number().int('maxDays must be an integer').min(0),
          z.null(),
        ])
        .optional()
        .default(null),
      discountPercentage: z.coerce
        .number({ required_error: 'discountPercentage is required' })
        .min(0, 'discountPercentage cannot be negative (< 0%)')
        .max(100, 'discountPercentage cannot exceed 100%'),
      categoryId: objectIdString.nullable().optional().default(null),
      priority: z.coerce.number().int().min(1).max(100).optional(),
      isActive: z.boolean().optional().default(true),
    })
    .superRefine((data, ctx) => {
      if (data.maxDays !== null && data.maxDays !== undefined && data.maxDays < data.minDays) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['maxDays'],
          message: 'maxDays must be greater than or equal to minDays (or null for unbounded 61+)',
        });
      }
    }),
});

export const updatePriceRuleSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(2).max(120).optional(),
      minDays: z.coerce.number().int().min(0).optional(),
      maxDays: z.union([z.coerce.number().int().min(0), z.null()]).optional(),
      discountPercentage: z.coerce
        .number()
        .min(0, 'discountPercentage cannot be negative (< 0%)')
        .max(100, 'discountPercentage cannot exceed 100%')
        .optional(),
      categoryId: objectIdString.nullable().optional(),
      priority: z.coerce.number().int().min(1).max(100).optional(),
      isActive: z.boolean().optional(),
    })
    .superRefine((data, ctx) => {
      if (
        data.minDays !== undefined &&
        data.maxDays !== undefined &&
        data.maxDays !== null &&
        data.maxDays < data.minDays
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['maxDays'],
          message: 'maxDays must be greater than or equal to minDays',
        });
      }
    }),
});

export const simulatePricingSchema = z.object({
  body: z.object({
    originalPrice: z.coerce
      .number({ required_error: 'originalPrice is required' })
      .positive('originalPrice must be greater than 0'),
    expiryDate: z.coerce.date().optional(),
    remainingDays: z.coerce.number().int().optional(),
    quantity: z.coerce.number().int().min(0).optional().default(10),
    categoryId: objectIdString.nullable().optional().default(null),
  }),
});
