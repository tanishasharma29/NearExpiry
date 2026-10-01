import { z } from 'zod';
import { NOTIFICATION_TYPES } from '../models/notification.model.js';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const listNotificationsSchema = z.object({
  query: z
    .object({
      page: z.string().regex(/^\d+$/).optional(),
      limit: z.string().regex(/^\d+$/).optional(),
      isRead: z.enum(['true', 'false']).optional(),
      type: z.enum(Object.values(NOTIFICATION_TYPES)).optional(),
    })
    .optional(),
});

export const notificationIdParamSchema = z.object({
  params: z.object({
    id: z
      .string({ required_error: 'Notification ID is required' })
      .regex(objectIdRegex, 'Invalid Notification ID format'),
  }),
});
