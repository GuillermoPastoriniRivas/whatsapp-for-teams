import { MessageDirection } from '../enums/message-direction.enum.js';
import { MessageType } from '../enums/message-type.enum.js';
import { MessageWaStatus } from '../enums/message-wa-status.enum.js';
import { MessageLocation, formatLocation } from '../value-objects/message-location.js';

/** Quién originó un mensaje saliente. */
export type MessageSenderKind = 'agent' | 'ai' | 'flow' | 'campaign' | 'api';

export class Message {
  constructor(
    public readonly id: string,
    public readonly conversationId: string,
    public readonly direction: MessageDirection,
    public readonly messageType: MessageType,
    public readonly body: string | null,
    public readonly mediaUrl: string | null,
    public readonly mimeType: string | null,
    public readonly waMessageId: string,
    public readonly waStatus: MessageWaStatus,
    public readonly timestamp: Date,
    public readonly senderAgentId: string | null,
    public readonly senderAgentName: string | null,
    public readonly campaignId: string | null = null,
    public readonly waErrorCode: string | null = null,
    public readonly waErrorMessage: string | null = null,
    /** Id de la opción elegida en un mensaje interactivo (botón/fila) o payload de quick-reply de plantilla */
    public readonly interactiveReplyId: string | null = null,
    /** waMessageId del mensaje al que responde (context.id de Meta) */
    public readonly contextWaMessageId: string | null = null,
    /** Solo outbound interactivo: definición de botones/lista para render en el chat */
    public readonly interactivePayload: Record<string, unknown> | null = null,
    /** MediaAsset asociado. El estado del archivo (listo/expirado) vive ahí, no acá. */
    public readonly mediaAssetId: string | null = null,
    /** Coordenadas de un mensaje `location`, para dibujar el mapa en el chat. */
    public readonly location: MessageLocation | null = null,
    /**
     * Quién escribió el saliente. Antes se deducía de `senderAgentId`, pero
     * desde que el bot dejó de ser un agente los mensajes de IA y los de una
     * automatización quedaron los dos en null y se volvieron indistinguibles —
     * y de esa distinción depende el conteo de respuestas fallidas seguidas
     * que dispara la derivación a un humano.
     */
    public readonly senderKind: MessageSenderKind | null = null,
  ) {}
}

/**
 * Representación en texto de un mensaje, para todo lo que no dibuja burbujas:
 * el transcript que lee la IA, el matcheo de automatizaciones y los previews.
 *
 * Una ubicación llega con el `body` vacío — las coordenadas viajan aparte — así
 * que sin esto esos canales veían un turno en blanco.
 */
export function messageToText(message: Pick<Message, 'body' | 'location'>): string {
  if (message.body) return message.body;
  if (message.location) return formatLocation(message.location);
  return '';
}
