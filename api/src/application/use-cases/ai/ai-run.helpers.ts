// ── Helpers compartidos del runtime de IA ────────────────────────
// Extraídos de ProcessAiResponseUseCase para que el nodo de flujo
// "Respuesta IA" reutilice exactamente la misma maquinaria.

import type { Logger } from '@nestjs/common';
import type { ChatMessage } from '../../ports/ai-completion.port.js';
import type { MessagingApiPort } from '../../ports/messaging-api.port.js';
import type { RealtimeGatewayPort } from '../../ports/realtime-gateway.port.js';
import type { MessageRepository } from '../../../domain/repositories/message.repository.js';
import type { Message } from '../../../domain/entities/message.entity.js';
import type { AiPersona } from '../../../domain/value-objects/ai-persona.js';
import type { Contact } from '../../../domain/entities/contact.entity.js';
import type { RecipientIdentity } from '../../../domain/value-objects/recipient-identity.js';
import { messageToText, type MessageSenderKind } from '../../../domain/entities/message.entity.js';
import type { DeveloperEventsPort } from '../../ports/developer-events.port.js';
import { MessageDirection } from '../../../domain/enums/message-direction.enum.js';
import { MessageType } from '../../../domain/enums/message-type.enum.js';
import { MessageWaStatus } from '../../../domain/enums/message-wa-status.enum.js';
import { DeveloperEventType } from '../../../domain/enums/developer-event-type.enum.js';
import { serializeMessage } from '../developer/developer-payloads.util.js';
import { buildSystemPrompt } from './prompts/system-prompt.builder.js';
import { computeBusinessStatus } from './prompts/business-hours.util.js';

/** Historial de chat con prefijo de timestamp (formato que el modelo ya conoce) */
export function buildChatHistory(messages: Message[]): ChatMessage[] {
  return messages.map((m) => ({
    role: (m.direction === MessageDirection.INBOUND ? 'user' : 'assistant') as 'user' | 'assistant',
    content: `[${m.timestamp.toISOString()}] ${messageToText(m)}`,
  }));
}

/** Quita los prefijos [ISO] que el modelo pueda haber copiado */
export function stripTimestampPrefixes(text: string): string {
  return text.replace(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z\]\s?/g, '');
}

/** Parseo defensivo de la respuesta multi-burbuja (JSON directo → fence → regex) */
export function parseMultiMessageResponse(raw: string, maxBubbles: number, logger?: Logger): string[] {
  const tryParse = (str: string): string[] | null => {
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed.every((s: unknown) => typeof s === 'string')) {
        return parsed;
      }
    } catch { /* fall through */ }
    return null;
  };

  let result = tryParse(raw);
  if (result) return result.slice(0, maxBubbles);

  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    result = tryParse(fenceMatch[1].trim());
    if (result) return result.slice(0, maxBubbles);
  }

  const arrayMatch = raw.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    result = tryParse(arrayMatch[0]);
    if (result) return result.slice(0, maxBubbles);
  }

  logger?.warn(`Failed to parse multi-message JSON, using single message. Raw: ${raw.substring(0, 200)}`);
  return [raw];
}

/** Compila el system prompt del asistente con el boilerplate de fecha/estado */
export function buildAgentSystemPrompt(params: {
  config: AiPersona;
  contact: Contact | null;
  conversationSummary: string | null;
  labels: string[];
  extraInstructions?: string;
}): string {
  const { config, contact, conversationSummary, labels, extraInstructions } = params;
  const now = new Date();
  const tz = config.timezone ?? undefined;
  const dateOpts: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: tz };
  const timeOpts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: tz };
  const weekdayFmt = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: tz });
  const businessStatus = computeBusinessStatus(config.businessHours, config.timezone, now);

  const behavior = extraInstructions
    ? {
        ...config.behavior,
        customInstructions: [config.behavior.customInstructions, extraInstructions].filter(Boolean).join('\n\n'),
      }
    : config.behavior;

  return buildSystemPrompt({
    currentDay: weekdayFmt.format(now),
    currentDate: now.toLocaleDateString('en-US', dateOpts),
    currentTime: now.toLocaleTimeString('en-US', timeOpts),
    businessStatus: businessStatus
      ? { isOpen: businessStatus.isOpen, todayRange: businessStatus.todayRange, nextOpen: businessStatus.nextOpen }
      : null,
    businessProfile: config.businessProfile,
    behavior,
    contact: contact
      ? {
          name: contact.name,
          phone: contact.phone ?? undefined,
          email: contact.email ?? undefined,
          company: contact.company ?? undefined,
          notes: contact.notes ?? undefined,
          customFields: contact.customFields ?? undefined,
        }
      : undefined,
    conversationSummary: conversationSummary ?? undefined,
    handoffRules: {
      keywords: config.handoffRules.keywords,
      urgencyKeywords: config.handoffRules.urgencyKeywords,
      onCustomerRequest: config.handoffRules.onCustomerRequest,
    },
    labels,
    multiMessage: config.multiMessage?.enabled
      ? { enabled: true, maxBubbles: config.multiMessage.maxBubbles }
      : undefined,
  });
}

