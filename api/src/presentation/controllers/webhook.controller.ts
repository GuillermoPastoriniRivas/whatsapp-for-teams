import { Controller, Get, Post, Req, Res, Body, Query, HttpCode, Inject, Logger, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse, ApiExcludeEndpoint } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from '../decorators/public.decorator.js';
import { WebhookSignatureGuard } from '../guards/webhook-signature.guard.js';
import { parseMetaWebhook, mapMetaMessageToInbound, mapMetaStatusToUpdate, mapTemplateEventToInput, mapUserIdUpdateToInput } from '../webhooks/meta-webhook.parser.js';
import type { MetaWebhookPayload } from '../webhooks/meta-webhook.types.js';
import type { PhoneNumber } from '../../domain/entities/phone-number.entity.js';
import type { JobQueuePort } from '../../application/ports/job-queue.port.js';
import { ACCOUNT_EVENT_JOB, INBOUND_MESSAGE_JOB, STATUS_UPDATE_JOB, TEMPLATE_EVENT_JOB, USER_ID_UPDATE_JOB, USER_PREFERENCE_JOB } from '../../infrastructure/queue/webhook-job.processor.js';

@Public()
@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    @Inject('JobQueuePort') private readonly queue: JobQueuePort,
    private readonly configService: ConfigService,
  ) {}

  // ── Meta Cloud API ────────────────────────────────────

  @Get('whatsapp')
  @ApiOperation({ summary: 'Verify webhook (Meta)', description: 'Meta Cloud API webhook verification endpoint (hub.challenge handshake)' })
  @ApiQuery({ name: 'hub.mode', required: true, description: 'Must be "subscribe"' })
  @ApiQuery({ name: 'hub.challenge', required: true, description: 'Challenge string to echo back' })
  @ApiQuery({ name: 'hub.verify_token', required: true, description: 'Verification token' })
  @ApiResponse({ status: 200, description: 'Challenge echoed back' })
  @ApiResponse({ status: 403, description: 'Verification failed' })
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.challenge') challenge: string,
    @Query('hub.verify_token') verifyToken: string,
    @Res() res: Response,
  ) {
    const expectedToken = this.configService.get<string>('meta.webhookVerifyToken');

    if (mode === 'subscribe' && verifyToken === expectedToken && challenge) {
      this.logger.log('Meta webhook verified successfully');
      return res.status(200).send(challenge);
    }

    this.logger.warn(`Meta webhook verification failed (mode=${mode}, tokenMatch=${verifyToken === expectedToken})`);
    return res.status(403).send('Forbidden');
  }

  @Post('whatsapp')
  @HttpCode(200)
  @UseGuards(WebhookSignatureGuard)
  @ApiOperation({ summary: 'Receive webhook (Meta)', description: 'Meta Cloud API inbound webhook receiver for messages and status updates' })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  async receiveWhatsApp(@Req() req: Request, @Body() body: MetaWebhookPayload) {
    const phoneNumber = (req as any).phoneNumber as PhoneNumber;

    const { messages, statuses, templateEvents, userIdUpdates, accountEvents, userPreferences } =
      parseMetaWebhook(body);

    // Enqueue inbound messages
    for (const parsed of messages) {
      const input = mapMetaMessageToInbound(parsed, phoneNumber.phoneNumberId);
      if (!input) {
        // Tipo que no soportamos, o una reacción que el usuario quitó.
        this.logger.warn(`Mensaje entrante ignorado (tipo ${parsed.message.type}, id=${parsed.message.id})`);
        continue;
      }
      await this.queue.enqueue(INBOUND_MESSAGE_JOB, input);
    }

    // Cambios de BSUID (el usuario cambió de número)
    for (const update of userIdUpdates) {
      await this.queue.enqueue(USER_ID_UPDATE_JOB, mapUserIdUpdateToInput(update));
    }

    // Enqueue status updates
    for (const status of statuses) {
      await this.queue.enqueue(STATUS_UPDATE_JOB, mapMetaStatusToUpdate(status));
    }

    // Enqueue WABA-level template events (status/quality/category updates)
    for (const event of templateEvents) {
      await this.queue.enqueue(TEMPLATE_EVENT_JOB, mapTemplateEventToInput(event));
    }

    // Salud de la cuenta y del número: baneos, calidad, throughput, nombre.
    for (const event of accountEvents) {
      await this.queue.enqueue(ACCOUNT_EVENT_JOB, event);
    }

    // Opt-out de marketing: hay que respetarlo antes de la próxima campaña.
    for (const preference of userPreferences) {
      await this.queue.enqueue(USER_PREFERENCE_JOB, preference);
    }

    return { status: 'ok' };
  }

}
