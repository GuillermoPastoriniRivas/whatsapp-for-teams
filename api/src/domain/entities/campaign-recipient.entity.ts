import { CampaignRecipientStatus } from '../enums/campaign-recipient-status.enum.js';

export class CampaignRecipient {
  constructor(
    public readonly id: string,
    public readonly campaignId: string,
    public readonly tenantId: string,
    public readonly contactId: string,
    /** Snapshot del teléfono al armar la campaña. Null si el contacto solo tiene BSUID. */
    public readonly phone: string | null,
    /** Snapshot del BSUID. Al menos uno de los dos está presente. */
    public readonly bsuid: string | null,
    public readonly resolvedVariables: Record<string, string>,
    public readonly status: CampaignRecipientStatus,
    public readonly attemptCount: number,
    public readonly nextAttemptAt: Date | null,
    public readonly waMessageId: string | null,
    public readonly messageId: string | null,
    public readonly conversationId: string | null,
    public readonly failureCode: string | null,
    public readonly failureReason: string | null,
    public readonly sentAt: Date | null,
    public readonly deliveredAt: Date | null,
    public readonly readAt: Date | null,
    public readonly repliedAt: Date | null,
    public readonly replyWindowExpiresAt: Date | null,
    public readonly createdAt: Date,
  ) {}
}
