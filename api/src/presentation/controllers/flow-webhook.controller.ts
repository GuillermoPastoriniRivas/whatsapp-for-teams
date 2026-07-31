import {
  Controller, Post, Body, Param, Inject,
  NotFoundException, BadRequestException, ConflictException, HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../decorators/public.decorator.js';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe.js';
import { FlowWebhookBodySchema } from '../request-dtos/flow-request.dto.js';
import type { FlowWebhookBodyDto } from '../request-dtos/flow-request.dto.js';
import { StartFlowFromWebhookUseCase } from '../../application/use-cases/flow/start-flow-from-webhook.use-case.js';

/**
 * Trigger externo de flujos: la puerta "cualquier sistema → asis.chat".
 * Autenticación por token en la URL (32 bytes, comparación constante);
 * 404 en cualquier falla de autenticación para no revelar existencia.
 */
@ApiTags('Flows')
@Controller('hooks/flows')
export class FlowWebhookController {
  constructor(
    @Inject('StartFlowFromWebhookUseCase') private readonly startFromWebhook: StartFlowFromWebhookUseCase,
  ) {}

  @Public()
  @Post(':flowId/:token')
  @HttpCode(202)
  @ApiOperation({ summary: 'Start a flow from an external system (CRM, store, form)' })
  async trigger(
    @Param('flowId') flowId: string,
    @Param('token') token: string,
    @Body(new ZodValidationPipe(FlowWebhookBodySchema)) body: FlowWebhookBodyDto,
  ) {
    const result = await this.startFromWebhook.execute(flowId, token, body);
    switch (result.outcome) {
      case 'started':
        return { executionId: result.executionId };
      case 'busy':
        throw new ConflictException({ error: 'conversation_busy' });
      case 'bad_request':
        throw new BadRequestException(result.message);
      case 'not_found':
      default:
        throw new NotFoundException();
    }
  }
}
