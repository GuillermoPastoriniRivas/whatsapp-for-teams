import { z } from 'zod';

export const AssignConversationRequestSchema = z.object({
  agentId: z.string().min(1),
});

export type AssignConversationRequestDto = z.infer<typeof AssignConversationRequestSchema>;

/** Piloto automático del chat: prender o apagar las automatizaciones. */
export const SetAutopilotRequestSchema = z.object({
  enabled: z.boolean(),
});
export type SetAutopilotRequestDto = z.infer<typeof SetAutopilotRequestSchema>;
