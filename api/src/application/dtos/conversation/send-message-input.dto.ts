import { MessageType } from '../../../domain/enums/message-type.enum.js';

export interface SendMessageInput {
  conversationId: string;
  agentId: string;
  tenantId: string;
  body: string;
  messageType?: MessageType;
}
