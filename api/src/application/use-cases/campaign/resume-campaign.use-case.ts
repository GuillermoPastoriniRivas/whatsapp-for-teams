import { Campaign } from '../../../domain/entities/campaign.entity.js';
import { CampaignRepository } from '../../../domain/repositories/campaign.repository.js';
import { MessageTemplateRepository } from '../../../domain/repositories/message-template.repository.js';
import { JobQueuePort } from '../../ports/job-queue.port.js';
import { Result, ok, err } from '../../common/result.js';
import {
  DomainError,
  CampaignNotFoundError,
  InvalidCampaignStateError,
  TemplateNotApprovedError,
} from '../../../domain/errors/domain-errors.js';
import { CampaignStatus } from '../../../domain/enums/campaign-status.enum.js';
import { TemplateStatus } from '../../../domain/enums/template-status.enum.js';
import { CAMPAIGN_DISPATCH_JOB } from './start-campaign.use-case.js';

export class ResumeCampaignUseCase {
  constructor(
    private readonly campaignRepo: CampaignRepository,
    private readonly templateRepo: MessageTemplateRepository,
    private readonly jobQueue: JobQueuePort,
  ) {}

  async execute(tenantId: string, campaignId: string): Promise<Result<Campaign, DomainError>> {
    const campaign = await this.campaignRepo.findById(campaignId);
    if (!campaign || campaign.tenantId !== tenantId) return err(new CampaignNotFoundError());

    // A campaign paused because Meta paused its template must not resume until re-approval.
    const template = await this.templateRepo.findById(campaign.templateId);
    if (!template || template.status !== TemplateStatus.APPROVED) return err(new TemplateNotApprovedError());

    const resumed = await this.campaignRepo.transitionStatus(campaignId, [CampaignStatus.PAUSED], CampaignStatus.RUNNING, {
      failureReason: null,
      ...(campaign.startedAt ? {} : { startedAt: new Date() }),
    });
    if (!resumed) return err(new InvalidCampaignStateError('Only paused campaigns can be resumed.'));

    await this.jobQueue.enqueue(CAMPAIGN_DISPATCH_JOB, { campaignId });
    return ok(resumed);
  }
}
