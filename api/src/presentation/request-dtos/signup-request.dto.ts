import { z } from 'zod';

export const SignupRequestSchema = z.object({
  name: z.string().min(1).max(128),
  email: z.string().email().max(256),
  password: z.string().min(8).max(128),
});

export type SignupRequestDto = z.infer<typeof SignupRequestSchema>;
