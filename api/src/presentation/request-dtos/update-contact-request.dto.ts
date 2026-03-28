import { z } from 'zod';

export const UpdateContactRequestSchema = z.object({
  email: z.string().email().nullable().optional(),
  company: z.string().max(200).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  customFields: z.record(z.string(), z.string()).optional(),
});

export type UpdateContactRequestDto = z.infer<typeof UpdateContactRequestSchema>;
