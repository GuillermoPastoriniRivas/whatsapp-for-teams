import { ConversationRepository } from '../../../domain/repositories/conversation.repository.js';
import { MessageRepository } from '../../../domain/repositories/message.repository.js';
import { AgentRepository } from '../../../domain/repositories/agent.repository.js';
import { TenantRepository } from '../../../domain/repositories/tenant.repository.js';
import { RealtimeGatewayPort } from '../../ports/realtime-gateway.port.js';
import { MessageDirection } from '../../../domain/enums/message-direction.enum.js';
import { MessageType } from '../../../domain/enums/message-type.enum.js';
import { MessageWaStatus } from '../../../domain/enums/message-wa-status.enum.js';
import { AgentType } from '../../../domain/enums/agent-type.enum.js';

const DEMO_RESPONSES: { keywords: string[]; response: string }[] = [
  {
    keywords: ['precio', 'cuanto', 'cuesta', 'sale', 'valor'],
    response: 'Los precios dependen del producto. Podes ver el catalogo completo en nuestra web o decirme que producto te interesa y te paso el precio exacto.',
  },
  {
    keywords: ['envio', 'enviar', 'despacho', 'llega', 'shipping', 'demora'],
    response: 'Hacemos envios a CABA en 24-48hs y al interior en 3-5 dias habiles. Para compras mayores a $10.000 el envio a CABA es gratis!',
  },
  {
    keywords: ['devolucion', 'cambio', 'devolver', 'cambiar'],
    response: 'Podes hacer cambios o devoluciones dentro de los 30 dias con el ticket de compra. La devolucion se procesa en 5-7 dias habiles al mismo medio de pago.',
  },
  {
    keywords: ['horario', 'hora', 'abierto', 'atencion', 'abren', 'cierran'],
    response: 'Nuestro horario es Lunes a Viernes de 9 a 18hs y Sabados de 10 a 14hs. Los domingos y feriados permanecemos cerrados.',
  },
  {
    keywords: ['pago', 'pagar', 'transferencia', 'tarjeta', 'efectivo', 'mercadopago'],
    response: 'Aceptamos efectivo, transferencia bancaria y tarjetas de credito/debito. Tambien MercadoPago!',
  },
  {
    keywords: ['stock', 'disponible', 'tienen', 'talle', 'talla', 'color'],
    response: 'Dejame verificar la disponibilidad. En general manejamos talles del S al XXL. Que producto y talle estas buscando?',
  },
  {
    keywords: ['humano', 'persona', 'agente', 'alguien'],
    response: 'Entendido, te derivo con un miembro del equipo. En unos minutos se va a comunicar con vos. Gracias por la paciencia!',
  },
  {
    keywords: ['hola', 'buenas', 'buen dia', 'buenos dias'],
    response: 'Hola! Bienvenido a nuestra tienda. Soy Sofia, asistente virtual. En que puedo ayudarte hoy?',
  },
  {
    keywords: ['gracias', 'genial', 'perfecto', 'buenisimo'],
    response: 'De nada! Si necesitas algo mas, no dudes en escribirme. Estoy para ayudarte!',
  },
  {
    keywords: [],
    response: 'Gracias por tu mensaje! Si tenes alguna consulta sobre productos, envios, devoluciones o medios de pago, estoy para ayudarte.',
  },
];

function pickResponse(lastMessage: string): string {
  const lower = lastMessage.toLowerCase();
  for (const entry of DEMO_RESPONSES) {
    if (entry.keywords.length === 0) continue;
    if (entry.keywords.some((kw) => lower.includes(kw))) return entry.response;
  }
  return DEMO_RESPONSES[DEMO_RESPONSES.length - 1].response;
}

export class DemoAiReplyUseCase {
  constructor(
    private readonly conversationRepo: ConversationRepository,
    private readonly messageRepo: MessageRepository,
    private readonly agentRepo: AgentRepository,
    private readonly tenantRepo: TenantRepository,
    private readonly gateway: RealtimeGatewayPort,
  ) {}

  async execute(conversationId: string): Promise<void> {
    const conversation = await this.conversationRepo.findById(conversationId);
    if (!conversation) return;

    // Verify demo tenant
    const tenant = await this.tenantRepo.findById(conversation.tenantId);
    if (!tenant?.isDemo) return;

    // Verify AI agent assigned
    if (!conversation.agentId) return;
    const agent = await this.agentRepo.findById(conversation.agentId);
    if (!agent || agent.type !== AgentType.AI) return;

    // Get last messages to find context
    const messagesResult = await this.messageRepo.findByConversationId(conversationId, 1, 10);
    const messages = messagesResult.data;
    const lastOutbound = [...messages].reverse().find((m) => m.direction === MessageDirection.OUTBOUND);
    const lastInbound = [...messages].reverse().find((m) => m.direction === MessageDirection.INBOUND);

    // Use last outbound (what user just sent as agent) or last inbound as context
    const contextMessage = lastOutbound?.body || lastInbound?.body || '';
    const responseBody = pickResponse(contextMessage);

    // Delay 2-4 seconds
    const delay = 2000 + Math.random() * 2000;
    await new Promise((resolve) => setTimeout(resolve, delay));

    const waMessageId = `demo-ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const message = await this.messageRepo.upsertByWaMessageId({
      conversationId,
      direction: MessageDirection.OUTBOUND,
      messageType: MessageType.TEXT,
      body: responseBody,
      mediaUrl: null,
      mimeType: null,
      waMessageId,
      waStatus: MessageWaStatus.DELIVERED,
      timestamp: new Date(),
      senderAgentId: agent.id,
      senderAgentName: agent.name,
    });

    await this.conversationRepo.update(conversationId, { lastMessageAt: new Date() } as any);

    this.gateway.emitToConversation(conversationId, 'message.new', message);
  }
}
