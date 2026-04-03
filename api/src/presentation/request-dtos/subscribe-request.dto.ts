import { z } from 'zod';

export const SubscribeRequestSchema = z.object({
  plan: z.enum(['free', 'pro', 'business', 'agencies']),
});

export type SubscribeRequestDto = z.infer<typeof SubscribeRequestSchema>;
