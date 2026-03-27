import { z } from 'zod';
import { AgentRole } from '../../domain/enums/agent-role.enum.js';

export const CreateAgentRequestSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.nativeEnum(AgentRole).optional(),
});

export type CreateAgentRequestDto = z.infer<typeof CreateAgentRequestSchema>;
