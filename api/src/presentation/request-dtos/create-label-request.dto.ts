import { z } from 'zod';
import { LABEL_COLORS } from '../../domain/value-objects/label-colors.js';

export const CreateLabelRequestSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.enum(LABEL_COLORS),
});

export type CreateLabelRequestDto = z.infer<typeof CreateLabelRequestSchema>;
