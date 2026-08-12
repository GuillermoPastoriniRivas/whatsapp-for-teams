import { z } from 'zod';
import { LABEL_COLORS } from '../../domain/value-objects/label-colors.js';

export const UpdateLabelRequestSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.enum(LABEL_COLORS).optional(),
});

export type UpdateLabelRequestDto = z.infer<typeof UpdateLabelRequestSchema>;
