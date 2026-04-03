import { CanActivate, ExecutionContext, Injectable, ForbiddenException, Inject } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PLAN_LIMIT_KEY } from '../decorators/require-plan-limit.decorator.js';
import { CheckPlanLimitUseCase, PlanResource } from '../../application/use-cases/billing/check-plan-limit.use-case.js';

@Injectable()
export class PlanLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject('CheckPlanLimitUseCase') private readonly checkPlanLimit: CheckPlanLimitUseCase,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const resource = this.reflector.getAllAndOverride<string>(PLAN_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!resource) return true;

    const request = context.switchToHttp().getRequest();
    const agent = request.agent;
    if (!agent) return true;

    const usage = await this.checkPlanLimit.checkResource(agent.tenantId, resource as PlanResource);

    if (!usage.allowed) {
      throw new ForbiddenException(`Plan limit exceeded for ${resource}. Current: ${usage.current}/${usage.limit}. Upgrade your plan to add more.`);
    }

    return true;
  }
}
