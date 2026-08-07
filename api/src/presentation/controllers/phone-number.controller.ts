import {
  Controller, Get, Post, Patch, Body, Param, Inject, UsePipes, UseGuards,
  NotFoundException, BadRequestException, UnprocessableEntityException,
  UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBody, ApiResponse, ApiParam, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { RegisterPhoneNumberUseCase } from '../../application/use-cases/phone-number/register-phone-number.use-case.js';
import { ListPhoneNumbersUseCase } from '../../application/use-cases/phone-number/list-phone-numbers.use-case.js';
import { UpdatePhoneNumberUseCase } from '../../application/use-cases/phone-number/update-phone-number.use-case.js';
import { Roles } from '../decorators/roles.decorator.js';
import { DemoRestricted } from '../guards/demo.guard.js';
import { CurrentAgent } from '../decorators/current-agent.decorator.js';
import type { RequestAgent } from '../decorators/current-agent.decorator.js';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe.js';
import { RegisterPhoneNumberRequestSchema } from '../request-dtos/register-phone-number-request.dto.js';
import type { RegisterPhoneNumberRequestDto } from '../request-dtos/register-phone-number-request.dto.js';
import { UpdatePhoneNumberRequestSchema } from '../request-dtos/update-phone-number-request.dto.js';
import type { UpdatePhoneNumberRequestDto } from '../request-dtos/update-phone-number-request.dto.js';
import { RequirePlanLimit } from '../decorators/require-plan-limit.decorator.js';
import { PlanLimitGuard } from '../guards/plan-limit.guard.js';
import { GetBusinessProfileUseCase } from '../../application/use-cases/phone-number/get-business-profile.use-case.js';
import { UpdateBusinessProfileUseCase } from '../../application/use-cases/phone-number/update-business-profile.use-case.js';
import { UpdateProfilePictureUseCase } from '../../application/use-cases/phone-number/update-profile-picture.use-case.js';
import { UpdateBusinessProfileRequestSchema } from '../request-dtos/update-business-profile-request.dto.js';
import type { UpdateBusinessProfileRequestDto } from '../request-dtos/update-business-profile-request.dto.js';
import type { DomainError } from '../../domain/errors/domain-errors.js';

/** Tope de Meta para la foto de perfil. */
const MAX_PICTURE_BYTES = 5 * 1024 * 1024;

@ApiTags('Phone Numbers')
@ApiBearerAuth('JWT')
@Controller('phone-numbers')
export class PhoneNumberController {
  constructor(
    @Inject('RegisterPhoneNumberUseCase') private readonly registerPhone: RegisterPhoneNumberUseCase,
    @Inject('ListPhoneNumbersUseCase') private readonly listPhones: ListPhoneNumbersUseCase,
    @Inject('UpdatePhoneNumberUseCase') private readonly updatePhone: UpdatePhoneNumberUseCase,
    @Inject('GetBusinessProfileUseCase') private readonly getProfile: GetBusinessProfileUseCase,
    @Inject('UpdateBusinessProfileUseCase') private readonly updateProfile: UpdateBusinessProfileUseCase,
    @Inject('UpdateProfilePictureUseCase') private readonly updatePicture: UpdateProfilePictureUseCase,
  ) {}

  @Post()
  @Roles('admin')
  @DemoRestricted()
  @UseGuards(PlanLimitGuard)
  @RequirePlanLimit('phone_numbers')
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
        portfolioId: {
          type: 'string',
          nullable: true,
          example: 'portfolio_789',
          description: 'Business portfolio that scopes BSUIDs. Defaults to wabaId when empty.',
        },
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
  @DemoRestricted()
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
        portfolioId: {
          type: 'string',
          nullable: true,
          example: 'portfolio_789',
          description: 'Business portfolio that scopes BSUIDs. Empty clears it and falls back to wabaId.',
        },
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

  // ── Perfil de negocio ─────────────────────────────────────
  // Es lo que ve el cliente al tocar el nombre del contacto en su teléfono. El
  // dato vive en el proveedor; acá se lee y se escribe contra él.
  //
  // Sin @DemoRestricted a propósito: con el proveedor demo todo se resuelve
  // dentro del tenant, sin llamadas afuera, así que el visitante puede probarlo.

  @Get(':id/profile')
  @Roles('admin')
  @ApiOperation({
    summary: 'Get WhatsApp business profile',
    description: 'Reads the profile from the provider and refreshes the local copy (admin only)',
  })
  @ApiParam({ name: 'id', description: 'Phone number ID' })
  @ApiResponse({ status: 200, description: 'Business profile' })
  async profile(@Param('id') id: string, @CurrentAgent() agent: RequestAgent) {
    const result = await this.getProfile.execute(agent.tenantId, id);
    if (!result.ok) this.throwMapped(result.error);
    return result.value;
  }

  @Patch(':id/profile')
  @Roles('admin')
  @ApiOperation({
    summary: 'Update WhatsApp business profile',
    description: 'Writes the profile to the provider. Omitted fields are left untouched; empty strings clear them.',
  })
  @ApiParam({ name: 'id', description: 'Phone number ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        about: { type: 'string', maxLength: 139, example: 'Ropa urbana · Envíos a todo el país' },
        address: { type: 'string', maxLength: 256, example: 'Av. Santa Fe 1234, CABA' },
        description: { type: 'string', maxLength: 512 },
        email: { type: 'string', maxLength: 128, example: 'hola@demostore.com.ar' },
        vertical: { type: 'string', example: 'RETAIL' },
        websites: { type: 'array', maxItems: 2, items: { type: 'string' }, example: ['https://demostore.com.ar'] },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Updated business profile' })
  async saveProfile(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateBusinessProfileRequestSchema)) body: UpdateBusinessProfileRequestDto,
    @CurrentAgent() agent: RequestAgent,
  ) {
    const result = await this.updateProfile.execute({ ...body, tenantId: agent.tenantId, phoneId: id });
    if (!result.ok) this.throwMapped(result.error);
    return result.value;
  }

  @Post(':id/profile/picture')
  @Roles('admin')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_PICTURE_BYTES } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Update WhatsApp profile picture',
    description: 'Uploads the image to the provider and sets it as the profile picture. JPG or PNG, up to 5 MB.',
  })
  @ApiParam({ name: 'id', description: 'Phone number ID' })
  @ApiResponse({ status: 200, description: 'Updated business profile' })
  async savePicture(
    @Param('id') id: string,
    @UploadedFile() file: { buffer: Buffer; mimetype?: string } | undefined,
    @CurrentAgent() agent: RequestAgent,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException("Falta la imagen (campo multipart 'file').");
    }

    const result = await this.updatePicture.execute({
      tenantId: agent.tenantId,
      phoneId: id,
      file: file.buffer,
      mimeType: file.mimetype ?? '',
    });
    if (!result.ok) this.throwMapped(result.error);
    return result.value;
  }

  private throwMapped(error: DomainError): never {
    switch (error.code) {
      case 'PHONE_NUMBER_NOT_FOUND':
      case 'CROSS_TENANT_ACCESS':
        throw new NotFoundException(error.message);
      case 'PROVIDER_FEATURE_NOT_SUPPORTED':
      case 'INVALID_BUSINESS_PROFILE':
        throw new BadRequestException(error.message);
      case 'BUSINESS_PROFILE_PROVIDER_ERROR':
        // 422: la petición está bien formada; el que dijo que no fue el proveedor.
        throw new UnprocessableEntityException(error.message);
      default:
        throw new BadRequestException(error.message);
    }
  }
}
