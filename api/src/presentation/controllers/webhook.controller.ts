import { Controller, Get, Post, Req, Res, Body, Query, HttpCode, Inject, Logger, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse, ApiExcludeEndpoint } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from '../decorators/public.decorator.js';
import { WebhookSignatureGuard } from '../guards/webhook-signature.guard.js';
import { parseMetaWebhook, mapMetaMessageToInbound, mapMetaStatusToUpdate } from '../webhooks/meta-webhook.parser.js';
import type { MetaWebhookPayload } from '../webhooks/meta-webhook.types.js';
import type { PhoneNumber } from '../../domain/entities/phone-number.entity.js';
import type { JobQueuePort } from '../../application/ports/job-queue.port.js';
import { INBOUND_MESSAGE_JOB, STATUS_UPDATE_JOB } from '../../infrastructure/queue/webhook-job.processor.js';

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
    const apiVersion = this.configService.get<string>('meta.apiVersion', 'v21.0');

    const { messages, statuses } = parseMetaWebhook(body);

    // Enqueue inbound messages
    for (const parsed of messages) {
      const input = mapMetaMessageToInbound(parsed, phoneNumber.phoneNumberId, apiVersion);
      if (!input) {
        this.logger.warn(`Unsupported Meta message type: ${parsed.message.type} (id=${parsed.message.id})`);
        continue;
      }
      await this.queue.enqueue(INBOUND_MESSAGE_JOB, input);
    }

    // Enqueue status updates
    for (const status of statuses) {
      await this.queue.enqueue(STATUS_UPDATE_JOB, mapMetaStatusToUpdate(status));
    }

    return { status: 'ok' };
  }

  // ── Twilio ────────────────────────────────────────────

  @Post('twilio')
  @HttpCode(200)
  @ApiOperation({ summary: 'Receive webhook (Twilio)', description: 'Twilio WhatsApp inbound webhook receiver for messages and status callbacks' })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  async receiveTwilio(@Body() body: Record<string, string>) {
    this.logger.log(`Twilio webhook: ${body.MessageSid} from ${body.From}`);

    const smsStatus = body.SmsStatus;

    // Status callback (sent, delivered, read, etc.)
    if (smsStatus && smsStatus !== 'received') {
      await this.queue.enqueue(STATUS_UPDATE_JOB, {
        waMessageId: body.MessageSid,
        status: this.mapTwilioStatus(smsStatus),
        timestamp: new Date(),
      });
      return { status: 'ok' };
    }

    // Inbound message
    const toNumber = body.To?.replace('whatsapp:', '');
    const fromNumber = body.WaId || body.From?.replace('whatsapp:+', '');

    await this.queue.enqueue(INBOUND_MESSAGE_JOB, {
      phoneNumberId: toNumber,
      waMessageId: body.MessageSid,
      from: fromNumber,
      contactName: body.ProfileName || fromNumber,
      messageType: this.mapTwilioMessageType(body),
      body: body.Body || undefined,
      mediaUrl: body.MediaUrl0 || undefined,
      mimeType: body.MediaContentType0 || undefined,
      timestamp: new Date(),
    });

    return { status: 'ok' };
  }

  private mapTwilioStatus(status: string): string {
    const map: Record<string, string> = {
      queued: 'sent',
      sent: 'sent',
      delivered: 'delivered',
      read: 'read',
      failed: 'failed',
      undelivered: 'failed',
    };
    return map[status] ?? 'sent';
  }

  private mapTwilioMessageType(body: Record<string, string>): string {
    const numMedia = parseInt(body.NumMedia || '0', 10);
    if (numMedia > 0) {
      const contentType = body.MediaContentType0 || '';
      if (contentType.startsWith('image/')) return 'image';
      if (contentType.startsWith('audio/')) return 'audio';
      if (contentType.startsWith('video/')) return 'video';
      return 'document';
    }
    return 'text';
  }
}
