import { z } from 'zod';

export const GoogleLoginRequestSchema = z.object({
  credential: z.string().min(1),
});

export type GoogleLoginRequestDto = z.infer<typeof GoogleLoginRequestSchema>;
