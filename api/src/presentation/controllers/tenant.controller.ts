import { Controller, Get, Post, Body, Param, Inject, UsePipes, NotFoundException } from '@nestjs/common';
import { CreateTenantUseCase } from '../../application/use-cases/tenant/create-tenant.use-case.js';
import { GetTenantUseCase } from '../../application/use-cases/tenant/get-tenant.use-case.js';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe.js';
import { CreateTenantRequestSchema } from '../request-dtos/create-tenant-request.dto.js';
import type { CreateTenantRequestDto } from '../request-dtos/create-tenant-request.dto.js';
import { Public } from '../decorators/public.decorator.js';

// TODO: These endpoints should be superadmin-only (separate auth)
// For the demo, they are open
@Public()
@Controller('tenants')
export class TenantController {
  constructor(
    @Inject('CreateTenantUseCase') private readonly createTenant: CreateTenantUseCase,
    @Inject('GetTenantUseCase') private readonly getTenant: GetTenantUseCase,
  ) {}

  @Post()
  @UsePipes(new ZodValidationPipe(CreateTenantRequestSchema))
  async create(@Body() body: CreateTenantRequestDto) {
    const result = await this.createTenant.execute(body);
    if (!result.ok) throw new NotFoundException('Creation failed');
    return result.value;
  }

  @Get(':tenantId')
  async get(@Param('tenantId') tenantId: string) {
    const result = await this.getTenant.execute(tenantId);
    if (!result.ok) throw new NotFoundException(result.error.message);
    return result.value;
  }
}
