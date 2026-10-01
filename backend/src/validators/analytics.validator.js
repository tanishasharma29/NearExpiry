import { z } from 'zod';

export const analyticsQuerySchema = z.object({
  query: z
    .object({
      period: z.enum(['7d', '30d', '90d', 'all']).optional().default('30d'),
    })
    .optional(),
});
