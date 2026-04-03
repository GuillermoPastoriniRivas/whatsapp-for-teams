import { z } from 'zod';

const LABEL_COLORS = ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'indigo', 'purple', 'pink', 'gray'] as const;

export const CreateLabelRequestSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.enum(LABEL_COLORS),
});

export type CreateLabelRequestDto = z.infer<typeof CreateLabelRequestSchema>;
