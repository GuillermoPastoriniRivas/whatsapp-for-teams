import { z } from 'zod';

export const InviteAgentRequestSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(255),
  role: z.enum(['admin', 'agent']).optional(),
});

export type InviteAgentRequestDto = z.infer<typeof InviteAgentRequestSchema>;
