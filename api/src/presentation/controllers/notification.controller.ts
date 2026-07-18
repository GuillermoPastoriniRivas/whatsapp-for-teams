import { Controller, Get, Post, Body, Inject, Headers, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SubscribePushUseCase } from '../../application/use-cases/notification/subscribe-push.use-case.js';
import { UnsubscribePushUseCase } from '../../application/use-cases/notification/unsubscribe-push.use-case.js';
import type { WebPushPort } from '../../application/ports/web-push.port.js';
import { CurrentAgent } from '../decorators/current-agent.decorator.js';
import type { RequestAgent } from '../decorators/current-agent.decorator.js';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe.js';
import { PushSubscribeRequestSchema, PushUnsubscribeRequestSchema } from '../request-dtos/push-subscribe-request.dto.js';
import type { PushSubscribeRequestDto, PushUnsubscribeRequestDto } from '../request-dtos/push-subscribe-request.dto.js';

@ApiTags('Notifications')
@ApiBearerAuth('JWT')
@Controller('notifications')
export class NotificationController {
  constructor(
    @Inject('SubscribePushUseCase') private readonly subscribePush: SubscribePushUseCase,
    @Inject('UnsubscribePushUseCase') private readonly unsubscribePush: UnsubscribePushUseCase,
    @Inject('WebPushPort') private readonly webPush: WebPushPort,
  ) {}

  @Get('push/public-key')
  @ApiOperation({ summary: 'Get VAPID public key', description: 'Public key the browser needs to create a push subscription' })
  getPublicKey() {
    const publicKey = this.webPush.getPublicKey();
    if (!publicKey) throw new NotFoundException('Push notifications are not configured');
    return { publicKey };
  }

  @Post('push/subscribe')
  @ApiOperation({ summary: 'Subscribe to push', description: 'Register a browser push subscription for the current agent' })
  async subscribe(
    @Body(new ZodValidationPipe(PushSubscribeRequestSchema)) body: PushSubscribeRequestDto,
    @CurrentAgent() agent: RequestAgent,
    @Headers('user-agent') userAgent?: string,
  ) {
    await this.subscribePush.execute({
      tenantId: agent.tenantId,
      agentId: agent._id,
      endpoint: body.endpoint,
      keys: body.keys,
      userAgent: userAgent ?? null,
    });
    return { subscribed: true };
  }

  @Post('push/unsubscribe')
  @ApiOperation({ summary: 'Unsubscribe from push', description: 'Remove a browser push subscription for the current agent' })
  async unsubscribe(
    @Body(new ZodValidationPipe(PushUnsubscribeRequestSchema)) body: PushUnsubscribeRequestDto,
    @CurrentAgent() agent: RequestAgent,
  ) {
    await this.unsubscribePush.execute(agent._id, body.endpoint);
    return { unsubscribed: true };
  }
}
