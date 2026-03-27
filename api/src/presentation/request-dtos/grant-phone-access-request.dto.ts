import { z } from 'zod';

export const GrantPhoneAccessRequestSchema = z.object({
  phoneNumberId: z.string().min(1),
});

export type GrantPhoneAccessRequestDto = z.infer<typeof GrantPhoneAccessRequestSchema>;
