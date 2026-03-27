import { Controller, Get, Post, Req, Res, Query, HttpCode, Inject } from '@nestjs/common';
import type { Request, Response } from 'express';
import { HandleInboundMessageUseCase } from '../../application/use-cases/webhook/handle-inbound-message.use-case.js';
import { HandleStatusUpdateUseCase } from '../../application/use-cases/webhook/handle-status-update.use-case.js';
import { Public } from '../decorators/public.decorator.js';

@Public()
@Controller('webhooks')
export class WebhookController {
  constructor(
    @Inject('HandleInboundMessageUseCase') private readonly handleInbound: HandleInboundMessageUseCase,
    @Inject('HandleStatusUpdateUseCase') private readonly handleStatus: HandleStatusUpdateUseCase,
  ) {}

  // Meta webhook verification
  @Get('whatsapp')
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.challenge') challenge: string,
    @Query('hub.verify_token') verifyToken: string,
    @Res() res: Response,
  ) {
    // TODO: validate verify_token against a configured value
    if (mode === 'subscribe' && challenge) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Forbidden');
  }

  // Receive webhook events from GoHook / Meta
  @Post('whatsapp')
  @HttpCode(200)
  async receive(@Req() req: Request) {
    const body = req.body;

    // TODO: Implement full webhook parsing
    // 1. Parse entry[].changes[].value
    // 2. Detect message type: messages (inbound) vs statuses (delivery updates)
    // 3. For inbound: normalize Meta payload → InboundMessageInput → handleInbound.execute()
    // 4. For status: normalize → StatusUpdateInput → handleStatus.execute()
    //
    // For now, return 200 to acknowledge receipt
    return { status: 'ok' };
  }
}
