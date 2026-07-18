import { MessageTemplateRepository } from '../../../domain/repositories/message-template.repository.js';
import { PhoneNumberRepository } from '../../../domain/repositories/phone-number.repository.js';
import { TemplateManagementPort } from '../../ports/template-management.port.js';
import { Result, ok, err } from '../../common/result.js';
import {
  DomainError,
  PhoneNumberNotFoundError,
  TemplateProviderError,
  WabaNotConfiguredError,
} from '../../../domain/errors/domain-errors.js';
import { TemplateCategory } from '../../../domain/enums/template-category.enum.js';
import { MessageTemplateComponent } from '../../../domain/entities/message-template.entity.js';
import {
  mapMetaTemplateCategory,
  mapMetaTemplateQuality,
  mapMetaTemplateStatus,
} from './helpers/meta-template.mapper.js';

/**
 * Pulls all templates from the WABA and upserts them locally.
 * Imports templates created outside asis.chat and repairs any
 * status drift caused by missed webhooks.
 */
export class SyncTemplatesUseCase {
  constructor(
    private readonly templateRepo: MessageTemplateRepository,
    private readonly phoneRepo: PhoneNumberRepository,
    private readonly templateApi: TemplateManagementPort,
  ) {}

  async execute(tenantId: string, phoneNumberId: string): Promise<Result<{ synced: number }, DomainError>> {
    const phone = await this.phoneRepo.findById(phoneNumberId);
    if (!phone || phone.tenantId !== tenantId) return err(new PhoneNumberNotFoundError());
    if (!phone.wabaId) return err(new WabaNotConfiguredError());

    let remoteTemplates;
    try {
      remoteTemplates = await this.templateApi.listTemplates({
        provider: phone.provider,
        providerConfig: phone.providerConfig,
        wabaId: phone.wabaId,
      });
    } catch (error: any) {
      return err(new TemplateProviderError(error?.message));
    }

    const now = new Date();
    for (const remote of remoteTemplates) {
      await this.templateRepo.upsertFromSync({
        tenantId,
        phoneNumberId: phone.id,
        wabaId: phone.wabaId,
        metaTemplateId: remote.metaTemplateId,
        name: remote.name,
        language: remote.language,
        category: mapMetaTemplateCategory(remote.category) ?? TemplateCategory.MARKETING,
        status: mapMetaTemplateStatus(remote.status),
        qualityScore: mapMetaTemplateQuality(remote.qualityScore),
        components: remote.components as MessageTemplateComponent[],
        rejectionReason: remote.rejectionReason,
        lastSyncedAt: now,
      });
    }

    return ok({ synced: remoteTemplates.length });
  }
}
