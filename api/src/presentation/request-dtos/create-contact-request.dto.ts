import { z } from 'zod';

export const CreateContactRequestSchema = z.object({
  phone: z.string().min(1),
  name: z.string().max(200).optional(),
});

export type CreateContactRequestDto = z.infer<typeof CreateContactRequestSchema>;
