import {
  Controller, Get, Patch, Body, Param, Query, Inject, NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse, ApiParam, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { UpdateContactUseCase } from '../../application/use-cases/contact/update-contact.use-case.js';
import { ListContactsUseCase } from '../../application/use-cases/contact/list-contacts.use-case.js';
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
    @Inject('ListContactsUseCase') private readonly listContacts: ListContactsUseCase,
    @Inject('ContactRepository') private readonly contactRepo: ContactRepository,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List contacts', description: 'List all contacts for the tenant with optional search' })
  @ApiQuery({ name: 'search', required: false, description: 'Search by name, phone, email or company' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20, max: 100)' })
  @ApiResponse({ status: 200, description: 'Paginated list of contacts' })
  async list(
    @CurrentAgent() agent: RequestAgent,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const p = Math.max(1, parseInt(page || '1', 10) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit || '20', 10) || 20));
    return this.listContacts.execute({ tenantId: agent.tenantId, search, page: p, limit: l });
  }

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
