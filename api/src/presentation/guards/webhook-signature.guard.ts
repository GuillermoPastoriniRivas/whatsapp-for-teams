import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import type { Request } from 'express';
import { createHmac } from 'crypto';
import type { PhoneNumberRepository } from '../../domain/repositories/phone-number.repository.js';

@Injectable()
export class WebhookSignatureGuard implements CanActivate {
  constructor(
    @Inject('PhoneNumberRepository') private readonly phoneRepo: PhoneNumberRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const signature = request.headers['x-hub-signature-256'] as string;

    if (!signature) {
      throw new UnauthorizedException('Missing X-Hub-Signature-256 header');
    }

    // Extract phone_number_id from webhook payload to look up the secret
    const body = request.body;
    const phoneNumberId = body?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;

    if (!phoneNumberId) {
      throw new UnauthorizedException('Cannot determine phone number from payload');
    }

    const phoneNumber = await this.phoneRepo.findByPhoneNumberId(phoneNumberId);
    if (!phoneNumber) {
      throw new UnauthorizedException('Unknown phone number');
    }

    const rawBody = JSON.stringify(body);
    const expectedSignature =
      'sha256=' + createHmac('sha256', phoneNumber.webhookSecret).update(rawBody).digest('hex');

    if (signature !== expectedSignature) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    // Attach phone number to request for the controller
    (request as any).phoneNumber = phoneNumber;

    return true;
  }
}
