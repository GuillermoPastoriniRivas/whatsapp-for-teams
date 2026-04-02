import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { TenantRepository } from '../../domain/repositories/tenant.repository.js';

export const DEMO_RESTRICTED_KEY = 'DEMO_RESTRICTED';

/**
 * Decorator: marks an endpoint as restricted in demo mode.
 */
export function DemoRestricted(): MethodDecorator {
  return (target, key, descriptor) => {
    Reflect.defineMetadata(DEMO_RESTRICTED_KEY, true, descriptor.value!);
    return descriptor;
  };
}

/**
 * Guard: blocks @DemoRestricted() endpoints when the requesting agent
 * belongs to a demo tenant.
 */
@Injectable()
export class DemoGuard implements CanActivate {
  private demoTenantIds = new Set<string>();
  private loaded = false;

  constructor(
    @Inject('TenantRepository') private readonly tenantRepo: TenantRepository,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isRestricted = this.reflector.get<boolean>(DEMO_RESTRICTED_KEY, context.getHandler());
    if (!isRestricted) return true;

    const request = context.switchToHttp().getRequest();
    const agent = request.agent;
    if (!agent?.tenantId) return true;

    // Lazy-load demo tenant IDs once
    if (!this.loaded) {
      await this.loadDemoTenants();
    }

    if (this.demoTenantIds.has(agent.tenantId)) {
      throw new ForbiddenException('No disponible en modo demo');
    }

    return true;
  }

  private async loadDemoTenants() {
    // Check the known demo slug
    const tenant = await this.tenantRepo.findBySlug('demo-asis-chat');
    if (tenant?.isDemo) {
      this.demoTenantIds.add(tenant.id);
    }
    this.loaded = true;
  }
}
