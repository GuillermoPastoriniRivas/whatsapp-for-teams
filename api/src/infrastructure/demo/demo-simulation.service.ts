import { Injectable, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import type { ConversationRepository } from '../../domain/repositories/conversation.repository.js';
import type { MessageRepository } from '../../domain/repositories/message.repository.js';
import type { AgentRepository } from '../../domain/repositories/agent.repository.js';
import type { ContactRepository } from '../../domain/repositories/contact.repository.js';
import type { TenantRepository } from '../../domain/repositories/tenant.repository.js';
import type { RealtimeGatewayPort } from '../../application/ports/realtime-gateway.port.js';
import { MessageDirection } from '../../domain/enums/message-direction.enum.js';
import { MessageType } from '../../domain/enums/message-type.enum.js';
import { MessageWaStatus } from '../../domain/enums/message-wa-status.enum.js';
import { AgentType } from '../../domain/enums/agent-type.enum.js';
import { ConversationStatus } from '../../domain/enums/conversation-status.enum.js';

const INBOUND_MESSAGES = [
  'Hola, quiero hacer un pedido',
  'Tienen stock de camperas talle L?',
  'Cuanto tarda el envio a Cordoba?',
  'Me pueden pasar el catalogo actualizado?',
  'Buenas! Vi la publicacion en Instagram',
  'Necesito factura A, es posible?',
  'Se puede retirar en local?',
  'A que hora cierran hoy?',
  'Tienen algun descuento esta semana?',
  'Quiero saber el estado de mi pedido #3847',
  'Hola, una consulta sobre un producto',
  'Buenos dias! Queria preguntar por los precios',
  'Hola, me llego un producto equivocado',
  'Tienen envio gratis?',
  'Puedo pagar con MercadoPago?',
];

const AI_RESPONSES = [
  'Hola! Bienvenido a nuestra tienda. En que puedo ayudarte?',
  'Si, tenemos stock disponible. Que talle necesitas?',
  'Los envios al interior tardan entre 3 y 5 dias habiles.',
  'Nuestro horario es Lunes a Viernes de 9 a 18hs y Sabados de 10 a 14hs.',
  'Aceptamos efectivo, transferencia, tarjetas y MercadoPago.',
  'Dejame verificar eso. Un momento por favor.',
  'Si, el envio es gratis para compras mayores a $10.000 en CABA.',
  'Podes hacer el cambio dentro de los 30 dias con el ticket de compra.',
];

const MAX_SIMULATED_MESSAGES = 50;

@Injectable()
export class DemoSimulationService implements OnModuleInit, OnModuleDestroy {
  private interval: ReturnType<typeof setInterval> | null = null;
  private messageCount = 0;
  private demoTenantId: string | null = null;

  private readonly conversationRepo: ConversationRepository;
  private readonly messageRepo: MessageRepository;
  private readonly agentRepo: AgentRepository;
  private readonly contactRepo: ContactRepository;
  private readonly tenantRepo: TenantRepository;
  private readonly gateway: RealtimeGatewayPort;

  constructor(
    @Inject('ConversationRepository') conversationRepo: any,
    @Inject('MessageRepository') messageRepo: any,
    @Inject('AgentRepository') agentRepo: any,
    @Inject('ContactRepository') contactRepo: any,
    @Inject('TenantRepository') tenantRepo: any,
    @Inject('RealtimeGatewayPort') gateway: any,
  ) {
    this.conversationRepo = conversationRepo;
    this.messageRepo = messageRepo;
    this.agentRepo = agentRepo;
    this.contactRepo = contactRepo;
    this.tenantRepo = tenantRepo;
    this.gateway = gateway;
  }

  async onModuleInit() {
    const tenant = await this.tenantRepo.findBySlug('demo-asis-chat');
    if (!tenant) return;
    this.demoTenantId = tenant.id;
    console.log('[DemoSimulation] Starting simulation for demo tenant');
    this.scheduleNext();
  }

  onModuleDestroy() {
    if (this.interval) {
      clearTimeout(this.interval);
      this.interval = null;
    }
  }

  private scheduleNext() {
    if (this.messageCount >= MAX_SIMULATED_MESSAGES) {
      console.log(`[DemoSimulation] Reached ${MAX_SIMULATED_MESSAGES} messages, stopping`);
      return;
    }
    // Random interval between 45-90 seconds
    const delay = (45 + Math.random() * 45) * 1000;
    this.interval = setTimeout(() => this.tick(), delay);
  }

  private async tick() {
    try {
      await this.simulateAction();
    } catch (err) {
      console.error('[DemoSimulation] Error:', err);
    }
    this.scheduleNext();
  }

  private async simulateAction() {
    if (!this.demoTenantId) return;

    const roll = Math.random();

    if (roll < 0.6) {
      await this.simulateInboundMessage();
    } else if (roll < 0.8) {
      await this.simulateAiReply();
    } else {
      await this.simulateInboundMessage();
    }
  }

  private async simulateInboundMessage() {
    // Find active or unassigned conversations for the demo tenant
    const conversations = await this.conversationRepo.findByFilters({
      tenantId: this.demoTenantId!,
      page: 1,
      limit: 20,
    });

    const eligible = conversations.data.filter(
      (c) => c.status === ConversationStatus.ACTIVE || c.status === ConversationStatus.UNASSIGNED,
    );
    if (eligible.length === 0) return;

    const conv = eligible[Math.floor(Math.random() * eligible.length)];
    const body = INBOUND_MESSAGES[Math.floor(Math.random() * INBOUND_MESSAGES.length)];
    const waMessageId = `demo-sim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const message = await this.messageRepo.upsertByWaMessageId({
      conversationId: conv.id,
      direction: MessageDirection.INBOUND,
      messageType: MessageType.TEXT,
      body,
      mediaUrl: null,
      mimeType: null,
      waMessageId,
      waStatus: MessageWaStatus.DELIVERED,
      timestamp: new Date(),
      senderAgentId: null,
      senderAgentName: null,
    });

    await this.conversationRepo.update(conv.id, {
      lastMessageAt: new Date(),
      lastInboundAt: new Date(),
    } as any);

    // Mismo recorrido que un inbound real: contador de no leidos + preview
    // tenant-wide, para que el visitante vea el badge y el toast en vivo.
    await this.conversationRepo.incrementUnread(conv.id);

    const contact = await this.contactRepo.findById(conv.contactId);

    this.gateway.emitToConversation(conv.id, 'message.new', message);
    this.gateway.emitToTenant(this.demoTenantId!, 'conversation.updated', { conversationId: conv.id });
    this.gateway.emitToTenant(this.demoTenantId!, 'message.preview', {
      conversationId: conv.id,
      contactName: contact?.name ?? contact?.phone ?? 'Contacto',
      body,
      messageId: message.id,
    });
    this.messageCount++;
  }

  private async simulateAiReply() {
    if (!this.demoTenantId) return;

    // Find conversations assigned to AI agents
    const agents = await this.agentRepo.findByTenantId(this.demoTenantId);
    const aiAgents = agents.filter((a) => a.type === AgentType.AI);
    if (aiAgents.length === 0) return;

    const aiAgentIds = new Set(aiAgents.map((a) => a.id));

    const conversations = await this.conversationRepo.findByFilters({
      tenantId: this.demoTenantId,
      status: ConversationStatus.ACTIVE,
      page: 1,
      limit: 20,
    });

    const aiConvs = conversations.data.filter((c) => c.agentId && aiAgentIds.has(c.agentId));
    if (aiConvs.length === 0) return;

    const conv = aiConvs[Math.floor(Math.random() * aiConvs.length)];
    const agent = aiAgents.find((a) => a.id === conv.agentId)!;
    const body = AI_RESPONSES[Math.floor(Math.random() * AI_RESPONSES.length)];
    const waMessageId = `demo-ai-sim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const message = await this.messageRepo.upsertByWaMessageId({
      conversationId: conv.id,
      direction: MessageDirection.OUTBOUND,
      messageType: MessageType.TEXT,
      body,
      mediaUrl: null,
      mimeType: null,
      waMessageId,
      waStatus: MessageWaStatus.DELIVERED,
      timestamp: new Date(),
      senderAgentId: agent.id,
      senderAgentName: agent.name,
    });

    await this.conversationRepo.update(conv.id, { lastMessageAt: new Date() } as any);

    this.gateway.emitToConversation(conv.id, 'message.new', message);
    this.gateway.emitToTenant(this.demoTenantId, 'conversation.updated', { conversationId: conv.id });
    this.messageCount++;
  }
}
