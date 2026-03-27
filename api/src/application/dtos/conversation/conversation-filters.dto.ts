import { ConversationStatus } from '../../../domain/enums/conversation-status.enum.js';

export interface ConversationFiltersInput {
  tenantId: string;
  status?: ConversationStatus;
  agentId?: string;
  phoneNumberId?: string;
  page: number;
  limit: number;
}
