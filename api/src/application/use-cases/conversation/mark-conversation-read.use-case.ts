import { ConversationRepository } from '../../../domain/repositories/conversation.repository.js';
import { MessageRepository } from '../../../domain/repositories/message.repository.js';
import { PhoneNumberRepository } from '../../../domain/repositories/phone-number.repository.js';
import { MessageDirection } from '../../../domain/enums/message-direction.enum.js';
import { RealtimeGatewayPort } from '../../ports/realtime-gateway.port.js';
import { MessagingApiPort } from '../../ports/messaging-api.port.js';

/** Cuántos mensajes se miran hacia atrás para encontrar el último entrante. */
const LOOKBACK = 20;

/**
 * Resetea el contador de no leídos (cualquier agente que abre la conversación)
 * y le manda a WhatsApp el acuse de lectura del último entrante, que es lo que
 * le pinta los tildes azules al cliente.
 *
 * El acuse va acá y no al recibir el mensaje a propósito: marcarlo leído cuando
 * entra sería mentir si nadie lo abrió nunca. El bot marca por su lado, cuando
 * efectivamente lo va a contestar.
 */
export class MarkConversationReadUseCase {
  constructor(
    private readonly conversationRepo: ConversationRepository,
    private readonly gateway: RealtimeGatewayPort,
    private readonly messageRepo: MessageRepository,
    private readonly phoneRepo: PhoneNumberRepository,
    private readonly messagingApi: MessagingApiPort,
  ) {}

  async execute(conversationId: string, tenantId: string): Promise<void> {
    await this.conversationRepo.clearUnread(conversationId);
    // Sincroniza el badge en los demás dispositivos/agentes
    this.gateway.emitToTenant(tenantId, 'conversation.updated', { conversationId });

    // El acuse es cosmético: nunca puede tumbar el marcado como leído local.
    try {
      await this.sendReadReceipt(conversationId, tenantId);
    } catch {
      // ya se loguea adentro del adapter
    }
  }

  private async sendReadReceipt(conversationId: string, tenantId: string): Promise<void> {
    const conversation = await this.conversationRepo.findById(conversationId);
    if (!conversation || conversation.tenantId !== tenantId) return;

    const { data: messages } = await this.messageRepo.findByConversationId(conversationId, 1, LOOKBACK);
    const lastInbound = messages.find((m) => m.direction === MessageDirection.INBOUND);
    if (!lastInbound?.waMessageId) return;

    const phone = await this.phoneRepo.findById(conversation.phoneNumberId);
    if (!phone) return;

    await this.messagingApi.markAsRead({
      provider: phone.provider,
      providerConfig: phone.providerConfig,
      phoneNumberId: phone.phoneNumberId,
      waMessageId: lastInbound.waMessageId,
    });
  }
}
