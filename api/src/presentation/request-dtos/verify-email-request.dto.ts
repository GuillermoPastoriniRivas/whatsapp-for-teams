import { z } from 'zod';

export const VerifyEmailRequestSchema = z.object({
  token: z.string().min(1).max(256),
});

export type VerifyEmailRequestDto = z.infer<typeof VerifyEmailRequestSchema>;
