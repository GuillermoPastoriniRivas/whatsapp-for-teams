import { Controller, Get, Post, Req, Res, Body, Query, HttpCode, Inject, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { HandleInboundMessageUseCase } from '../../application/use-cases/webhook/handle-inbound-message.use-case.js';
import { HandleStatusUpdateUseCase } from '../../application/use-cases/webhook/handle-status-update.use-case.js';
import { Public } from '../decorators/public.decorator.js';

@Public()
@Controller('webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    @Inject('HandleInboundMessageUseCase') private readonly handleInbound: HandleInboundMessageUseCase,
    @Inject('HandleStatusUpdateUseCase') private readonly handleStatus: HandleStatusUpdateUseCase,
  ) {}

  // ── Meta Cloud API ────────────────────────────────────

  @Get('whatsapp')
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.challenge') challenge: string,
    @Query('hub.verify_token') verifyToken: string,
    @Res() res: Response,
  ) {
    if (mode === 'subscribe' && challenge) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Forbidden');
  }

  @Post('whatsapp')
  @HttpCode(200)
  async receiveWhatsApp(@Req() req: Request) {
    // TODO: Parse Meta Cloud API webhook format
    return { status: 'ok' };
  }

  // ── Twilio ────────────────────────────────────────────

  @Post('twilio')
  @HttpCode(200)
  async receiveTwilio(@Body() body: Record<string, string>) {
    this.logger.log(`Twilio webhook: ${body.MessageSid} from ${body.From}`);

    const smsStatus = body.SmsStatus;

    // Status callback (sent, delivered, read, etc.)
    if (smsStatus && smsStatus !== 'received') {
      await this.handleStatus.execute({
        waMessageId: body.MessageSid,
        status: this.mapTwilioStatus(smsStatus),
        timestamp: new Date(),
      });
      return { status: 'ok' };
    }

    // Inbound message
    // Extract the To number without "whatsapp:" prefix to look up our PhoneNumber
    const toNumber = body.To?.replace('whatsapp:', '');
    const fromNumber = body.WaId || body.From?.replace('whatsapp:+', '');

    await this.handleInbound.execute({
      phoneNumberId: toNumber,  // We'll match by displayPhone or phoneNumberId
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
