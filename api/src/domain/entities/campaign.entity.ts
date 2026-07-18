import { CampaignStatus } from '../enums/campaign-status.enum.js';

/**
 * Maps one template placeholder to a value source.
 * - component 'button' also needs the button index.
 * - position is the placeholder key: '1', '2', ... for positional params or the name for named params.
 * - source 'contact_field': value is 'name' | 'phone' | 'email' | 'company' | 'customFields.<key>'.
 * - source 'static': value is used literally for every recipient.
 */
export interface CampaignVariableMapping {
  component: 'header' | 'body' | 'button';
  index?: number;
  position: string;
  source: 'contact_field' | 'static';
  value: string;
}

export interface CampaignAudience {
  type: 'contactIds' | 'filter';
  contactIds?: string[];
  search?: string;
}

export interface CampaignThrottle {
  messagesPerSecond: number;
  batchSize: number;
}

export interface CampaignCounts {
  total: number;
  queued: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  skipped: number;
  replied: number;
}

export class Campaign {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly phoneNumberId: string,
    public readonly templateId: string,
    public readonly name: string,
    public readonly status: CampaignStatus,
    public readonly variableMappings: CampaignVariableMapping[],
    public readonly audience: CampaignAudience,
    public readonly scheduledAt: Date | null,
    public readonly startedAt: Date | null,
    public readonly completedAt: Date | null,
    public readonly throttle: CampaignThrottle,
    public readonly replyWindowHours: number,
    public readonly counts: CampaignCounts,
    public readonly createdByAgentId: string,
    public readonly failureReason: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}
}
