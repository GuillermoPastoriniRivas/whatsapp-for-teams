import { z } from 'zod';

export const ForgotPasswordRequestSchema = z.object({
  email: z.string().email().max(255),
});

export type ForgotPasswordRequestDto = z.infer<typeof ForgotPasswordRequestSchema>;
