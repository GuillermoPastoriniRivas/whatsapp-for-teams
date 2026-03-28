import {
  Controller, Get, Patch, Body, Param, Inject, NotFoundException,
} from '@nestjs/common';
import { UpdateContactUseCase } from '../../application/use-cases/contact/update-contact.use-case.js';
import { CurrentAgent } from '../decorators/current-agent.decorator.js';
import type { RequestAgent } from '../decorators/current-agent.decorator.js';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe.js';
import { UpdateContactRequestSchema } from '../request-dtos/update-contact-request.dto.js';
import type { UpdateContactRequestDto } from '../request-dtos/update-contact-request.dto.js';
import type { ContactRepository } from '../../domain/repositories/contact.repository.js';

@Controller('contacts')
export class ContactController {
  constructor(
    @Inject('UpdateContactUseCase') private readonly updateContact: UpdateContactUseCase,
    @Inject('ContactRepository') private readonly contactRepo: ContactRepository,
  ) {}

  @Get(':id')
  async detail(@Param('id') id: string, @CurrentAgent() agent: RequestAgent) {
    const contact = await this.contactRepo.findById(id);
    if (!contact || contact.tenantId !== agent.tenantId) {
      throw new NotFoundException('Contact not found');
    }
    return contact;
  }

  @Patch(':id')
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
