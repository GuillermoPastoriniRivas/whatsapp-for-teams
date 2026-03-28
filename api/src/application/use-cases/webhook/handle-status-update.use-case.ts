import { MessageRepository } from '../../../domain/repositories/message.repository.js';
import { RealtimeGatewayPort } from '../../ports/realtime-gateway.port.js';
import { StatusUpdateInput } from '../../dtos/webhook/status-update-input.dto.js';
import { MessageWaStatus } from '../../../domain/enums/message-wa-status.enum.js';

export class HandleStatusUpdateUseCase {
  constructor(
    private readonly messageRepo: MessageRepository,
    private readonly gateway: RealtimeGatewayPort,
  ) {}

  async execute(input: StatusUpdateInput): Promise<void> {
    const message = await this.messageRepo.updateStatusByWaMessageId(
      input.waMessageId,
      input.status as MessageWaStatus,
    );

    if (message) {
      this.gateway.emitToConversation(message.conversationId, 'message.status', {
        waMessageId: input.waMessageId,
        waStatus: input.status,
      });
    }
  }
}
