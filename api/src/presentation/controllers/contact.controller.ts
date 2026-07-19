import {
  Controller, Get, Post, Patch, Body, Param, Query, Inject, NotFoundException,
  BadRequestException, UseInterceptors, UploadedFile, HttpCode,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBody, ApiResponse, ApiParam, ApiQuery, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { parse } from 'csv-parse/sync';
import { UpdateContactUseCase } from '../../application/use-cases/contact/update-contact.use-case.js';
import { ListContactsUseCase } from '../../application/use-cases/contact/list-contacts.use-case.js';
import { ImportContactsUseCase } from '../../application/use-cases/contact/import-contacts.use-case.js';
import type { ImportContactRow } from '../../application/use-cases/contact/import-contacts.use-case.js';
import { CurrentAgent } from '../decorators/current-agent.decorator.js';
import type { RequestAgent } from '../decorators/current-agent.decorator.js';
import { Roles } from '../decorators/roles.decorator.js';
import { DemoRestricted } from '../guards/demo.guard.js';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe.js';
import { UpdateContactRequestSchema } from '../request-dtos/update-contact-request.dto.js';
import type { UpdateContactRequestDto } from '../request-dtos/update-contact-request.dto.js';
import { CreateContactRequestSchema } from '../request-dtos/create-contact-request.dto.js';
import type { CreateContactRequestDto } from '../request-dtos/create-contact-request.dto.js';
import { CreateContactUseCase } from '../../application/use-cases/contact/create-contact.use-case.js';
import type { ContactRepository } from '../../domain/repositories/contact.repository.js';

const KNOWN_COLUMNS = new Set(['phone', 'name', 'email', 'company']);
const MAX_CSV_BYTES = 2 * 1024 * 1024;

@ApiTags('Contacts')
@ApiBearerAuth('JWT')
@Controller('contacts')
export class ContactController {
  constructor(
    @Inject('UpdateContactUseCase') private readonly updateContact: UpdateContactUseCase,
    @Inject('ListContactsUseCase') private readonly listContacts: ListContactsUseCase,
    @Inject('ImportContactsUseCase') private readonly importContacts: ImportContactsUseCase,
    @Inject('CreateContactUseCase') private readonly createContact: CreateContactUseCase,
    @Inject('ContactRepository') private readonly contactRepo: ContactRepository,
  ) {}

  @Post()
  @Roles('admin')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Create contact by phone',
    description:
      'Find-or-create a contact from a raw phone number. Returns the existing contact untouched if the number is already saved.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['phone'],
      properties: {
        phone: { type: 'string', description: 'International number; symbols and spaces are ignored' },
        name: { type: 'string', maxLength: 200 },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'The existing or newly created contact' })
  @ApiResponse({ status: 400, description: 'Invalid phone number' })
  async create(
    @Body(new ZodValidationPipe(CreateContactRequestSchema)) body: CreateContactRequestDto,
    @CurrentAgent() agent: RequestAgent,
  ) {
    const result = await this.createContact.execute({ tenantId: agent.tenantId, ...body });
    if (!result.ok) throw new BadRequestException(result.error.message);
    return result.value;
  }

  @Post('import')
  @Roles('admin')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_CSV_BYTES } }))
  @ApiOperation({
    summary: 'Import contacts from CSV',
    description:
      'Bulk-import contacts (admin only). Required column: phone. Optional: name, email, company. Any other column is stored as a custom field. Max 10k rows / 2MB.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 200, description: 'Import summary: { imported, updated, skipped[] }' })
  @ApiResponse({ status: 400, description: 'Missing file, invalid CSV, or missing phone column' })
  async import(@UploadedFile() file: { buffer: Buffer } | undefined, @CurrentAgent() agent: RequestAgent) {
    if (!file?.buffer) throw new BadRequestException("CSV file is required (multipart field 'file')");

    let records: Record<string, string>[];
    try {
      records = parse(file.buffer, {
        columns: (header: string[]) => header.map((h) => h.trim().toLowerCase()),
        skip_empty_lines: true,
        trim: true,
        bom: true,
      });
    } catch (error: any) {
      throw new BadRequestException(`Invalid CSV: ${error.message}`);
    }

    if (records.length === 0) throw new BadRequestException('The CSV file has no data rows');
    if (!('phone' in records[0])) throw new BadRequestException("The CSV must include a 'phone' column");

    const rows: ImportContactRow[] = records.map((record) => {
      const customFields: Record<string, string> = {};
      for (const [key, value] of Object.entries(record)) {
        if (!KNOWN_COLUMNS.has(key) && value) customFields[key] = value;
      }
      return {
        phone: record.phone,
        name: record.name,
        email: record.email,
        company: record.company,
        customFields,
      };
    });

    const result = await this.importContacts.execute({ tenantId: agent.tenantId, rows });
    if (!result.ok) throw new BadRequestException(result.error.message);
    return result.value;
  }

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
