import { z } from 'zod';

const branchAddressSchema = z.object({
  street: z.string({ required_error: 'Street address is required' }).trim().min(2, 'Street must be at least 2 characters'),
  locality: z.string().trim().optional().default(''),
  city: z.string({ required_error: 'City is required' }).trim().min(2, 'City must be at least 2 characters'),
  state: z.string({ required_error: 'State is required' }).trim().min(2, 'State must be at least 2 characters'),
  pincode: z.string({ required_error: 'PIN code is required' }).trim().min(4, 'PIN code must be at least 4 characters').max(12),
  landmark: z.string().trim().optional().default(''),
});

export const createBranchSchema = z.object({
  body: z.object({
    name: z
      .string({ required_error: 'Branch name is required' })
      .trim()
      .min(2, 'Branch name must be at least 2 characters')
      .max(100, 'Branch name cannot exceed 100 characters'),
    address: branchAddressSchema,
    contactPhone: z
      .string({ required_error: 'Contact phone is required' })
      .trim()
      .min(10, 'Contact phone must be at least 10 digits')
      .max(15, 'Contact phone cannot exceed 15 digits'),
    contactEmail: z.string().trim().email('Invalid contact email').optional().or(z.literal('')),
    operatingHours: z.string().trim().max(100).optional().default('09:00 AM - 09:00 PM'),
    latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
    longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
    isPrimary: z.boolean().optional().default(false),
  }),
});

export const updateBranchSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(100).optional(),
    address: branchAddressSchema.partial().optional(),
    contactPhone: z.string().trim().min(10).max(15).optional(),
    contactEmail: z.string().trim().email().optional().or(z.literal('')),
    operatingHours: z.string().trim().max(100).optional(),
    latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
    longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
    isPrimary: z.boolean().optional(),
    isActive: z.boolean().optional(),
  }),
});

export const updateBranchStatusSchema = z.object({
  body: z.object({
    isActive: z.boolean({ required_error: 'isActive status boolean is required' }),
  }),
});

