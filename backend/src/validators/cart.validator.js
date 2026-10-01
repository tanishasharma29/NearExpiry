import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const addToCartSchema = z.object({
  body: z.object({
    productId: z
      .string({ required_error: 'Product ID is required' })
      .regex(objectIdRegex, 'Invalid Product ID format'),
    quantity: z
      .number({ invalid_type_error: 'Quantity must be a number' })
      .int('Quantity must be an integer')
      .positive('Quantity must be greater than 0')
      .max(99, 'Quantity cannot exceed 99')
      .default(1),
    batchId: z
      .string()
      .regex(objectIdRegex, 'Invalid Batch ID format')
      .optional()
      .nullable(),
    replaceCart: z.boolean().optional().default(false),
  }),
});

export const updateCartItemQuantitySchema = z.object({
  params: z.object({
    productId: z
      .string({ required_error: 'Product ID is required' })
      .regex(objectIdRegex, 'Invalid Product ID format'),
  }),
  body: z.object({
    quantity: z
      .number({ required_error: 'Quantity is required' })
      .int('Quantity must be an integer')
      .positive('Quantity must be greater than 0')
      .max(99, 'Quantity cannot exceed 99'),
  }),
});

export const removeCartItemSchema = z.object({
  params: z.object({
    productId: z
      .string({ required_error: 'Product ID is required' })
      .regex(objectIdRegex, 'Invalid Product ID format'),
  }),
});

export const checkoutValidateSchema = z.object({
  body: z
    .object({
      storeId: z
        .string()
        .regex(objectIdRegex, 'Invalid Store ID format')
        .optional(),
    })
    .optional(),
});
