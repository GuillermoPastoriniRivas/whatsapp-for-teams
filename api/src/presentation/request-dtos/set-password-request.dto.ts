import { z } from 'zod';

export const SetPasswordRequestSchema = z.object({
  currentPassword: z.string().min(1).max(128).optional(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export type SetPasswordRequestDto = z.infer<typeof SetPasswordRequestSchema>;
