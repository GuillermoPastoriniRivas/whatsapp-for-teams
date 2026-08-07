import { z } from 'zod';

export const ReactToMessageRequestSchema = z.object({
  /**
   * Un emoji. Vacío quita la reacción — así lo modela Meta, y por eso no se
   * exige `min(1)`. El tope holgado cubre emojis compuestos (ZWJ, tonos de piel).
   */
  emoji: z.string().max(16),
});

export type ReactToMessageRequestDto = z.infer<typeof ReactToMessageRequestSchema>;
