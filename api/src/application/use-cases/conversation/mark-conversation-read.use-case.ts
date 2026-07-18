import { ConversationRepository } from '../../../domain/repositories/conversation.repository.js';
import { RealtimeGatewayPort } from '../../ports/realtime-gateway.port.js';

/** Resetea el contador de no leídos (cualquier agente que abre la conversación). */
export class MarkConversationReadUseCase {
  constructor(
    private readonly conversationRepo: ConversationRepository,
    private readonly gateway: RealtimeGatewayPort,
  ) {}

  async execute(conversationId: string, tenantId: string): Promise<void> {
    await this.conversationRepo.clearUnread(conversationId);
    // Sincroniza el badge en los demás dispositivos/agentes
    this.gateway.emitToTenant(tenantId, 'conversation.updated', { conversationId });
  }
}
