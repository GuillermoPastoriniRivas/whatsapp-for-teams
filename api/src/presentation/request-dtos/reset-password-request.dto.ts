import { z } from 'zod';

export const ResetPasswordRequestSchema = z.object({
  token: z.string().min(1).max(256),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export type ResetPasswordRequestDto = z.infer<typeof ResetPasswordRequestSchema>;
