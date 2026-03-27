import { MessageDirection } from '../enums/message-direction.enum.js';
import { MessageType } from '../enums/message-type.enum.js';
import { MessageWaStatus } from '../enums/message-wa-status.enum.js';

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
  ) {}
}
