import { z } from 'zod';

export const ChangePlanRequestSchema = z.object({
  newPlan: z.enum(['free', 'pro', 'business', 'agencies']),
});

export type ChangePlanRequestDto = z.infer<typeof ChangePlanRequestSchema>;
