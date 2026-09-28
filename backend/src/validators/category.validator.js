import { z } from 'zod';
import { CATEGORY_STATUS } from '../models/category.model.js';

export const createCategorySchema = z.object({
  body: z.object({
    name: z
      .string({ required_error: 'Category name is required' })
      .trim()
      .min(2, 'Category name must be at least 2 characters')
      .max(80, 'Category name cannot exceed 80 characters'),
    description: z
      .string()
      .trim()
      .max(500, 'Description cannot exceed 500 characters')
      .optional()
      .default(''),
    status: z
      .enum(Object.values(CATEGORY_STATUS))
      .optional()
      .default(CATEGORY_STATUS.ACTIVE),
  }),
});

export const updateCategorySchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(80).optional(),
    description: z.string().trim().max(500).optional(),
    status: z.enum(Object.values(CATEGORY_STATUS)).optional(),
  }),
});
