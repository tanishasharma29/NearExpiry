import { z } from 'zod';

const passwordSchema = z
  .string({ required_error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters long')
  .max(64, 'Password cannot exceed 64 characters');

export const registerCustomerSchema = z.object({
  body: z.object({
    name: z
      .string({ required_error: 'Name is required' })
      .trim()
      .min(2, 'Name must be at least 2 characters')
      .max(80, 'Name cannot exceed 80 characters'),
    email: z
      .string({ required_error: 'Email is required' })
      .trim()
      .email('Please provide a valid email address')
      .transform((val) => val.toLowerCase()),
    phone: z
      .string()
      .trim()
      .min(10, 'Phone number must be at least 10 digits')
      .max(15, 'Phone number cannot exceed 15 digits')
      .optional(),
    password: passwordSchema,
  }),
});

export const registerSellerSchema = z.object({
  body: z.object({
    name: z
      .string({ required_error: 'Owner/contact name is required' })
      .trim()
      .min(2, 'Name must be at least 2 characters')
      .max(80, 'Name cannot exceed 80 characters'),
    email: z
      .string({ required_error: 'Email is required' })
      .trim()
      .email('Please provide a valid email address')
      .transform((val) => val.toLowerCase()),
    phone: z
      .string({ required_error: 'Phone number is required' })
      .trim()
      .min(10, 'Phone number must be at least 10 digits')
      .max(15, 'Phone number cannot exceed 15 digits')
      .optional(),
    password: passwordSchema,
    storeName: z
      .string({ required_error: 'Store name is required for seller registration' })
      .trim()
      .min(2, 'Store name must be at least 2 characters')
      .max(120, 'Store name cannot exceed 120 characters'),
    businessLicenseNumber: z.string().trim().optional(),
    gstNumber: z.string().trim().optional(),
    fssaiLicenseNumber: z.string().trim().optional(),
    cosmeticLicenseNumber: z.string().trim().optional(),
    address: z
      .object({
        street: z.string().trim().optional(),
        city: z.string().trim().optional(),
        state: z.string().trim().optional(),
        pincode: z.string().trim().optional(),
      })
      .optional(),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
  }),
});

export const registerAdminSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(80),
    email: z.string().trim().email().transform((val) => val.toLowerCase()),
    phone: z.string().trim().optional(),
    password: passwordSchema,
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z
      .string({ required_error: 'Email is required' })
      .trim()
      .email('Please provide a valid email address')
      .transform((val) => val.toLowerCase()),
    password: z.string({ required_error: 'Password is required' }).min(1, 'Password is required'),
  }),
});
