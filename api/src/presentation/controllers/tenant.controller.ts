import { Controller, Get, Post, Body, Param, Inject, UsePipes, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse, ApiParam } from '@nestjs/swagger';
import { CreateTenantUseCase } from '../../application/use-cases/tenant/create-tenant.use-case.js';
import { GetTenantUseCase } from '../../application/use-cases/tenant/get-tenant.use-case.js';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe.js';
import { CreateTenantRequestSchema } from '../request-dtos/create-tenant-request.dto.js';
import type { CreateTenantRequestDto } from '../request-dtos/create-tenant-request.dto.js';
import { Public } from '../decorators/public.decorator.js';

// TODO: These endpoints should be superadmin-only (separate auth)
// For the demo, they are open
@Public()
@ApiTags('Tenants')
@Controller('tenants')
export class TenantController {
  constructor(
    @Inject('CreateTenantUseCase') private readonly createTenant: CreateTenantUseCase,
    @Inject('GetTenantUseCase') private readonly getTenant: GetTenantUseCase,
  ) {}

  @Post()
  @UsePipes(new ZodValidationPipe(CreateTenantRequestSchema))
  @ApiOperation({ summary: 'Create tenant', description: 'Create a new tenant organization' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name', 'slug'],
      properties: {
        name: { type: 'string', example: 'Acme Corp' },
        slug: { type: 'string', pattern: '^[a-z0-9-]+$', example: 'acme-corp' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Tenant created' })
  async create(@Body() body: CreateTenantRequestDto) {
    const result = await this.createTenant.execute(body);
    if (!result.ok) throw new NotFoundException('Creation failed');
    return result.value;
  }

  @Get(':tenantId')
  @ApiOperation({ summary: 'Get tenant', description: 'Get tenant details by ID' })
  @ApiParam({ name: 'tenantId', description: 'Tenant ID' })
  @ApiResponse({ status: 200, description: 'Tenant details' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  async get(@Param('tenantId') tenantId: string) {
    const result = await this.getTenant.execute(tenantId);
    if (!result.ok) throw new NotFoundException(result.error.message);
    return result.value;
  }
}
