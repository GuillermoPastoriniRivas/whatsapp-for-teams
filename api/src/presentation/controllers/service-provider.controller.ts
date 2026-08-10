import {
  Controller, Get, Post, Patch, Delete, Body, Param, Inject, HttpCode, BadRequestException, NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import {
  CreateServiceProviderUseCase,
  DeleteServiceProviderUseCase,
  ListServiceProvidersUseCase,
  UpdateServiceProviderUseCase,
} from '../../application/use-cases/provider/service-provider.use-cases.js';
import { CurrentAgent } from '../decorators/current-agent.decorator.js';
import type { RequestAgent } from '../decorators/current-agent.decorator.js';
import { Roles } from '../decorators/roles.decorator.js';
import { DemoRestricted } from '../guards/demo.guard.js';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe.js';
import {
  CreateServiceProviderRequestSchema,
  UpdateServiceProviderRequestSchema,
} from '../request-dtos/service-provider-request.dto.js';
import type {
  CreateServiceProviderRequestDto,
  UpdateServiceProviderRequestDto,
} from '../request-dtos/service-provider-request.dto.js';
import { DomainError } from '../../domain/errors/domain-errors.js';
import { ServiceProvider } from '../../domain/entities/service-provider.entity.js';

function serialize(p: ServiceProvider) {
  return {
    id: p.id,
    name: p.name,
    phone: p.phone,
    services: p.services,
    active: p.active,
    optInAt: p.optInAt,
    optInNote: p.optInNote,
    lastAssignedAt: p.lastAssignedAt,
    assignedCount: p.assignedCount,
    notes: p.notes,
    createdAt: p.createdAt,
  };
}

function throwMapped(error: DomainError): never {
  if (error.code === 'PROVIDER_NOT_FOUND') throw new NotFoundException(error.message);
  throw new BadRequestException(error.message);
}

/**
 * Proveedores externos a los que la cuenta les pasa datos de clientes.
 * No son agentes (no atienden en la bandeja) ni contactos (no son clientes).
 */
@ApiTags('Providers')
@ApiBearerAuth('JWT')
@Controller('providers')
export class ServiceProviderController {
  constructor(
    @Inject('ListServiceProvidersUseCase') private readonly list: ListServiceProvidersUseCase,
    @Inject('CreateServiceProviderUseCase') private readonly create: CreateServiceProviderUseCase,
    @Inject('UpdateServiceProviderUseCase') private readonly update: UpdateServiceProviderUseCase,
    @Inject('DeleteServiceProviderUseCase') private readonly remove: DeleteServiceProviderUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List the account service providers' })
  @ApiResponse({ status: 200, description: 'Providers' })
  async getAll(@CurrentAgent() agent: RequestAgent) {
    const providers = await this.list.execute(agent.tenantId);
    return providers.map(serialize);
  }

  @Post()
  @Roles('admin')
  @DemoRestricted()
  @ApiOperation({
    summary: 'Create a provider',
    description: 'Activating a provider requires recording their opt-in: we message them first, so consent is mandatory.',
  })
  @ApiResponse({ status: 201, description: 'Created' })
  @ApiResponse({ status: 400, description: 'Missing opt-in, invalid phone or duplicate' })
  async post(
    @Body(new ZodValidationPipe(CreateServiceProviderRequestSchema)) body: CreateServiceProviderRequestDto,
    @CurrentAgent() agent: RequestAgent,
  ) {
    const result = await this.create.execute({ ...body, tenantId: agent.tenantId });
    if (!result.ok) throwMapped(result.error);
    return serialize(result.value);
  }

  @Patch(':id')
  @Roles('admin')
  @DemoRestricted()
  @ApiOperation({ summary: 'Update a provider' })
  @ApiParam({ name: 'id', description: 'Provider ID' })
  async patch(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateServiceProviderRequestSchema)) body: UpdateServiceProviderRequestDto,
    @CurrentAgent() agent: RequestAgent,
  ) {
    const result = await this.update.execute(agent.tenantId, id, body);
    if (!result.ok) throwMapped(result.error);
    return serialize(result.value);
  }

  @Delete(':id')
  @Roles('admin')
  @DemoRestricted()
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a provider' })
  @ApiParam({ name: 'id', description: 'Provider ID' })
  async del(@Param('id') id: string, @CurrentAgent() agent: RequestAgent) {
    const result = await this.remove.execute(agent.tenantId, id);
    if (!result.ok) throwMapped(result.error);
  }
}
