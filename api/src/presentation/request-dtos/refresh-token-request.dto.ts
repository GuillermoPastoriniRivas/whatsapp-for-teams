import { z } from 'zod';

export const RefreshTokenRequestSchema = z.object({
  refreshToken: z.string().min(1),
});

export type RefreshTokenRequestDto = z.infer<typeof RefreshTokenRequestSchema>;
