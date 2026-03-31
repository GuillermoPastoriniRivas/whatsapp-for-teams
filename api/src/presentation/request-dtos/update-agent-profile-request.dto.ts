import { z } from 'zod';
import { AgentRole } from '../../domain/enums/agent-role.enum.js';

export const UpdateAgentProfileRequestSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.nativeEnum(AgentRole).optional(),
});

export type UpdateAgentProfileRequestDto = z.infer<typeof UpdateAgentProfileRequestSchema>;
