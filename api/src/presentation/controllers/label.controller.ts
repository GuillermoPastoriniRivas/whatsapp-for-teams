import {
  Controller, Get, Post, Patch, Delete, Body, Param,
  Inject, NotFoundException, ConflictException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CreateLabelUseCase } from '../../application/use-cases/label/create-label.use-case.js';
import { ListLabelsUseCase } from '../../application/use-cases/label/list-labels.use-case.js';
import { UpdateLabelUseCase } from '../../application/use-cases/label/update-label.use-case.js';
import { DeleteLabelUseCase } from '../../application/use-cases/label/delete-label.use-case.js';
import { Roles } from '../decorators/roles.decorator.js';
import { CurrentAgent } from '../decorators/current-agent.decorator.js';
import type { RequestAgent } from '../decorators/current-agent.decorator.js';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe.js';
import { CreateLabelRequestSchema } from '../request-dtos/create-label-request.dto.js';
import type { CreateLabelRequestDto } from '../request-dtos/create-label-request.dto.js';
import { UpdateLabelRequestSchema } from '../request-dtos/update-label-request.dto.js';
import type { UpdateLabelRequestDto } from '../request-dtos/update-label-request.dto.js';

@ApiTags('Labels')
@ApiBearerAuth('JWT')
@Controller('labels')
export class LabelController {
  constructor(
    @Inject('CreateLabelUseCase') private readonly createLabel: CreateLabelUseCase,
    @Inject('ListLabelsUseCase') private readonly listLabels: ListLabelsUseCase,
    @Inject('UpdateLabelUseCase') private readonly updateLabel: UpdateLabelUseCase,
    @Inject('DeleteLabelUseCase') private readonly deleteLabel: DeleteLabelUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List labels', description: 'List all labels for the current tenant' })
  async list(@CurrentAgent() agent: RequestAgent) {
    return this.listLabels.execute(agent.tenantId);
  }

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Create label', description: 'Create a new label (admin only)' })
  async create(
    @Body(new ZodValidationPipe(CreateLabelRequestSchema)) body: CreateLabelRequestDto,
    @CurrentAgent() agent: RequestAgent,
  ) {
    const result = await this.createLabel.execute({
      tenantId: agent.tenantId,
      name: body.name,
      color: body.color,
    });
    if (!result.ok) throw new ConflictException(result.error.message);
    return result.value;
  }

  @Patch(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Update label', description: 'Update a label name or color (admin only)' })
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateLabelRequestSchema)) body: UpdateLabelRequestDto,
    @CurrentAgent() agent: RequestAgent,
  ) {
    const result = await this.updateLabel.execute({
      labelId: id,
      tenantId: agent.tenantId,
      ...body,
    });
    if (!result.ok) {
      if (result.error.code === 'DUPLICATE_LABEL_NAME') throw new ConflictException(result.error.message);
      throw new NotFoundException(result.error.message);
    }
    return result.value;
  }

  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Delete label', description: 'Delete a label and remove it from all conversations (admin only)' })
  async remove(@Param('id') id: string, @CurrentAgent() agent: RequestAgent) {
    const result = await this.deleteLabel.execute(id, agent.tenantId);
    if (!result.ok) throw new NotFoundException(result.error.message);
    return { deleted: true };
  }
}
