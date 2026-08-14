import { Controller, Get, Post, Delete, Body, Param, Inject, HttpException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { z } from 'zod';
import {
  CreateEvaluationCaseUseCase,
  ListEvaluationCasesUseCase,
  DeleteEvaluationCaseUseCase,
  RunEvaluationUseCase,
  GetLastEvaluationRunUseCase,
} from '../../application/use-cases/evaluation/evaluation.use-cases.js';
import { CurrentAgent } from '../decorators/current-agent.decorator.js';
import type { RequestAgent } from '../decorators/current-agent.decorator.js';
import { Roles } from '../decorators/roles.decorator.js';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe.js';
import { DomainError } from '../../domain/errors/domain-errors.js';

export const CreateEvaluationCaseSchema = z.object({
  question: z.string().min(1).max(1000),
  expectation: z.string().max(2000).default(''),
  expectHandoff: z.boolean().default(false),
});
type CreateEvaluationCaseDto = z.infer<typeof CreateEvaluationCaseSchema>;

const EVALUATION_ERROR_STATUS: Record<string, number> = {
  EVALUATION_QUESTION_REQUIRED: 422,
  EVALUATION_LIMIT_REACHED: 409,
  EVALUATION_CASE_NOT_FOUND: 404,
  EVALUATION_NO_CASES: 422,
  TENANT_NOT_FOUND: 404,
};

@ApiTags('Evaluation')
@ApiBearerAuth('JWT')
@Controller('evaluation')
export class EvaluationController {
  constructor(
    @Inject('CreateEvaluationCaseUseCase') private readonly createCase: CreateEvaluationCaseUseCase,
    @Inject('ListEvaluationCasesUseCase') private readonly listCases: ListEvaluationCasesUseCase,
    @Inject('DeleteEvaluationCaseUseCase') private readonly deleteCase: DeleteEvaluationCaseUseCase,
    @Inject('RunEvaluationUseCase') private readonly runEvaluation: RunEvaluationUseCase,
    @Inject('GetLastEvaluationRunUseCase') private readonly lastRun: GetLastEvaluationRunUseCase,
  ) {}

  private fail(error: DomainError): never {
    throw new HttpException({ code: error.code, message: error.message }, EVALUATION_ERROR_STATUS[error.code] ?? 400);
  }

  @Get('cases')
  @ApiOperation({ summary: 'The questions your assistant is tested against' })
  cases(@CurrentAgent() agent: RequestAgent) {
    return this.listCases.execute(agent.tenantId);
  }

  @Post('cases')
  @Roles('admin')
  @ApiOperation({ summary: 'Add a question to the test set' })
  async create(
    @Body(new ZodValidationPipe(CreateEvaluationCaseSchema)) body: CreateEvaluationCaseDto,
    @CurrentAgent() agent: RequestAgent,
  ) {
    const result = await this.createCase.execute({ tenantId: agent.tenantId, ...body });
    if (!result.ok) this.fail(result.error);
    return result.value;
  }

  @Delete('cases/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Remove a question from the test set' })
  async remove(@Param('id') id: string, @CurrentAgent() agent: RequestAgent) {
    const result = await this.deleteCase.execute(agent.tenantId, id);
    if (!result.ok) this.fail(result.error);
    return { deleted: true };
  }

  @Get('runs/last')
  @ApiOperation({ summary: 'The most recent score' })
  last(@CurrentAgent() agent: RequestAgent) {
    return this.lastRun.execute(agent.tenantId);
  }

  @Post('runs')
  @Roles('admin')
  @ApiOperation({
    summary: 'Run the assistant against every question and score it',
    description: 'Nothing is sent to any customer: the assistant answers in isolation and a second model judges it.',
  })
  async run(@CurrentAgent() agent: RequestAgent) {
    const result = await this.runEvaluation.execute(agent.tenantId);
    if (!result.ok) this.fail(result.error);
    return result.value;
  }
}
