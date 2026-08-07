import { Controller, Get, Patch, Body, Inject, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import {
  GetAccountProfileUseCase,
  UpdateAccountProfileUseCase,
} from '../../application/use-cases/tenant/account-profile.use-cases.js';
import { CurrentAgent } from '../decorators/current-agent.decorator.js';
import type { RequestAgent } from '../decorators/current-agent.decorator.js';
import { Roles } from '../decorators/roles.decorator.js';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe.js';
import { UpdateAccountProfileRequestSchema } from '../request-dtos/account-profile-request.dto.js';
import type { UpdateAccountProfileRequestDto } from '../request-dtos/account-profile-request.dto.js';

/**
 * Los datos del negocio que alimentan a los nodos de IA de las automatizaciones.
 * No confundir con /phone-numbers/:id/business-profile, que es el perfil de
 * WhatsApp que ve el cliente.
 */
@ApiTags('Account')
@ApiBearerAuth('JWT')
@Controller('account/profile')
export class AccountProfileController {
  constructor(
    @Inject('GetAccountProfileUseCase') private readonly getProfile: GetAccountProfileUseCase,
    @Inject('UpdateAccountProfileUseCase') private readonly updateProfile: UpdateAccountProfileUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: "The business data the account's AI nodes use to build their prompt" })
  @ApiResponse({ status: 200, description: 'Account business profile' })
  async get(@CurrentAgent() agent: RequestAgent) {
    const result = await this.getProfile.execute(agent.tenantId);
    if (!result.ok) throw new NotFoundException(result.error.message);
    return result.value;
  }

  @Patch()
  @Roles('admin')
  @ApiOperation({ summary: 'Update the business profile used by every AI node' })
  @ApiResponse({ status: 200, description: 'Updated' })
  async update(
    @Body(new ZodValidationPipe(UpdateAccountProfileRequestSchema)) body: UpdateAccountProfileRequestDto,
    @CurrentAgent() agent: RequestAgent,
  ) {
    const result = await this.updateProfile.execute({ tenantId: agent.tenantId, ...body });
    if (!result.ok) throw new NotFoundException(result.error.message);
    return result.value;
  }
}
