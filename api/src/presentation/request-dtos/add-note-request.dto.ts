import { z } from 'zod';

export const AddNoteRequestSchema = z.object({
  body: z.string().min(1).max(2000),
});

export type AddNoteRequestDto = z.infer<typeof AddNoteRequestSchema>;
