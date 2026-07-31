import { WebhookEndpointRepository } from '../../../domain/repositories/webhook-endpoint.repository.js';
import { DeveloperEventType, SUBSCRIBABLE_DEVELOPER_EVENTS } from '../../../domain/enums/developer-event-type.enum.js';
import { Result, ok, err } from '../../common/result.js';
import { DomainError, WebhookEndpointNotFoundError } from '../../../domain/errors/domain-errors.js';
import { toWebhookEndpointView, WebhookEndpointView } from './developer-credentials.util.js';
import { validateWebhookUrl } from './create-webhook-endpoint.use-case.js';

export interface UpdateWebhookEndpointInput {
  tenantId: string;
  endpointId: string;
  url?: string;
  description?: string | null;
  events?: DeveloperEventType[];
  active?: boolean;
}

export class UpdateWebhookEndpointUseCase {
  constructor(private readonly endpointRepo: WebhookEndpointRepository) {}

  async execute(input: UpdateWebhookEndpointInput): Promise<Result<WebhookEndpointView, DomainError>> {
    const endpoint = await this.endpointRepo.findById(input.endpointId);
    if (!endpoint || endpoint.tenantId !== input.tenantId) {
      return err(new WebhookEndpointNotFoundError());
    }

    const data: Record<string, unknown> = {};

    if (input.url !== undefined) {
      const urlError = validateWebhookUrl(input.url);
      if (urlError) return err(new DomainError('INVALID_WEBHOOK_URL', urlError));
      data.url = input.url;
    }
    if (input.description !== undefined) data.description = input.description?.trim() || null;
    if (input.events !== undefined) {
      const events = input.events.filter((e) => SUBSCRIBABLE_DEVELOPER_EVENTS.includes(e));
      if (events.length === 0) {
        return err(new DomainError('NO_EVENTS_SELECTED', 'Subscribe the endpoint to at least one event.'));
      }
      data.events = events;
    }
    if (input.active !== undefined) data.active = input.active;

    const updated = await this.endpointRepo.update(input.endpointId, data);
    return ok(toWebhookEndpointView(updated ?? endpoint));
  }
}
