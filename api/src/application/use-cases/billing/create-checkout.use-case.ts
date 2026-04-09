import { SubscriptionRepository } from '../../../domain/repositories/subscription.repository.js';
import { AgentRepository } from '../../../domain/repositories/agent.repository.js';
import { PaymentProviderPort, CreateCheckoutResult } from '../../ports/payment-provider.port.js';
import { PaymentProviderResolverPort } from '../../ports/payment-provider-resolver.port.js';
import { PlanTier } from '../../../domain/enums/plan-tier.enum.js';
import { SubscriptionStatus } from '../../../domain/enums/subscription-status.enum.js';
import { Result, ok, err } from '../../common/result.js';
import { DomainError, CheckoutCreationError } from '../../../domain/errors/domain-errors.js';

export interface CreateCheckoutInput {
  tenantId: string;
  agentId: string;
  plan: PlanTier;
  countryCode?: string | null;
}

export class CreateCheckoutUseCase {
  constructor(
    private readonly subscriptionRepo: SubscriptionRepository,
    private readonly agentRepo: AgentRepository,
    private readonly paymentProvider: PaymentProviderPort,
    private readonly providerResolver: PaymentProviderResolverPort,
  ) {}

  async execute(input: CreateCheckoutInput): Promise<Result<CreateCheckoutResult, DomainError>> {
    if (input.plan === PlanTier.FREE) {
      return err(new DomainError('INVALID_PLAN', 'Free plan does not require checkout. Use POST /billing/subscribe.'));
    }

    if (input.plan === PlanTier.AGENCIES) {
      return err(new DomainError('CONTACT_REQUIRED', 'Agencies plan requires contacting sales.'));
    }

    const existing = await this.subscriptionRepo.findByTenantId(input.tenantId);
    if (existing && existing.status === SubscriptionStatus.ACTIVE && existing.plan === input.plan) {
      return err(new DomainError('SUBSCRIPTION_EXISTS', `Already subscribed to ${input.plan} plan.`));
    }

    const agent = await this.agentRepo.findById(input.agentId);
    if (!agent) {
      return err(new DomainError('AGENT_NOT_FOUND', 'Agent not found.'));
    }

    // Resolve provider (Phase 1: always Lemon Squeezy)
    this.providerResolver.resolve(input.countryCode ?? null);

    try {
      const result = await this.paymentProvider.createCheckout({
        tenantId: input.tenantId,
        customerEmail: agent.email,
        plan: input.plan,
        successUrl: `${process.env.FRONTEND_URL ?? 'http://localhost:3001'}/settings/billing?success=true`,
        cancelUrl: `${process.env.FRONTEND_URL ?? 'http://localhost:3001'}/settings/billing?canceled=true`,
      });
      return ok(result);
    } catch (error) {
      return err(new CheckoutCreationError((error as Error).message));
    }
  }
}
