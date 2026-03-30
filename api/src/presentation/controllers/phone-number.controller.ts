import { Controller, Get, Post, Patch, Body, Param, Inject, UsePipes, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { RegisterPhoneNumberUseCase } from '../../application/use-cases/phone-number/register-phone-number.use-case.js';
import { ListPhoneNumbersUseCase } from '../../application/use-cases/phone-number/list-phone-numbers.use-case.js';
import { UpdatePhoneNumberUseCase } from '../../application/use-cases/phone-number/update-phone-number.use-case.js';
import { Roles } from '../decorators/roles.decorator.js';
import { CurrentAgent } from '../decorators/current-agent.decorator.js';
import type { RequestAgent } from '../decorators/current-agent.decorator.js';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe.js';
import { RegisterPhoneNumberRequestSchema } from '../request-dtos/register-phone-number-request.dto.js';
import type { RegisterPhoneNumberRequestDto } from '../request-dtos/register-phone-number-request.dto.js';
import { UpdatePhoneNumberRequestSchema } from '../request-dtos/update-phone-number-request.dto.js';
import type { UpdatePhoneNumberRequestDto } from '../request-dtos/update-phone-number-request.dto.js';

@ApiTags('Phone Numbers')
@ApiBearerAuth('JWT')
@Controller('phone-numbers')
export class PhoneNumberController {
  constructor(
    @Inject('RegisterPhoneNumberUseCase') private readonly registerPhone: RegisterPhoneNumberUseCase,
    @Inject('ListPhoneNumbersUseCase') private readonly listPhones: ListPhoneNumbersUseCase,
    @Inject('UpdatePhoneNumberUseCase') private readonly updatePhone: UpdatePhoneNumberUseCase,
  ) {}

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Register phone number', description: 'Register a new WhatsApp phone number for the tenant (admin only)' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['provider', 'providerConfig', 'wabaId', 'phoneNumberId', 'displayPhone', 'label', 'webhookSecret'],
      properties: {
        provider: { type: 'string', enum: ['meta', 'twilio', '360dialog'], example: 'twilio' },
        providerConfig: { type: 'object', additionalProperties: { type: 'string' }, example: { accountSid: 'AC...', authToken: '...' } },
        wabaId: { type: 'string', example: 'waba_123' },
        phoneNumberId: { type: 'string', example: 'pn_456' },
        displayPhone: { type: 'string', example: '+1234567890' },
        label: { type: 'string', example: 'Sales Line' },
        webhookSecret: { type: 'string', example: 'whsec_abc123' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Phone number registered' })
  @ApiResponse({ status: 403, description: 'Admin role required' })
  async register(@Body(new ZodValidationPipe(RegisterPhoneNumberRequestSchema)) body: RegisterPhoneNumberRequestDto, @CurrentAgent() agent: RequestAgent) {
    const result = await this.registerPhone.execute({ ...body, tenantId: agent.tenantId });
    if (!result.ok) throw new NotFoundException('Registration failed');
    return result.value;
  }

  @Get()
  @ApiOperation({ summary: 'List phone numbers', description: 'List all phone numbers registered for the tenant' })
  @ApiResponse({ status: 200, description: 'List of phone numbers' })
  async list(@CurrentAgent() agent: RequestAgent) {
    return this.listPhones.execute(agent.tenantId);
  }

  @Patch(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Update phone number', description: 'Update phone number details (admin only)' })
  @ApiParam({ name: 'id', description: 'Phone number ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        label: { type: 'string', example: 'Support Line' },
        status: { type: 'string', enum: ['active', 'inactive'] },
        webhookSecret: { type: 'string' },
        providerConfig: { type: 'object', additionalProperties: { type: 'string' }, example: { accessToken: 'EAA...' } },
        wabaId: { type: 'string', example: 'waba_123' },
        phoneNumberId: { type: 'string', example: '1030090320194248' },
        displayPhone: { type: 'string', example: '+15551511323' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Phone number updated' })
  @ApiResponse({ status: 404, description: 'Phone number not found' })
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdatePhoneNumberRequestSchema)) body: UpdatePhoneNumberRequestDto,
    @CurrentAgent() agent: RequestAgent,
  ) {
    const result = await this.updatePhone.execute({ ...body, id, tenantId: agent.tenantId });
    if (!result.ok) throw new NotFoundException(result.error.message);
    return result.value;
  }
}
