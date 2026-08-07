import { Injectable } from '@nestjs/common';
import { MessagingProvider } from '../../domain/enums/messaging-provider.enum.js';
import type {
  BlockedUser,
  ConversationalComponents,
  PhoneAdminContext,
  PhoneAdminPort,
  RemotePhoneNumberInfo,
} from '../../application/ports/phone-admin.port.js';
import { MetaPhoneAdminApiService } from './meta-phone-admin-api.service.js';
import { DemoPhoneAdminApiService } from './demo-phone-admin-api.service.js';

@Injectable()
export class PhoneAdminStrategyService implements PhoneAdminPort {
  constructor(
    private readonly metaService: MetaPhoneAdminApiService,
    private readonly demoService: DemoPhoneAdminApiService,
  ) {}

  getConversationalComponents(ctx: PhoneAdminContext): Promise<ConversationalComponents | null> {
    return this.resolve(ctx).getConversationalComponents(ctx);
  }

  updateConversationalComponents(ctx: PhoneAdminContext, components: ConversationalComponents): Promise<void> {
    return this.resolve(ctx).updateConversationalComponents(ctx, components);
  }

  getPhoneNumberInfo(ctx: PhoneAdminContext): Promise<RemotePhoneNumberInfo | null> {
    return this.resolve(ctx).getPhoneNumberInfo(ctx);
  }

  register(ctx: PhoneAdminContext, pin: string): Promise<void> {
    return this.resolve(ctx).register(ctx, pin);
  }

  deregister(ctx: PhoneAdminContext): Promise<void> {
    return this.resolve(ctx).deregister(ctx);
  }

  requestVerificationCode(ctx: PhoneAdminContext, method: 'SMS' | 'VOICE', locale?: string): Promise<void> {
    return this.resolve(ctx).requestVerificationCode(ctx, method, locale);
  }

  verifyCode(ctx: PhoneAdminContext, code: string): Promise<void> {
    return this.resolve(ctx).verifyCode(ctx, code);
  }

  listBlockedUsers(ctx: PhoneAdminContext): Promise<BlockedUser[]> {
    return this.resolve(ctx).listBlockedUsers(ctx);
  }

  blockUsers(ctx: PhoneAdminContext, waIds: string[]): Promise<void> {
    return this.resolve(ctx).blockUsers(ctx, waIds);
  }

  unblockUsers(ctx: PhoneAdminContext, waIds: string[]): Promise<void> {
    return this.resolve(ctx).unblockUsers(ctx, waIds);
  }

  private resolve(ctx: PhoneAdminContext): MetaPhoneAdminApiService | DemoPhoneAdminApiService {
    return ctx.provider === MessagingProvider.META ? this.metaService : this.demoService;
  }
}
