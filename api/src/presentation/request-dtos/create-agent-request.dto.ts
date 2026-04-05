import { z } from 'zod';
import { AgentRole } from '../../domain/enums/agent-role.enum.js';

export const CreateAgentRequestSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(255),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  role: z.nativeEnum(AgentRole).optional(),
});

export type CreateAgentRequestDto = z.infer<typeof CreateAgentRequestSchema>;
