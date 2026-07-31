import { WebhookEndpointRepository } from '../../../domain/repositories/webhook-endpoint.repository.js';
import { SubscriptionRepository } from '../../../domain/repositories/subscription.repository.js';
import { DeveloperEventType, SUBSCRIBABLE_DEVELOPER_EVENTS } from '../../../domain/enums/developer-event-type.enum.js';
import { Result, ok, err } from '../../common/result.js';
import { DomainError, FeatureNotInPlanError } from '../../../domain/errors/domain-errors.js';
import { generateWebhookSecret, toWebhookEndpointView, WebhookEndpointView } from './developer-credentials.util.js';
import { resolvePlanFeatures } from './plan-features.util.js';

const MAX_ENDPOINTS = 10;

export interface CreateWebhookEndpointInput {
  tenantId: string;
  url: string;
  description?: string | null;
  events: DeveloperEventType[];
}

export function validateWebhookUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return 'The URL is not valid.';
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return 'Only http(s) URLs are allowed.';
  }
  return null;
}

export class CreateWebhookEndpointUseCase {
  constructor(
    private readonly endpointRepo: WebhookEndpointRepository,
    private readonly subscriptionRepo: SubscriptionRepository,
  ) {}

  async execute(input: CreateWebhookEndpointInput): Promise<Result<WebhookEndpointView, DomainError>> {
    const { limits } = await resolvePlanFeatures(this.subscriptionRepo, input.tenantId);
    if (!limits.webhooks) return err(new FeatureNotInPlanError('webhooks'));

    const urlError = validateWebhookUrl(input.url);
    if (urlError) return err(new DomainError('INVALID_WEBHOOK_URL', urlError));

    const events = input.events.filter((e) => SUBSCRIBABLE_DEVELOPER_EVENTS.includes(e));
    if (events.length === 0) {
      return err(new DomainError('NO_EVENTS_SELECTED', 'Subscribe the endpoint to at least one event.'));
    }

    const count = await this.endpointRepo.countByTenantId(input.tenantId);
    if (count >= MAX_ENDPOINTS) {
      return err(new DomainError('WEBHOOK_ENDPOINT_LIMIT_REACHED', `You can have at most ${MAX_ENDPOINTS} webhook endpoints.`));
    }

    const endpoint = await this.endpointRepo.create({
      tenantId: input.tenantId,
      url: input.url,
      description: input.description?.trim() || null,
      secret: generateWebhookSecret(),
      events,
      active: true,
    });

    return ok(toWebhookEndpointView(endpoint));
  }
}
