import { z } from 'zod';

export const ToggleResourceRequestSchema = z.object({
  resourceType: z.enum(['phone_numbers', 'human_agents', 'ai_bots']),
  activateId: z.string().min(1),
  deactivateId: z.string().min(1).optional(),
});

export type ToggleResourceRequestDto = z.infer<typeof ToggleResourceRequestSchema>;
