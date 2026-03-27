import { z } from 'zod';

export const AssignConversationRequestSchema = z.object({
  agentId: z.string().min(1),
});

export type AssignConversationRequestDto = z.infer<typeof AssignConversationRequestSchema>;
