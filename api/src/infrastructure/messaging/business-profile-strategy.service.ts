import { Injectable } from '@nestjs/common';
import { MessagingProvider } from '../../domain/enums/messaging-provider.enum.js';
import type {
  BusinessProfileContext,
  BusinessProfilePort,
  BusinessProfileUpdate,
} from '../../application/ports/business-profile.port.js';
import type { WhatsAppBusinessProfile } from '../../domain/entities/whatsapp-business-profile.entity.js';
import { MetaBusinessProfileApiService } from './meta-business-profile-api.service.js';
import { DemoBusinessProfileApiService } from './demo-business-profile-api.service.js';

@Injectable()
export class BusinessProfileStrategyService implements BusinessProfilePort {
  constructor(
    private readonly metaService: MetaBusinessProfileApiService,
    private readonly demoService: DemoBusinessProfileApiService,
  ) {}

  async getProfile(ctx: BusinessProfileContext): Promise<WhatsAppBusinessProfile | null> {
    return this.resolve(ctx.provider).getProfile(ctx);
  }

  async updateProfile(ctx: BusinessProfileContext, update: BusinessProfileUpdate): Promise<void> {
    return this.resolve(ctx.provider).updateProfile(ctx, update);
  }

  async uploadProfilePicture(ctx: BusinessProfileContext, file: Buffer, mimeType: string): Promise<string> {
    return this.resolve(ctx.provider).uploadProfilePicture(ctx, file, mimeType);
  }

  private resolve(provider: MessagingProvider): MetaBusinessProfileApiService | DemoBusinessProfileApiService {
    switch (provider) {
      case MessagingProvider.META:
        return this.metaService;
      case MessagingProvider.DEMO:
        return this.demoService;
      default:
        // No debería llegar: `provider-capabilities` corta antes en el caso de
        // uso. Queda igual por si se agrega un proveedor y se olvida la matriz.
        throw new Error(`El proveedor "${provider}" no expone el perfil de negocio.`);
    }
  }
}
