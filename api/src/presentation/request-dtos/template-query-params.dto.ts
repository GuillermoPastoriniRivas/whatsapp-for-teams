import { z } from 'zod';
import { TemplateStatus } from '../../domain/enums/template-status.enum.js';

export const TemplateQueryParamsSchema = z.object({
  phoneNumberId: z.string().optional(),
  status: z.nativeEnum(TemplateStatus).optional(),
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type TemplateQueryParamsDto = z.infer<typeof TemplateQueryParamsSchema>;
