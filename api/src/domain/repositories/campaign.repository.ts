import { Campaign, CampaignCounts } from '../entities/campaign.entity.js';
import { CampaignStatus } from '../enums/campaign-status.enum.js';
import { PaginatedResult } from './conversation.repository.js';

export interface CampaignFilters {
  tenantId: string;
  status?: CampaignStatus;
  phoneNumberId?: string;
  page: number;
  limit: number;
}

export type CreateCampaignInput = Omit<Campaign, 'id' | 'createdAt' | 'updatedAt'>;

export interface CampaignRepository {
  create(campaign: CreateCampaignInput): Promise<Campaign>;
  findById(id: string): Promise<Campaign | null>;
  findByFilters(filters: CampaignFilters): Promise<PaginatedResult<Campaign>>;
  update(id: string, data: Partial<Omit<Campaign, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Campaign | null>;
  /**
   * Atomic status transition: only applies if the current status is one of `from`.
   * Returns the updated campaign or null if the transition did not apply —
   * the concurrency guard for start/pause/resume/cancel races.
   */
  transitionStatus(
    id: string,
    from: CampaignStatus[],
    to: CampaignStatus,
    extra?: Partial<Pick<Campaign, 'startedAt' | 'completedAt' | 'failureReason' | 'scheduledAt'>>,
  ): Promise<Campaign | null>;
  incrementCounts(id: string, deltas: Partial<CampaignCounts>): Promise<void>;
  findRunningByTemplateId(templateId: string): Promise<Campaign[]>;
  countActiveByPhoneNumberId(phoneNumberId: string): Promise<number>;
  delete(id: string): Promise<void>;
}
