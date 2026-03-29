import {
  Controller, Get, Patch, Body, Param, Inject, NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { UpdateContactUseCase } from '../../application/use-cases/contact/update-contact.use-case.js';
import { CurrentAgent } from '../decorators/current-agent.decorator.js';
import type { RequestAgent } from '../decorators/current-agent.decorator.js';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe.js';
import { UpdateContactRequestSchema } from '../request-dtos/update-contact-request.dto.js';
import type { UpdateContactRequestDto } from '../request-dtos/update-contact-request.dto.js';
import type { ContactRepository } from '../../domain/repositories/contact.repository.js';

@ApiTags('Contacts')
@ApiBearerAuth('JWT')
@Controller('contacts')
export class ContactController {
  constructor(
    @Inject('UpdateContactUseCase') private readonly updateContact: UpdateContactUseCase,
    @Inject('ContactRepository') private readonly contactRepo: ContactRepository,
  ) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get contact', description: 'Get contact details by ID' })
  @ApiParam({ name: 'id', description: 'Contact ID' })
  @ApiResponse({ status: 200, description: 'Contact details', schema: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      tenantId: { type: 'string' },
      waId: { type: 'string' },
      name: { type: 'string' },
      phone: { type: 'string' },
      profilePicUrl: { type: 'string', nullable: true },
      email: { type: 'string', nullable: true },
      company: { type: 'string', nullable: true },
      notes: { type: 'string', nullable: true },
      customFields: { type: 'object', additionalProperties: { type: 'string' } },
      lastSeenAt: { type: 'string', format: 'date-time' },
      createdAt: { type: 'string', format: 'date-time' },
    },
  }})
  @ApiResponse({ status: 404, description: 'Contact not found' })
  async detail(@Param('id') id: string, @CurrentAgent() agent: RequestAgent) {
    const contact = await this.contactRepo.findById(id);
    if (!contact || contact.tenantId !== agent.tenantId) {
      throw new NotFoundException('Contact not found');
    }
    return contact;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update contact', description: 'Update contact information (email, company, notes, custom fields)' })
  @ApiParam({ name: 'id', description: 'Contact ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', format: 'email', nullable: true },
        company: { type: 'string', maxLength: 200, nullable: true },
        notes: { type: 'string', maxLength: 2000, nullable: true },
        customFields: { type: 'object', additionalProperties: { type: 'string' } },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Contact updated' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateContactRequestSchema)) body: UpdateContactRequestDto,
    @CurrentAgent() agent: RequestAgent,
  ) {
    const result = await this.updateContact.execute({
      contactId: id,
      tenantId: agent.tenantId,
      ...body,
    });
    if (!result.ok) throw new NotFoundException(result.error.message);
    return result.value;
  }
}
