import { z } from 'zod';
import { PAYMENT_METHOD } from '../models/payment.model.js';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const processPaymentSchema = z.object({
  body: z.object({
    orderId: z
      .string({ required_error: 'Order ID is required' })
      .regex(objectIdRegex, 'Invalid Order ID format'),
    method: z.enum(Object.values(PAYMENT_METHOD), {
      required_error: 'Payment method is required',
    }),
    idempotencyKey: z
      .string({ required_error: 'Idempotency key is required' })
      .trim()
      .min(8, 'Idempotency key must be at least 8 characters')
      .max(128, 'Idempotency key cannot exceed 128 characters'),
    paymentDetails: z
      .object({
        simulateFailure: z.boolean().optional(),
        failureReason: z.string().optional(),
      })
      .optional()
      .default({}),
  }),
});

export const confirmCodSchema = z.object({
  params: z.object({
    paymentId: z
      .string({ required_error: 'Payment ID is required' })
      .regex(objectIdRegex, 'Invalid Payment ID format'),
  }),
  body: z
    .object({
      notes: z.string().trim().max(300).optional(),
    })
    .optional(),
});

export const refundPaymentSchema = z.object({
  params: z.object({
    paymentId: z
      .string({ required_error: 'Payment ID is required' })
      .regex(objectIdRegex, 'Invalid Payment ID format'),
  }),
  body: z.object({
    reason: z
      .string({ required_error: 'Refund reason is required' })
      .trim()
      .min(3, 'Refund reason must be at least 3 characters')
      .max(300, 'Refund reason cannot exceed 300 characters'),
    amount: z.number().positive('Refund amount must be positive').optional(),
  }),
});

export const getPaymentByIdSchema = z.object({
  params: z.object({
    paymentId: z
      .string({ required_error: 'Payment ID is required' })
      .regex(objectIdRegex, 'Invalid Payment ID format'),
  }),
});

export const getPaymentByOrderIdSchema = z.object({
  params: z.object({
    orderId: z
      .string({ required_error: 'Order ID is required' })
      .regex(objectIdRegex, 'Invalid Order ID format'),
  }),
});
