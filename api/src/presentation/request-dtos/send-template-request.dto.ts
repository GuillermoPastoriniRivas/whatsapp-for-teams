import { z } from 'zod';

export const SendTemplateRequestSchema = z.object({
  templateId: z.string().min(1),
  variables: z.record(z.string(), z.string().max(1024)).default({}),
});

export type SendTemplateRequestDto = z.infer<typeof SendTemplateRequestSchema>;
