import {
  Controller, Get, Post, Patch, Body,
  Inject, ForbiddenException, ConflictException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SubscribeUseCase } from '../../application/use-cases/billing/subscribe.use-case.js';
import { ChangePlanUseCase } from '../../application/use-cases/billing/change-plan.use-case.js';
import { CancelSubscriptionUseCase } from '../../application/use-cases/billing/cancel-subscription.use-case.js';
import { GetSubscriptionUseCase } from '../../application/use-cases/billing/get-subscription.use-case.js';
import { GetBillingHistoryUseCase } from '../../application/use-cases/billing/get-billing-history.use-case.js';
import { CheckPlanLimitUseCase } from '../../application/use-cases/billing/check-plan-limit.use-case.js';
import { ToggleResourceUseCase } from '../../application/use-cases/billing/toggle-resource.use-case.js';
import { PlanTier } from '../../domain/enums/plan-tier.enum.js';
import { Roles } from '../decorators/roles.decorator.js';
import { CurrentAgent } from '../decorators/current-agent.decorator.js';
import type { RequestAgent } from '../decorators/current-agent.decorator.js';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe.js';
import { SubscribeRequestSchema } from '../request-dtos/subscribe-request.dto.js';
import type { SubscribeRequestDto } from '../request-dtos/subscribe-request.dto.js';
import { ChangePlanRequestSchema } from '../request-dtos/change-plan-request.dto.js';
import type { ChangePlanRequestDto } from '../request-dtos/change-plan-request.dto.js';
import { ToggleResourceRequestSchema } from '../request-dtos/toggle-resource-request.dto.js';
import type { ToggleResourceRequestDto } from '../request-dtos/toggle-resource-request.dto.js';

@ApiTags('Billing')
@ApiBearerAuth('JWT')
@Controller('billing')
export class BillingController {
  constructor(
    @Inject('SubscribeUseCase') private readonly subscribe: SubscribeUseCase,
    @Inject('ChangePlanUseCase') private readonly changePlan: ChangePlanUseCase,
    @Inject('CancelSubscriptionUseCase') private readonly cancelSub: CancelSubscriptionUseCase,
    @Inject('GetSubscriptionUseCase') private readonly getSub: GetSubscriptionUseCase,
    @Inject('GetBillingHistoryUseCase') private readonly getHistory: GetBillingHistoryUseCase,
    @Inject('CheckPlanLimitUseCase') private readonly checkLimit: CheckPlanLimitUseCase,
    @Inject('ToggleResourceUseCase') private readonly toggleResource: ToggleResourceUseCase,
  ) {}

  @Get('subscription')
  @ApiOperation({ summary: 'Get current subscription', description: 'Get the current subscription and plan limits for the tenant' })
  async getSubscription(@CurrentAgent() agent: RequestAgent) {
    return this.getSub.execute(agent.tenantId);
  }

  @Post('subscribe')
  @Roles('admin')
  @ApiOperation({ summary: 'Subscribe to plan', description: 'Subscribe the tenant to a plan (admin only). Mock payment — always succeeds.' })
  async subscribeToPlan(
    @Body(new ZodValidationPipe(SubscribeRequestSchema)) body: SubscribeRequestDto,
    @CurrentAgent() agent: RequestAgent,
  ) {
    const result = await this.subscribe.execute({
      tenantId: agent.tenantId,
      plan: body.plan as PlanTier,
    });
    if (!result.ok) throw new ConflictException(result.error.message);
    return result.value;
  }

  @Patch('plan')
  @Roles('admin')
  @ApiOperation({ summary: 'Change plan', description: 'Change the tenant subscription plan (admin only). Mock payment — always succeeds.' })
  async changePlanAction(
    @Body(new ZodValidationPipe(ChangePlanRequestSchema)) body: ChangePlanRequestDto,
    @CurrentAgent() agent: RequestAgent,
  ) {
    const result = await this.changePlan.execute({
      tenantId: agent.tenantId,
      newPlan: body.newPlan as PlanTier,
    });
    if (!result.ok) throw new ForbiddenException(result.error.message);
    return result.value;
  }

  @Post('cancel')
  @Roles('admin')
  @ApiOperation({ summary: 'Cancel subscription', description: 'Cancel the current subscription (admin only)' })
  async cancelSubscription(@CurrentAgent() agent: RequestAgent) {
    const result = await this.cancelSub.execute(agent.tenantId);
    if (!result.ok) throw new ForbiddenException(result.error.message);
    return result.value;
  }

  @Get('history')
  @Roles('admin')
  @ApiOperation({ summary: 'Billing history', description: 'Get billing history for the tenant (admin only)' })
  async billingHistory(@CurrentAgent() agent: RequestAgent) {
    return this.getHistory.execute(agent.tenantId);
  }

  @Get('usage')
  @ApiOperation({ summary: 'Plan usage', description: 'Get current resource usage versus plan limits' })
  async usage(@CurrentAgent() agent: RequestAgent) {
    return this.checkLimit.getFullUsage(agent.tenantId);
  }

  @Post('toggle-resource')
  @Roles('admin')
  @ApiOperation({ summary: 'Toggle resource', description: 'Activate/deactivate a resource within plan limits (swap). Admin only.' })
  async toggle(
    @Body(new ZodValidationPipe(ToggleResourceRequestSchema)) body: ToggleResourceRequestDto,
    @CurrentAgent() agent: RequestAgent,
  ) {
    const result = await this.toggleResource.execute({
      tenantId: agent.tenantId,
      resourceType: body.resourceType as any,
      activateId: body.activateId,
      deactivateId: body.deactivateId,
    });
    if (!result.ok) throw new ForbiddenException(result.error.message);
    return result.value;
  }
}
