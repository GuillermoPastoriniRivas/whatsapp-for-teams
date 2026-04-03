import { z } from 'zod';

export const AssignLabelRequestSchema = z.object({
  labelId: z.string().min(1),
});

export type AssignLabelRequestDto = z.infer<typeof AssignLabelRequestSchema>;
