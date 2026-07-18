import { Conversation } from '../entities/conversation.entity.js';
import { ConversationStatus } from '../enums/conversation-status.enum.js';

export type ConversationView = 'inbox' | 'campaign' | 'all';

export interface ConversationFilters {
  tenantId: string;
  status?: ConversationStatus;
  agentId?: string;
  phoneNumberId?: string;
  view?: ConversationView;
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: { total: number; page: number; pages: number };
}

export interface FindOrCreateResult {
  conversation: Conversation;
  created: boolean;
}

export interface ConversationRepository {
  create(conversation: Omit<Conversation, 'id' | 'createdAt' | 'resolvedAt' | 'closedBy' | 'summary'>): Promise<Conversation>;
  findOrCreateByContactAndPhone(
    data: Omit<Conversation, 'id' | 'createdAt' | 'resolvedAt' | 'closedBy' | 'summary'>,
  ): Promise<FindOrCreateResult>;
  findById(id: string): Promise<Conversation | null>;
  findOpenByContactAndPhone(contactId: string, phoneNumberId: string): Promise<Conversation | null>;
  findByContactAndPhone(contactId: string, phoneNumberId: string): Promise<Conversation | null>;
  findByFilters(filters: ConversationFilters): Promise<PaginatedResult<Conversation>>;
  findActiveByAgentId(agentId: string): Promise<Conversation[]>;
  findActiveByAgentAndPhone(agentId: string, phoneNumberId: string): Promise<Conversation[]>;
  update(id: string, data: Partial<Conversation>): Promise<Conversation | null>;
  countByTenantIdSince(tenantId: string, since: Date): Promise<number>;
}
