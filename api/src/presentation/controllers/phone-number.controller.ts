import { Controller, Get, Post, Patch, Body, Param, Inject, UsePipes, NotFoundException } from '@nestjs/common';
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

@Controller('phone-numbers')
export class PhoneNumberController {
  constructor(
    @Inject('RegisterPhoneNumberUseCase') private readonly registerPhone: RegisterPhoneNumberUseCase,
    @Inject('ListPhoneNumbersUseCase') private readonly listPhones: ListPhoneNumbersUseCase,
    @Inject('UpdatePhoneNumberUseCase') private readonly updatePhone: UpdatePhoneNumberUseCase,
  ) {}

  @Post()
  @Roles('admin')
  async register(@Body(new ZodValidationPipe(RegisterPhoneNumberRequestSchema)) body: RegisterPhoneNumberRequestDto, @CurrentAgent() agent: RequestAgent) {
    const result = await this.registerPhone.execute({ ...body, tenantId: agent.tenantId });
    if (!result.ok) throw new NotFoundException('Registration failed');
    return result.value;
  }

  @Get()
  async list(@CurrentAgent() agent: RequestAgent) {
    return this.listPhones.execute(agent.tenantId);
  }

  @Patch(':id')
  @Roles('admin')
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
