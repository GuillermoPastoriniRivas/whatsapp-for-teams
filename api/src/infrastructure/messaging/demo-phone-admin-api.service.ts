import { Injectable } from '@nestjs/common';
import type {
  BlockedUser,
  ConversationalComponents,
  PhoneAdminContext,
  RemotePhoneNumberInfo,
} from '../../application/ports/phone-admin.port.js';

/**
 * Proveedor demo: no hay API de Meta atrás, así que el estado vive en memoria
 * del proceso. Alcanza para que el visitante pruebe las pantallas; se pierde en
 * cada reinicio y eso está bien — el tenant demo se regenera igual.
 */
@Injectable()
export class DemoPhoneAdminApiService {
  private readonly components = new Map<string, ConversationalComponents>();
  private readonly blocked = new Map<string, Set<string>>();

  async getConversationalComponents(ctx: PhoneAdminContext): Promise<ConversationalComponents> {
    return this.components.get(ctx.phoneNumberId) ?? { enabled: false, iceBreakers: [], commands: [] };
  }

  async updateConversationalComponents(
    ctx: PhoneAdminContext,
    components: ConversationalComponents,
  ): Promise<void> {
    this.components.set(ctx.phoneNumberId, components);
  }

  async getPhoneNumberInfo(): Promise<RemotePhoneNumberInfo> {
    return {
      displayPhoneNumber: null,
      verifiedName: 'Demo',
      qualityRating: 'GREEN',
      codeVerificationStatus: 'VERIFIED',
      throughputLevel: 'STANDARD',
      registered: true,
    };
  }

  async register(): Promise<void> {
    // El número demo ya está "registrado": no hay nada contra qué registrarlo.
  }

  async deregister(): Promise<void> {}

  async requestVerificationCode(): Promise<void> {}

  async verifyCode(): Promise<void> {}

  async listBlockedUsers(ctx: PhoneAdminContext): Promise<BlockedUser[]> {
    return [...(this.blocked.get(ctx.phoneNumberId) ?? [])].map((waId) => ({ waId }));
  }

  async blockUsers(ctx: PhoneAdminContext, waIds: string[]): Promise<void> {
    const set = this.blocked.get(ctx.phoneNumberId) ?? new Set<string>();
    waIds.forEach((waId) => set.add(waId));
    this.blocked.set(ctx.phoneNumberId, set);
  }

  async unblockUsers(ctx: PhoneAdminContext, waIds: string[]): Promise<void> {
    const set = this.blocked.get(ctx.phoneNumberId);
    if (!set) return;
    waIds.forEach((waId) => set.delete(waId));
  }
}
