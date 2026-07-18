import { Campaign } from '../../../domain/entities/campaign.entity.js';
import { CampaignRepository } from '../../../domain/repositories/campaign.repository.js';
import { CampaignRecipientRepository, CreateCampaignRecipientInput } from '../../../domain/repositories/campaign-recipient.repository.js';
import { MessageTemplateRepository } from '../../../domain/repositories/message-template.repository.js';
import { ContactRepository } from '../../../domain/repositories/contact.repository.js';
import { Contact } from '../../../domain/entities/contact.entity.js';
import { JobQueuePort } from '../../ports/job-queue.port.js';
import { Result, ok, err } from '../../common/result.js';
import {
  DomainError,
  CampaignAlreadyActiveOnPhoneError,
  CampaignNotFoundError,
  EmptyAudienceError,
  InvalidCampaignStateError,
  TemplateNotApprovedError,
} from '../../../domain/errors/domain-errors.js';
import { CampaignStatus } from '../../../domain/enums/campaign-status.enum.js';
import { CampaignRecipientStatus } from '../../../domain/enums/campaign-recipient-status.enum.js';
import { TemplateStatus } from '../../../domain/enums/template-status.enum.js';
import { resolveVariables } from './helpers/template-variable.resolver.js';

export const CAMPAIGN_DISPATCH_JOB = 'campaign.dispatch';

const BULK_INSERT_CHUNK = 1000;
const AUDIENCE_PAGE_SIZE = 500;
const MAX_AUDIENCE_SIZE = 50_000;

export class StartCampaignUseCase {
  constructor(
    private readonly campaignRepo: CampaignRepository,
    private readonly recipientRepo: CampaignRecipientRepository,
    private readonly templateRepo: MessageTemplateRepository,
    private readonly contactRepo: ContactRepository,
    private readonly jobQueue: JobQueuePort,
  ) {}

  async execute(tenantId: string, campaignId: string): Promise<Result<Campaign, DomainError>> {
    const campaign = await this.campaignRepo.findById(campaignId);
    if (!campaign || campaign.tenantId !== tenantId) return err(new CampaignNotFoundError());

    const template = await this.templateRepo.findById(campaign.templateId);
    if (!template || template.status !== TemplateStatus.APPROVED) return err(new TemplateNotApprovedError());

    // One active campaign per phone number keeps per-number throughput
    // inside Meta's messaging limits without a global rate limiter.
    const activeOnPhone = await this.campaignRepo.countActiveByPhoneNumberId(campaign.phoneNumberId);
    if (activeOnPhone > 0) return err(new CampaignAlreadyActiveOnPhoneError());

    // Atomic DRAFT → SCHEDULED: a concurrent start loses this race and errors out.
    const scheduled = await this.campaignRepo.transitionStatus(campaign.id, [CampaignStatus.DRAFT], CampaignStatus.SCHEDULED);
    if (!scheduled) return err(new InvalidCampaignStateError('Only draft campaigns can be started.'));

    // Materialize the audience into recipient rows with a variable snapshot.
    let totalInserted = 0;
    let totalSkipped = 0;
    try {
      const materialized = await this.materializeAudience(scheduled);
      totalInserted = materialized.inserted;
      totalSkipped = materialized.skipped;
    } catch (error: any) {
      await this.campaignRepo.transitionStatus(campaign.id, [CampaignStatus.SCHEDULED], CampaignStatus.FAILED, {
        failureReason: `Audience materialization failed: ${error?.message}`,
      });
      return err(new DomainError('AUDIENCE_MATERIALIZATION_FAILED', error?.message ?? 'Failed to materialize audience.'));
    }

    if (totalInserted === 0) {
      await this.campaignRepo.transitionStatus(campaign.id, [CampaignStatus.SCHEDULED], CampaignStatus.FAILED, {
        failureReason: 'Audience resolved to zero sendable recipients',
      });
      return err(new EmptyAudienceError());
    }

    await this.campaignRepo.incrementCounts(campaign.id, { total: totalInserted + totalSkipped, skipped: totalSkipped });

    if (scheduled.scheduledAt && scheduled.scheduledAt.getTime() > Date.now()) {
      await this.jobQueue.schedule(CAMPAIGN_DISPATCH_JOB, { campaignId: campaign.id }, scheduled.scheduledAt);
    } else {
      await this.campaignRepo.transitionStatus(campaign.id, [CampaignStatus.SCHEDULED], CampaignStatus.RUNNING, {
        startedAt: new Date(),
      });
      await this.jobQueue.enqueue(CAMPAIGN_DISPATCH_JOB, { campaignId: campaign.id });
    }

    return ok((await this.campaignRepo.findById(campaign.id))!);
  }

  private async materializeAudience(campaign: Campaign): Promise<{ inserted: number; skipped: number }> {
    const template = (await this.templateRepo.findById(campaign.templateId))!;
    let inserted = 0;
    let skipped = 0;
    let batch: CreateCampaignRecipientInput[] = [];

    const flush = async () => {
      if (batch.length === 0) return;
      inserted += await this.recipientRepo.bulkInsert(batch.filter((r) => r.status === CampaignRecipientStatus.PENDING));
      skipped += batch.filter((r) => r.status === CampaignRecipientStatus.SKIPPED).length;
      await this.recipientRepo.bulkInsert(batch.filter((r) => r.status === CampaignRecipientStatus.SKIPPED));
      batch = [];
    };

    for await (const contact of this.iterateAudience(campaign)) {
      if (!contact.waId) continue;

      const resolved = resolveVariables(template.components, campaign.variableMappings, contact);
      batch.push({
        campaignId: campaign.id,
        tenantId: campaign.tenantId,
        contactId: contact.id,
        waId: contact.waId,
        phone: contact.phone,
        resolvedVariables: resolved.ok ? resolved.variables : {},
        status: resolved.ok ? CampaignRecipientStatus.PENDING : CampaignRecipientStatus.SKIPPED,
        failureReason: resolved.ok ? null : `Missing variables: ${resolved.missing.join(', ')}`,
      });

      if (batch.length >= BULK_INSERT_CHUNK) await flush();
    }
    await flush();

    return { inserted, skipped };
  }

  private async *iterateAudience(campaign: Campaign): AsyncGenerator<Contact> {
    if (campaign.audience.type === 'contactIds') {
      const ids = campaign.audience.contactIds ?? [];
      for (let i = 0; i < ids.length; i += AUDIENCE_PAGE_SIZE) {
        const contacts = await this.contactRepo.findByIds(ids.slice(i, i + AUDIENCE_PAGE_SIZE));
        for (const contact of contacts) {
          if (contact.tenantId === campaign.tenantId) yield contact;
        }
      }
      return;
    }

    let page = 1;
    let yielded = 0;
    for (;;) {
      const result = await this.contactRepo.findByTenantId(campaign.tenantId, {
        search: campaign.audience.search,
        page,
        limit: AUDIENCE_PAGE_SIZE,
      });
      for (const contact of result.data) {
        yield contact;
        if (++yielded >= MAX_AUDIENCE_SIZE) return;
      }
      if (page >= result.meta.pages || result.data.length === 0) return;
      page++;
    }
  }
}
