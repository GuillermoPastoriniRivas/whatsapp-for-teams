import { Conversation } from '../entities/conversation.entity.js';
import { ConversationStatus } from '../enums/conversation-status.enum.js';

export interface ConversationFilters {
  tenantId: string;
  status?: ConversationStatus;
  agentId?: string;
  phoneNumberId?: string;
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: { total: number; page: number; pages: number };
}

export interface ConversationRepository {
  create(conversation: Omit<Conversation, 'id' | 'createdAt' | 'resolvedAt' | 'closedBy'>): Promise<Conversation>;
  findById(id: string): Promise<Conversation | null>;
  findOpenByContactAndPhone(contactId: string, phoneNumberId: string): Promise<Conversation | null>;
  findByFilters(filters: ConversationFilters): Promise<PaginatedResult<Conversation>>;
  findActiveByAgentId(agentId: string): Promise<Conversation[]>;
  findActiveByAgentAndPhone(agentId: string, phoneNumberId: string): Promise<Conversation[]>;
  update(id: string, data: Partial<Conversation>): Promise<Conversation | null>;
}
