import { MessageRepository } from '../../../domain/repositories/message.repository.js';
import { RealtimeGatewayPort } from '../../ports/realtime-gateway.port.js';
import { StatusUpdateInput } from '../../dtos/webhook/status-update-input.dto.js';

export class HandleStatusUpdateUseCase {
  constructor(
    private readonly messageRepo: MessageRepository,
    private readonly gateway: RealtimeGatewayPort,
  ) {}

  async execute(input: StatusUpdateInput): Promise<void> {
    // TODO: Implement status update handling
    // 1. Find Message by input.waMessageId
    // 2. Update waStatus (sent → delivered → read)
    // 3. Emit WebSocket event to conversation room
  }
}
