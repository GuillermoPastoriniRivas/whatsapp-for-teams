import {
  Controller, Post, Req, Inject,
  HttpCode, UnauthorizedException, Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../decorators/public.decorator.js';
import type { PaymentProviderPort } from '../../application/ports/payment-provider.port.js';
import type { HandlePaymentWebhookUseCase } from '../../application/use-cases/billing/handle-payment-webhook.use-case.js';

@ApiTags('Payment Webhooks')
@Controller('billing/webhooks')
export class PaymentWebhookController {
  private readonly logger = new Logger(PaymentWebhookController.name);

  constructor(
    @Inject('HandlePaymentWebhookUseCase') private readonly handleWebhook: HandlePaymentWebhookUseCase,
    @Inject('PaymentProviderPort') private readonly paymentProvider: PaymentProviderPort,
  ) {}

  @Post('lemon-squeezy')
  @Public()
  @HttpCode(200)
  @ApiOperation({ summary: 'Lemon Squeezy webhook', description: 'Receives payment events from Lemon Squeezy. Verified via HMAC-SHA256.' })
  async lemonSqueezyWebhook(@Req() req: Request) {
    const signature = req.headers['x-signature'] as string;
    if (!signature) {
      throw new UnauthorizedException('Missing X-Signature header');
    }

    const rawBody = (req as any).rawBody as Buffer | undefined;
    if (!rawBody) {
      this.logger.error('Raw body not available — ensure NestFactory has rawBody: true');
      throw new UnauthorizedException('Cannot verify signature');
    }

    if (!this.paymentProvider.verifyWebhookSignature(rawBody, signature)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    try {
      const event = this.paymentProvider.parseWebhookEvent(req.body);
      this.logger.log(`Processing Lemon Squeezy event: ${event.type} (subscription: ${event.externalSubscriptionId})`);
      await this.handleWebhook.execute(event);
    } catch (error) {
      // Always return 200 to prevent Lemon Squeezy retries, but log the error
      this.logger.error(`Error processing Lemon Squeezy webhook: ${(error as Error).message}`, (error as Error).stack);
    }

    return { received: true };
  }
}
