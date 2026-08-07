import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  BlockedUser,
  ConversationalComponents,
  PhoneAdminContext,
  RemotePhoneNumberInfo,
} from '../../application/ports/phone-admin.port.js';
import { classifyMetaError, MetaErrorBody } from './meta-api-error.js';

const PHONE_FIELDS =
  'display_phone_number,verified_name,quality_rating,code_verification_status,throughput,status,platform_type';

interface MetaPhoneResponse {
  display_phone_number?: string;
  verified_name?: string;
  quality_rating?: string;
  code_verification_status?: string;
  throughput?: { level?: string };
  status?: string;
}

interface MetaConversationalResponse {
  conversational_automation?: {
    enable_welcome_message?: boolean;
    prompts?: string[];
    commands?: Array<{ command_name?: string; command_description?: string }>;
  };
}

/**
 * Administración del número contra el Cloud API: componentes conversacionales,
 * registro con PIN de 2FA y lista de bloqueados.
 *
 * Todo cuelga del `phone_number_id`, no de la WABA.
 */
@Injectable()
export class MetaPhoneAdminApiService {
  private readonly logger = new Logger(MetaPhoneAdminApiService.name);
  private readonly apiVersion: string;

  constructor(configService: ConfigService) {
    this.apiVersion = configService.get<string>('META_API_VERSION', 'v21.0');
  }

  private baseUrl(): string {
    return `https://graph.facebook.com/${this.apiVersion}`;
  }

  private authHeaders(providerConfig: Record<string, string>): Record<string, string> {
    if (!providerConfig.accessToken) {
      throw new Error('Meta Phone Admin API: falta accessToken en providerConfig');
    }
    return { Authorization: `Bearer ${providerConfig.accessToken}` };
  }

  // ── Componentes conversacionales ───────────────────────────────

  async getConversationalComponents(ctx: PhoneAdminContext): Promise<ConversationalComponents | null> {
    const data = await this.request<MetaConversationalResponse>(
      ctx,
      `/${ctx.phoneNumberId}?fields=conversational_automation`,
      'GET',
    );

    const automation = data.conversational_automation;
    if (!automation) return null;

    return {
      enabled: automation.enable_welcome_message ?? false,
      iceBreakers: automation.prompts ?? [],
      commands: (automation.commands ?? []).map((command) => ({
        commandName: command.command_name ?? '',
        commandDescription: command.command_description ?? '',
      })),
    };
  }

  async updateConversationalComponents(
    ctx: PhoneAdminContext,
    components: ConversationalComponents,
  ): Promise<void> {
    await this.request(ctx, `/${ctx.phoneNumberId}/conversational_automation`, 'POST', {
      enable_welcome_message: components.enabled,
      prompts: components.iceBreakers,
      commands: components.commands.map((command) => ({
        command_name: command.commandName,
        command_description: command.commandDescription,
      })),
    });
  }

  // ── Estado del número ──────────────────────────────────────────

  async getPhoneNumberInfo(ctx: PhoneAdminContext): Promise<RemotePhoneNumberInfo | null> {
    const data = await this.request<MetaPhoneResponse>(ctx, `/${ctx.phoneNumberId}?fields=${PHONE_FIELDS}`, 'GET');
    if (!data) return null;

    return {
      displayPhoneNumber: data.display_phone_number ?? null,
      verifiedName: data.verified_name ?? null,
      qualityRating: data.quality_rating ?? null,
      codeVerificationStatus: data.code_verification_status ?? null,
      throughputLevel: data.throughput?.level ?? null,
      // Meta marca CONNECTED cuando el número ya está registrado en Cloud API.
      registered: (data.status ?? '').toUpperCase() === 'CONNECTED',
    };
  }

  /**
   * Registra el número en Cloud API. El PIN es el de verificación en dos pasos:
   * si el número ya tenía uno configurado hay que mandar **ese**, no uno nuevo,
   * o Meta responde 133005.
   */
  async register(ctx: PhoneAdminContext, pin: string): Promise<void> {
    await this.request(ctx, `/${ctx.phoneNumberId}/register`, 'POST', {
      messaging_product: 'whatsapp',
      pin,
    });
  }

  async deregister(ctx: PhoneAdminContext): Promise<void> {
    await this.request(ctx, `/${ctx.phoneNumberId}/deregister`, 'POST', {});
  }

  async requestVerificationCode(
    ctx: PhoneAdminContext,
    method: 'SMS' | 'VOICE',
    locale = 'es_ES',
  ): Promise<void> {
    await this.request(ctx, `/${ctx.phoneNumberId}/request_code`, 'POST', {
      code_method: method,
      language: locale,
    });
  }

  async verifyCode(ctx: PhoneAdminContext, code: string): Promise<void> {
    await this.request(ctx, `/${ctx.phoneNumberId}/verify_code`, 'POST', { code });
  }

  // ── Bloqueos ───────────────────────────────────────────────────

  async listBlockedUsers(ctx: PhoneAdminContext): Promise<BlockedUser[]> {
    const data = await this.request<{ data?: Array<{ wa_id?: string; input?: string }> }>(
      ctx,
      `/${ctx.phoneNumberId}/block_users`,
      'GET',
    );
    return (data.data ?? [])
      .map((entry) => entry.wa_id ?? entry.input)
      .filter((waId): waId is string => !!waId)
      .map((waId) => ({ waId }));
  }

  async blockUsers(ctx: PhoneAdminContext, waIds: string[]): Promise<void> {
    if (waIds.length === 0) return;
    await this.request(ctx, `/${ctx.phoneNumberId}/block_users`, 'POST', {
      messaging_product: 'whatsapp',
      block_users: waIds.map((user) => ({ user })),
    });
  }

  async unblockUsers(ctx: PhoneAdminContext, waIds: string[]): Promise<void> {
    if (waIds.length === 0) return;
    await this.request(ctx, `/${ctx.phoneNumberId}/block_users`, 'DELETE', {
      messaging_product: 'whatsapp',
      block_users: waIds.map((user) => ({ user })),
    });
  }

  // ── HTTP ───────────────────────────────────────────────────────

  private async request<T>(
    ctx: PhoneAdminContext,
    path: string,
    method: 'GET' | 'POST' | 'DELETE',
    body?: Record<string, unknown>,
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl()}${path}`, {
      method,
      headers: {
        ...this.authHeaders(ctx.providerConfig),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`Meta phone admin ${method} ${path}: ${response.status} ${text.slice(0, 300)}`);
      let errorBody: MetaErrorBody | null = null;
      try {
        errorBody = JSON.parse(text) as MetaErrorBody;
      } catch {
        // cuerpo no-JSON (proxy/HTML): se clasifica solo por el status
      }
      throw classifyMetaError(response.status, errorBody);
    }

    return (await response.json()) as T;
  }
}
