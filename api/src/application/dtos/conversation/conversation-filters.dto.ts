import { ConversationStatus } from '../../../domain/enums/conversation-status.enum.js';
import { ConversationView } from '../../../domain/repositories/conversation.repository.js';

export interface ConversationFiltersInput {
  tenantId: string;
  status?: ConversationStatus;
  agentId?: string;
  phoneNumberId?: string;
  view?: ConversationView;
  page: number;
  limit: number;
}
