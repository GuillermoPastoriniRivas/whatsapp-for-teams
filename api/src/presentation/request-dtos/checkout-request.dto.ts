import { z } from 'zod';

export const CheckoutRequestSchema = z.object({
  plan: z.enum(['pro', 'business', 'agencies']),
  countryCode: z.string().length(2).optional(),
});

export type CheckoutRequestDto = z.infer<typeof CheckoutRequestSchema>;
