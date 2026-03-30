import { CanActivate, ExecutionContext, Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import type { PhoneNumberRepository } from '../../domain/repositories/phone-number.repository.js';

@Injectable()
export class WebhookSignatureGuard implements CanActivate {
  private readonly logger = new Logger(WebhookSignatureGuard.name);

  constructor(
    @Inject('PhoneNumberRepository') private readonly phoneRepo: PhoneNumberRepository,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // Extract phone_number_id from the parsed body to look up the phone number
    const body = request.body;
    const phoneNumberId = body?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;

    if (!phoneNumberId) {
      this.logger.warn('Cannot determine phone_number_id from webhook payload');
      throw new UnauthorizedException('Cannot determine phone number from payload');
    }

    const phoneNumber = await this.phoneRepo.findByPhoneNumberId(phoneNumberId);
    if (!phoneNumber) {
      this.logger.warn(`Unknown phone_number_id: ${phoneNumberId}`);
      throw new UnauthorizedException('Unknown phone number');
    }

    // Attach phone number to request for the controller regardless of signature check
    (request as any).phoneNumber = phoneNumber;

    // In development (behind proxy like GoHook/ngrok), signature validation can be skipped
    const skipSignature = this.configService.get<string>('SKIP_WEBHOOK_SIGNATURE') === 'true';
    if (skipSignature) {
      this.logger.warn('Webhook signature validation SKIPPED (SKIP_WEBHOOK_SIGNATURE=true)');
      return true;
    }

    // ── Signature validation ─────────────────────────────
    const signature = request.headers['x-hub-signature-256'] as string | undefined;

    if (!signature) {
      this.logger.warn('Missing X-Hub-Signature-256 header');
      throw new UnauthorizedException('Missing X-Hub-Signature-256 header');
    }

    if (!phoneNumber.webhookSecret) {
      this.logger.error(`Phone number ${phoneNumberId} has no webhookSecret (Meta App Secret) configured`);
      throw new UnauthorizedException('Webhook secret not configured for this phone number');
    }

    // rawBody is available because NestFactory.create was called with { rawBody: true }
    const rawBody = (request as any).rawBody as Buffer | undefined;
    if (!rawBody) {
      this.logger.error('Raw body not available — ensure NestFactory has rawBody: true');
      throw new UnauthorizedException('Cannot validate signature');
    }

    const expectedSignature =
      'sha256=' + createHmac('sha256', phoneNumber.webhookSecret).update(rawBody).digest('hex');

    // Timing-safe comparison to prevent timing attacks
    const sigBuffer = Buffer.from(signature, 'utf8');
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

    if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
      this.logger.warn(`Invalid signature for phone ${phoneNumberId} — got: ${signature.substring(0, 20)}... expected: ${expectedSignature.substring(0, 20)}...`);
      throw new UnauthorizedException('Invalid webhook signature');
    }

    return true;
  }
}