/**
 * Último mensaje entrante de un lote, por timestamp.
 *
 * A propósito no asume el orden del repositorio: hay dos llamadores de
 * `findByConversationId` que lo interpretan al revés entre sí, y de acá sale el
 * wamid del que cuelgan el acuse de lectura y el "escribiendo…".
 */
export function lastInboundOf(messages: Message[]): Message | null {
  let latest: Message | null = null;
  for (const message of messages) {
    if (message.direction !== MessageDirection.INBOUND) continue;
    if (!latest || message.timestamp > latest.timestamp) latest = message;
  }
  return latest;
}

export interface SendBubblesParams {
  messagingApi: MessagingApiPort;
  messageRepo: MessageRepository;
  gateway: RealtimeGatewayPort;
  phone: { provider: any; providerConfig: any; phoneNumberId: string };
  recipient: RecipientIdentity;
  conversationId: string;
  senderAgentId: string | null;
  senderAgentName: string | null;
  /** Quién escribe: distingue las burbujas del bot de las de un flujo. */
  senderKind?: MessageSenderKind;
  bubbles: string[];
  interBubbleDelayMs: number;
  /**
   * wamid del entrante que se está contestando. Meta cuelga el "escribiendo…"
   * de un mensaje concreto, así que sin esto no hay indicador entre burbujas.
   */
  replyToWaMessageId?: string | null;
  /** Si están presentes, cada burbuja emite message.sent al webhook de desarrolladores */
  devEvents?: DeveloperEventsPort;
  tenantId?: string;
}

/** Envía burbujas de texto con typing + delay entre burbujas, persiste y emite WS */
export async function sendBubbles(params: SendBubblesParams): Promise<void> {
  const { messagingApi, messageRepo, gateway, phone, recipient, conversationId } = params;
  const typingParams = params.replyToWaMessageId
    ? {
        provider: phone.provider,
        providerConfig: phone.providerConfig,
        phoneNumberId: phone.phoneNumberId,
        waMessageId: params.replyToWaMessageId,
        typing: true,
      }
    : null;

  for (let i = 0; i < params.bubbles.length; i++) {
    if (i > 0) {
      if (typingParams) messagingApi.markAsRead(typingParams).catch(() => {});
      await new Promise((r) => setTimeout(r, params.interBubbleDelayMs));
    }

    const body = params.bubbles[i].substring(0, 4096);

    const { waMessageId } = await messagingApi.sendMessage({
      provider: phone.provider,
      providerConfig: phone.providerConfig,
      phoneNumberId: phone.phoneNumberId,
      ...recipient,
      type: MessageType.TEXT,
      body,
    });

    const message = await messageRepo.upsertByWaMessageId({
      conversationId,
      direction: MessageDirection.OUTBOUND,
      messageType: MessageType.TEXT,
      body,
      mediaUrl: null,
      mimeType: null,
      waMessageId,
      waStatus: MessageWaStatus.SENT,
      timestamp: new Date(),
      senderAgentId: params.senderAgentId,
      senderAgentName: params.senderAgentName,
      senderKind: params.senderKind ?? null,
    });

    gateway.emitToConversation(conversationId, 'message.new', message);

    if (params.devEvents && params.tenantId) {
      params.devEvents.emit(params.tenantId, DeveloperEventType.MESSAGE_SENT, {
        message: serializeMessage(message),
        conversationId,
        via: 'ai',
      });
    }
  }
}
