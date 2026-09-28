import { z } from 'zod';
import { STORE_OPERATIONAL_STATUS } from '../models/store.model.js';

const addressValidator = z.object({
  street: z.string({ required_error: 'Street address is required' }).trim().min(2),
  landmark: z.string().trim().optional().default(''),
  city: z.string({ required_error: 'City is required' }).trim().min(2),
  state: z.string({ required_error: 'State is required' }).trim().min(2),
  pincode: z.string({ required_error: 'Pincode is required' }).trim().min(4).max(12),
});

export const updateSellerProfileSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(80).optional(),
    phone: z.string().trim().min(10).max(15).optional(),
    storeName: z.string().trim().min(2).max(120).optional(),
    businessLicenseNumber: z.string().trim().optional(),
    gstNumber: z.string().trim().optional(),
    fssaiLicenseNumber: z.string().trim().optional(),
    cosmeticLicenseNumber: z.string().trim().optional(),
    address: addressValidator.partial().optional(),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
  }),
});

export const createStoreSchema = z.object({
  body: z.object({
    storeName: z
      .string({ required_error: 'Store name is required' })
      .trim()
      .min(2, 'Store name must be at least 2 characters')
      .max(120, 'Store name cannot exceed 120 characters'),
    description: z.string().trim().max(1000).optional(),
    contactPhone: z
      .string({ required_error: 'Contact phone is required' })
      .trim()
      .min(10, 'Contact phone must be at least 10 digits')
      .max(15),
    contactEmail: z.string().trim().email('Invalid contact email').optional(),
    businessDetails: z
      .object({
        businessLicenseNumber: z.string().trim().optional(),
        gstNumber: z.string().trim().optional(),
        fssaiLicenseNumber: z.string().trim().optional(),
        cosmeticLicenseNumber: z.string().trim().optional(),
      })
      .optional(),
    address: addressValidator,
    latitude: z.coerce
      .number({ required_error: 'Latitude is required' })
      .min(-90, 'Latitude must be >= -90')
      .max(90, 'Latitude must be <= 90'),
    longitude: z.coerce
      .number({ required_error: 'Longitude is required' })
      .min(-180, 'Longitude must be >= -180')
      .max(180, 'Longitude must be <= 180'),
    status: z
      .enum(Object.values(STORE_OPERATIONAL_STATUS))
      .optional()
      .default(STORE_OPERATIONAL_STATUS.OPEN),
    fulfillmentModes: z
      .array(z.enum(['PICKUP', 'LOCAL_DELIVERY']))
      .optional()
      .default(['PICKUP', 'LOCAL_DELIVERY']),
    deliveryRadiusKm: z.coerce.number().min(1).max(50).optional().default(10),
  }),
});

export const updateStoreSchema = z.object({
  body: z.object({
    storeName: z.string().trim().min(2).max(120).optional(),
    description: z.string().trim().max(1000).optional(),
    contactPhone: z.string().trim().min(10).max(15).optional(),
    contactEmail: z.string().trim().email().optional(),
    businessDetails: z
      .object({
        businessLicenseNumber: z.string().trim().optional(),
        gstNumber: z.string().trim().optional(),
        fssaiLicenseNumber: z.string().trim().optional(),
        cosmeticLicenseNumber: z.string().trim().optional(),
      })
      .optional(),
    address: addressValidator.partial().optional(),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    status: z.enum(Object.values(STORE_OPERATIONAL_STATUS)).optional(),
    fulfillmentModes: z.array(z.enum(['PICKUP', 'LOCAL_DELIVERY'])).optional(),
    deliveryRadiusKm: z.coerce.number().min(1).max(50).optional(),
    isActive: z.boolean().optional(),
  }),
});

export const updateStoreStatusSchema = z.object({
  body: z.object({
    status: z.enum(Object.values(STORE_OPERATIONAL_STATUS)).optional(),
    isActive: z.boolean().optional(),
  }),
});

export const verifyStoreSchema = z.object({
  body: z.object({
    verificationStatus: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'], {
      required_error: 'verificationStatus is required (PENDING, APPROVED, REJECTED, SUSPENDED)',
    }),
    rejectionReason: z.string().trim().max(500).optional(),
  }),
});
