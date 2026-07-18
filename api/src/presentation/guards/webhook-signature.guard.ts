import { CanActivate, ExecutionContext, Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import type { PhoneNumberRepository } from '../../domain/repositories/phone-number.repository.js';
import type { PhoneNumber } from '../../domain/entities/phone-number.entity.js';

@Injectable()
export class WebhookSignatureGuard implements CanActivate {
  private readonly logger = new Logger(WebhookSignatureGuard.name);

  constructor(
    @Inject('PhoneNumberRepository') private readonly phoneRepo: PhoneNumberRepository,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // Extract phone_number_id from the parsed body to look up the phone number.
    // WABA-level events (e.g. template status updates) carry no metadata.phone_number_id;
    // for those, entry[0].id is the WABA id and any active phone of that WABA
    // shares the Meta App Secret used for signature validation.
    const body = request.body;
    const phoneNumberId = body?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;
    const wabaId = body?.entry?.[0]?.id;

    let phoneNumber: PhoneNumber | null = null;
    if (phoneNumberId) {
      phoneNumber = await this.phoneRepo.findByPhoneNumberId(phoneNumberId);
    } else if (wabaId) {
      phoneNumber = await this.phoneRepo.findByWabaId(wabaId);
    }

    if (!phoneNumber) {
      this.logger.warn(`Cannot resolve phone number from webhook payload (phone_number_id=${phoneNumberId ?? 'none'}, wabaId=${wabaId ?? 'none'})`);
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
      this.logger.error(`Phone number ${phoneNumber.phoneNumberId} has no webhookSecret (Meta App Secret) configured`);
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
      this.logger.warn(`Invalid signature for phone ${phoneNumber.phoneNumberId} — got: ${signature.substring(0, 20)}... expected: ${expectedSignature.substring(0, 20)}...`);
      throw new UnauthorizedException('Invalid webhook signature');
    }

    return true;
  }
}
