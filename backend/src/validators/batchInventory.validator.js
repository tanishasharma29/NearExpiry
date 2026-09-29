import { z } from 'zod';

const objectIdString = z
  .string({ required_error: 'ID is required' })
  .regex(/^[0-9a-fA-F]{24}$/, 'Must be a valid 24-character MongoDB ObjectId');

export const createBatchSchema = z.object({
  body: z
    .object({
      productId: objectIdString,
      batchNumber: z
        .string({ required_error: 'batchNumber is required' })
        .trim()
        .min(1, 'batchNumber cannot be empty')
        .max(64, 'batchNumber cannot exceed 64 characters')
        .transform((val) => val.toUpperCase()),
      manufacturingDate: z.coerce.date({
        required_error: 'manufacturingDate is required',
        invalid_type_error: 'manufacturingDate must be a valid ISO date',
      }),
      expiryDate: z.coerce.date({
        required_error: 'expiryDate is required',
        invalid_type_error: 'expiryDate must be a valid ISO date',
      }),
      quantity: z.coerce
        .number({ required_error: 'quantity is required' })
        .int('quantity must be a whole number')
        .min(0, 'quantity cannot be negative'),
      originalPrice: z.coerce
        .number({ required_error: 'originalPrice is required' })
        .positive('originalPrice must be greater than 0'),
      currentPrice: z.coerce
        .number()
        .positive('currentPrice must be greater than 0')
        .optional(),
    })
    .superRefine((data, ctx) => {
      if (data.manufacturingDate >= data.expiryDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['expiryDate'],
          message: 'expiryDate must be strictly later than manufacturingDate',
        });
      }

      // Prevent Seller from creating an already-expired batch
      const now = new Date();
      const todayMidnight = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
      );
      const expiryMidnight = new Date(
        Date.UTC(
          data.expiryDate.getUTCFullYear(),
          data.expiryDate.getUTCMonth(),
          data.expiryDate.getUTCDate()
        )
      );

      if (expiryMidnight < todayMidnight) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['expiryDate'],
          message: 'Cannot register a new batch whose expiryDate has already passed',
        });
      }
    }),
});

export const updateBatchSchema = z.object({
  body: z
    .object({
      batchNumber: z
        .string()
        .trim()
        .min(1)
        .max(64)
        .transform((val) => val.toUpperCase())
        .optional(),
      manufacturingDate: z.coerce.date().optional(),
      expiryDate: z.coerce.date().optional(),
      originalPrice: z.coerce.number().positive().optional(),
      currentPrice: z.coerce.number().positive().optional(),
    })
    .superRefine((data, ctx) => {
      if (data.manufacturingDate && data.expiryDate && data.manufacturingDate >= data.expiryDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['expiryDate'],
          message: 'expiryDate must be strictly later than manufacturingDate',
        });
      }
    }),
});

/**
 * Stock Adjustment Schema:
 * Supports either:
 * - quantityChange (signed integer delta, e.g., +15 or -5), OR
 * - newQuantity (absolute target non-negative integer, e.g., 25)
 */
export const stockAdjustmentSchema = z.object({
  body: z
    .object({
      batchId: objectIdString.optional(),
      quantityChange: z.coerce.number().int('quantityChange must be an integer').optional(),
      newQuantity: z.coerce
        .number()
        .int('newQuantity must be an integer')
        .min(0, 'Quantity cannot be negative')
        .optional(),
      reason: z
        .string({ required_error: 'Audit reason is required for stock adjustments' })
        .trim()
        .min(3, 'Reason must be at least 3 characters')
        .max(500),
    })
    .superRefine((data, ctx) => {
      if (data.quantityChange === undefined && data.newQuantity === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['quantityChange'],
          message: 'Provide either quantityChange (signed delta) or newQuantity (target >= 0)',
        });
      }
    }),
});

/**
 * Stock Reservation & Release Schema
 */
export const stockReservationSchema = z.object({
  body: z.object({
    batchId: objectIdString.optional(),
    quantity: z.coerce
      .number({ required_error: 'Quantity to reserve/release is required' })
      .int('Quantity must be an integer')
      .positive('Quantity must be at least 1'),
    referenceId: z.string().trim().max(120).optional(),
    reason: z.string().trim().max(500).optional(),
  }),
});
