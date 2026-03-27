import { z } from 'zod';
import { AgentStatus } from '../../domain/enums/agent-status.enum.js';

export const UpdateStatusRequestSchema = z.object({
  status: z.nativeEnum(AgentStatus),
});

export type UpdateStatusRequestDto = z.infer<typeof UpdateStatusRequestSchema>;
