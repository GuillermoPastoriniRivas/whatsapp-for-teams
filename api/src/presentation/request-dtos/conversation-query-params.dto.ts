import { z } from 'zod';
import { ConversationStatus } from '../../domain/enums/conversation-status.enum.js';

export const ConversationQueryParamsSchema = z.object({
  status: z.nativeEnum(ConversationStatus).optional(),
  agentId: z.string().optional(),
  phoneNumberId: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type ConversationQueryParamsDto = z.infer<typeof ConversationQueryParamsSchema>;
