import { z } from 'zod';

export const LoginRequestSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(128),
});

export type LoginRequestDto = z.infer<typeof LoginRequestSchema>;
