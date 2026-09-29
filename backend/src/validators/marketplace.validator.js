import { z } from 'zod';

const objectIdString = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'Must be a valid 24-character MongoDB ObjectId');

export const EXPIRY_WINDOW_PRESETS = Object.freeze({
  '0_2_DAYS': { min: 0, max: 2 },
  '3_7_DAYS': { min: 3, max: 7 },
  '8_15_DAYS': { min: 8, max: 15 },
  '16_30_DAYS': { min: 16, max: 30 },
  '31_60_DAYS': { min: 31, max: 60 },
  '61_PLUS_DAYS': { min: 61, max: 99999 },
  CRITICAL: { min: 0, max: 7 },
  APPROACHING_EXPIRY: { min: 8, max: 30 },
  NORMAL: { min: 31, max: 99999 },
});

export const browseMarketplaceSchema = z.object({
  query: z.object({
    search: z.string().trim().optional(),
    category: objectIdString.optional(),
    categoryId: objectIdString.optional(),
    storeId: objectIdString.optional(),
    brand: z.string().trim().optional(),
    minPrice: z.coerce.number().min(0).optional(),
    maxPrice: z.coerce.number().min(0).optional(),
    minDiscount: z.coerce.number().min(0).max(100).optional(),
    maxDiscount: z.coerce.number().min(0).max(100).optional(),
    expiryWindow: z
      .enum([
        '0_2_DAYS',
        '3_7_DAYS',
        '8_15_DAYS',
        '16_30_DAYS',
        '31_60_DAYS',
        '61_PLUS_DAYS',
        'CRITICAL',
        'APPROACHING_EXPIRY',
        'NORMAL',
      ])
      .optional(),
    minRemainingDays: z.coerce.number().int().min(0).optional(),
    maxRemainingDays: z.coerce.number().int().min(0).optional(),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    radiusKm: z.coerce.number().positive().max(500).optional().default(25),
    sortBy: z
      .enum(['price', 'discount', 'expiry', 'distance', 'createdAt', 'name'])
      .optional()
      .default('expiry'),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(12),
  }),
});

export const wishlistAddSchema = z.object({
  body: z.object({
    productId: objectIdString,
    targetDiscountPercentage: z.coerce.number().min(0).max(100).optional().default(0),
    notes: z.string().trim().max(300).optional().default(''),
  }),
});
