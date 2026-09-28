import { z } from 'zod';
import { PRODUCT_STATUS, PRODUCT_UNITS } from '../models/product.model.js';

const FORBIDDEN_BATCH_FIELDS = [
  'expiryDate',
  'bestBeforeDate',
  'manufacturingDate',
  'batchNumber',
  'originalPrice',
  'currentPrice',
  'quantity',
];

/**
 * Enforces the core business rule:
 * Product must NOT contain batch-specific expiry dates, quantities, or batch prices.
 */
const enforceProductBatchSeparation = (data, ctx) => {
  for (const field of FORBIDDEN_BATCH_FIELDS) {
    if (data[field] !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [field],
        message: `Field [${field}] belongs to the Batch entity, not Product. Product and Batch must remain strictly separate.`,
      });
    }
  }
};

export const createProductSchema = z.object({
  body: z
    .object({
      name: z
        .string({ required_error: 'Product name is required' })
        .trim()
        .min(2, 'Product name must be at least 2 characters')
        .max(160, 'Product name cannot exceed 160 characters'),
      description: z
        .string({ required_error: 'Product description is required' })
        .trim()
        .min(3, 'Description must be at least 3 characters')
        .max(2000, 'Description cannot exceed 2000 characters'),
      brand: z
        .string({ required_error: 'Brand is required' })
        .trim()
        .min(1, 'Brand cannot be empty')
        .max(80, 'Brand cannot exceed 80 characters'),
      category: z
        .string({ required_error: 'Category ID is required' })
        .regex(/^[0-9a-fA-F]{24}$/, 'Category must be a valid MongoDB ObjectId'),
      image: z
        .string()
        .trim()
        .url('Image must be a valid URL')
        .optional()
        .default('https://placehold.co/600x600?text=NearExpiry+Product'),
      unit: z.enum(PRODUCT_UNITS, {
        errorMap: () => ({
          message: `Unit must be one of: ${PRODUCT_UNITS.join(', ')}`,
        }),
      }),
      status: z
        .enum(Object.values(PRODUCT_STATUS))
        .optional()
        .default(PRODUCT_STATUS.ACTIVE),
    })
    .passthrough()
    .superRefine(enforceProductBatchSeparation),
});

export const updateProductSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(2).max(160).optional(),
      description: z.string().trim().min(3).max(2000).optional(),
      brand: z.string().trim().min(1).max(80).optional(),
      category: z
        .string()
        .regex(/^[0-9a-fA-F]{24}$/, 'Category must be a valid MongoDB ObjectId')
        .optional(),
      image: z.string().trim().url('Image must be a valid URL').optional(),
      unit: z.enum(PRODUCT_UNITS).optional(),
      status: z.enum(Object.values(PRODUCT_STATUS)).optional(),
    })
    .passthrough()
    .superRefine(enforceProductBatchSeparation),
});
