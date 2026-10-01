import { z } from 'zod';
import { ORDER_STATUS, FULFILLMENT_TYPES } from '../models/order.model.js';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const createOrderSchema = z.object({
  body: z.object({
    fulfillmentType: z
      .enum(Object.values(FULFILLMENT_TYPES))
      .optional()
      .default(FULFILLMENT_TYPES.PICKUP),
    deliveryAddress: z
      .object({
        recipientName: z.string().trim().optional(),
        contactPhone: z.string().trim().optional(),
        street: z.string().trim().min(3, 'Street must be at least 3 characters'),
        city: z.string().trim().min(2, 'City must be at least 2 characters'),
        state: z.string().trim().min(2, 'State must be at least 2 characters'),
        pincode: z.string().trim().min(4, 'Pincode must be at least 4 characters'),
      })
      .optional(),
  }),
});

export const updateOrderStatusSchema = z.object({
  params: z.object({
    orderId: z
      .string({ required_error: 'Order ID is required' })
      .regex(objectIdRegex, 'Invalid Order ID format'),
  }),
  body: z.object({
    status: z.enum(Object.values(ORDER_STATUS), {
      required_error: 'New order status is required',
    }),
    note: z.string().trim().max(300, 'Note cannot exceed 300 characters').optional(),
  }),
});

export const cancelOrderSchema = z.object({
  params: z.object({
    orderId: z
      .string({ required_error: 'Order ID is required' })
      .regex(objectIdRegex, 'Invalid Order ID format'),
  }),
  body: z.object({
    reason: z
      .string({ required_error: 'Cancellation reason is required' })
      .trim()
      .min(3, 'Cancellation reason must be at least 3 characters')
      .max(300, 'Cancellation reason cannot exceed 300 characters'),
  }),
});

export const getOrderByIdSchema = z.object({
  params: z.object({
    orderId: z
      .string({ required_error: 'Order ID is required' })
      .regex(objectIdRegex, 'Invalid Order ID format'),
  }),
});

export const listOrdersQuerySchema = z.object({
  query: z
    .object({
      status: z.enum(Object.values(ORDER_STATUS)).optional(),
      page: z
        .string()
        .regex(/^\d+$/, 'Page must be a positive integer')
        .transform(Number)
        .optional()
        .default('1'),
      limit: z
        .string()
        .regex(/^\d+$/, 'Limit must be a positive integer')
        .transform(Number)
        .optional()
        .default('10'),
    })
    .optional(),
});
