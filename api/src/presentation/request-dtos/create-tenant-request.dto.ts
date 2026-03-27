import { z } from 'zod';

export const CreateTenantRequestSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
});

export type CreateTenantRequestDto = z.infer<typeof CreateTenantRequestSchema>;
