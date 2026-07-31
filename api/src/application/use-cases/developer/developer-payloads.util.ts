import { Message } from '../../../domain/entities/message.entity.js';
import { Conversation } from '../../../domain/entities/conversation.entity.js';
import { Contact } from '../../../domain/entities/contact.entity.js';

/**
 * Formas serializadas que ven los desarrolladores, tanto en las respuestas de
 * la API pública como en los payloads de webhooks. Un solo lugar para que
 * ambos canales cuenten siempre la misma historia.
 */

export function serializeMessage(message: Message) {
  return {
    id: message.id,
    conversationId: message.conversationId,
    direction: message.direction,
    type: message.messageType,
    body: message.body,
    mediaUrl: message.mediaUrl,
    mimeType: message.mimeType,
    waMessageId: message.waMessageId,
    status: message.waStatus,
    timestamp: message.timestamp,
    senderAgentId: message.senderAgentId,
    senderAgentName: message.senderAgentName,
    interactiveReplyId: message.interactiveReplyId,
    contextWaMessageId: message.contextWaMessageId,
  };
}

export function serializeConversation(conversation: Conversation) {
  return {
    id: conversation.id,
    phoneNumberId: conversation.phoneNumberId,
    contactId: conversation.contactId,
    agentId: conversation.agentId,
    status: conversation.status,
    origin: conversation.origin,
    lastMessageAt: conversation.lastMessageAt,
    lastInboundAt: conversation.lastInboundAt,
    unreadCount: conversation.unreadCount,
    createdAt: conversation.createdAt,
  };
}

export function serializeContact(contact: Contact) {
  return {
    id: contact.id,
    waId: contact.waId,
    name: contact.name,
    phone: contact.phone,
    email: contact.email,
    company: contact.company,
    customFields: contact.customFields,
    createdAt: contact.createdAt,
  };
}
