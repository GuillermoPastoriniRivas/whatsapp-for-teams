import { z } from 'zod';

export const ToggleResourceRequestSchema = z.object({
  // Solo recursos que se prenden y apagan de a uno.
  resourceType: z.enum(['phone_numbers', 'human_agents']),
  activateId: z.string().min(1),
  deactivateId: z.string().min(1).optional(),
});

export type ToggleResourceRequestDto = z.infer<typeof ToggleResourceRequestSchema>;
