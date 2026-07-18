import { CampaignAudience, CampaignThrottle, CampaignVariableMapping } from '../../../domain/entities/campaign.entity.js';

export interface CreateCampaignInputDto {
  tenantId: string;
  createdByAgentId: string;
  name: string;
  phoneNumberId: string;
  templateId: string;
  variableMappings: CampaignVariableMapping[];
  audience: CampaignAudience;
  scheduledAt?: Date | null;
  throttle?: Partial<CampaignThrottle>;
  replyWindowHours?: number;
}

export interface UpdateCampaignInputDto {
  tenantId: string;
  campaignId: string;
  name?: string;
  templateId?: string;
  variableMappings?: CampaignVariableMapping[];
  audience?: CampaignAudience;
  scheduledAt?: Date | null;
  throttle?: Partial<CampaignThrottle>;
  replyWindowHours?: number;
}
