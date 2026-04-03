import { z } from 'zod';

const LABEL_COLORS = ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'indigo', 'purple', 'pink', 'gray'] as const;

export const UpdateLabelRequestSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.enum(LABEL_COLORS).optional(),
});

export type UpdateLabelRequestDto = z.infer<typeof UpdateLabelRequestSchema>;
