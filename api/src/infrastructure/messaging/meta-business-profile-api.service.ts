import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  BusinessProfileContext,
  BusinessProfileUpdate,
} from '../../application/ports/business-profile.port.js';
import type { WhatsAppBusinessProfile } from '../../domain/entities/whatsapp-business-profile.entity.js';
import { classifyMetaError, MetaErrorBody } from './meta-api-error.js';

const PROFILE_FIELDS = 'about,address,description,email,profile_picture_url,websites,vertical';

interface MetaProfileResponse {
  data?: Array<{
    about?: string;
    address?: string;
    description?: string;
    email?: string;
    profile_picture_url?: string;
    websites?: string[];
    vertical?: string;
  }>;
}

/**
 * Perfil de negocio contra el Cloud API de Meta.
 *
 * La foto no se manda como URL: hay que subir los bytes por la API de subida
 * reanudable, que devuelve un handle, y recién ese handle entra en el perfil.
 * Esa subida cuelga del **App ID** de la app de Meta dueña del token, así que
 * el número necesita `providerConfig.appId` para poder cambiar la foto (el
 * resto del perfil no lo necesita).
 */
@Injectable()
export class MetaBusinessProfileApiService {
  protected readonly logger = new Logger(this.constructor.name);
  protected readonly apiVersion: string;

  constructor(configService: ConfigService) {
    this.apiVersion = configService.get<string>('META_API_VERSION', 'v21.0');
  }

  protected graphBaseUrl(): string {
    return `https://graph.facebook.com/${this.apiVersion}`;
  }

  protected authHeaders(providerConfig: Record<string, string>): Record<string, string> {
    if (!providerConfig.accessToken) {
      throw new Error('Meta Business Profile API: falta accessToken en providerConfig');
    }
    return { Authorization: `Bearer ${providerConfig.accessToken}` };
  }

  /** Header de la subida reanudable: Meta pide `OAuth`, no `Bearer`. */
  protected uploadAuthHeaders(providerConfig: Record<string, string>): Record<string, string> {
    if (!providerConfig.accessToken) {
      throw new Error('Meta Business Profile API: falta accessToken en providerConfig');
    }
    return { Authorization: `OAuth ${providerConfig.accessToken}` };
  }

  async getProfile(ctx: BusinessProfileContext): Promise<WhatsAppBusinessProfile> {
    const url = `${this.graphBaseUrl()}/${ctx.phoneNumberId}/whatsapp_business_profile?fields=${PROFILE_FIELDS}`;
    const response = await this.request<MetaProfileResponse>(url, ctx.providerConfig, 'GET');
    const profile = response.data?.[0] ?? {};

    return {
      about: profile.about ?? null,
      address: profile.address ?? null,
      description: profile.description ?? null,
      email: profile.email ?? null,
      vertical: profile.vertical ?? null,
      websites: profile.websites ?? [],
      profilePictureUrl: profile.profile_picture_url ?? null,
    };
  }

  async updateProfile(ctx: BusinessProfileContext, update: BusinessProfileUpdate): Promise<void> {
    const body: Record<string, unknown> = { messaging_product: 'whatsapp' };
    // `undefined` = no tocar. La cadena vacía sí viaja: es como se borra un campo.
    if (update.about !== undefined) body.about = update.about ?? '';
    if (update.address !== undefined) body.address = update.address ?? '';
    if (update.description !== undefined) body.description = update.description ?? '';
    if (update.email !== undefined) body.email = update.email ?? '';
    if (update.vertical !== undefined) body.vertical = update.vertical ?? 'UNDEFINED';
    if (update.websites !== undefined) body.websites = update.websites;
    if (update.profilePictureHandle !== undefined) body.profile_picture_handle = update.profilePictureHandle;

    const url = `${this.graphBaseUrl()}/${ctx.phoneNumberId}/whatsapp_business_profile`;
    await this.request(url, ctx.providerConfig, 'POST', body);
  }

  async uploadProfilePicture(ctx: BusinessProfileContext, file: Buffer, mimeType: string): Promise<string> {
    const appId = ctx.providerConfig.appId;
    if (!appId) {
      throw new Error(
        'Para cambiar la foto hace falta el App ID de Meta: cargalo en la configuración del proveedor de este número.',
      );
    }

    // 1) Sesión de subida.
    const query = new URLSearchParams({ file_length: String(file.length), file_type: mimeType });
    const session = await this.request<{ id: string }>(
      `${this.graphBaseUrl()}/${appId}/uploads?${query}`,
      ctx.providerConfig,
      'POST',
    );
    if (!session.id) throw new Error('Meta no devolvió una sesión de subida.');

    // 2) Los bytes, en un solo tramo (una foto de perfil nunca llega al límite).
    const response = await fetch(`${this.graphBaseUrl()}/${session.id}`, {
      method: 'POST',
      headers: {
        ...this.uploadAuthHeaders(ctx.providerConfig),
        file_offset: '0',
        'Content-Type': 'application/octet-stream',
      },
      body: new Uint8Array(file),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`Resumable upload error: ${response.status} ${errorText}`);
      throw this.toError(response.status, errorText);
    }

    const { h } = (await response.json()) as { h?: string };
    if (!h) throw new Error('La subida no devolvió el handle de la imagen.');
    return h;
  }

  protected async request<T = unknown>(
    url: string,
    providerConfig: Record<string, string>,
    method: 'GET' | 'POST',
    body?: Record<string, unknown>,
  ): Promise<T> {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...this.authHeaders(providerConfig),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    if (!response.ok) {
      const errorText = await response.text();
      // El cuerpo va al log: Meta contesta 131000 ("Something went wrong") sin
      // decir qué campo le molestó, y sin ver lo que mandamos no hay forma de
      // saberlo. Son datos del perfil público, no credenciales.
      const sent = body ? ` payload=${JSON.stringify(body)}` : '';
      this.logger.error(`Business profile API error: ${method} ${response.status} ${errorText}${sent}`);
      throw this.toError(response.status, errorText);
    }

    return (await response.json()) as T;
  }

  private toError(status: number, errorText: string): Error {
    let errorBody: MetaErrorBody | null = null;
    try {
      errorBody = JSON.parse(errorText) as MetaErrorBody;
    } catch {
      // cuerpo no-JSON (proxy/HTML): se clasifica solo por el status
    }
    return classifyMetaError(status, errorBody);
  }
}
