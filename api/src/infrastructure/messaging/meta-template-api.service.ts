import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreateTemplateParams,
  DeleteTemplateParams,
  RemoteTemplate,
  TemplateComponentDefinition,
  TemplateProviderContext,
  UpdateTemplateParams,
} from '../../application/ports/template-management.port.js';
import { classifyMetaError, MetaApiError, MetaErrorBody } from './meta-api-error.js';

interface MetaTemplateItem {
  id: string;
  name: string;
  language: string;
  status: string;
  category: string;
  quality_score?: { score?: string };
  components?: TemplateComponentDefinition[];
  rejected_reason?: string;
}

interface MetaTemplateListResponse {
  data: MetaTemplateItem[];
  paging?: { next?: string };
}

/** Tope de páginas del listado (100 por página): corta un `next` que se repita. */
const MAX_TEMPLATE_PAGES = 50;

/** Tope de Meta para el borrado masivo por `hsm_ids`. */
const MAX_BULK_DELETE = 100;

@Injectable()
export class MetaTemplateApiService {
  protected readonly logger = new Logger(this.constructor.name);
  protected readonly apiVersion: string;

  constructor(configService: ConfigService) {
    this.apiVersion = configService.get<string>('META_API_VERSION', 'v21.0');
  }

  /** Base Graph API URL. */
  protected graphBaseUrl(): string {
    return `https://graph.facebook.com/${this.apiVersion}`;
  }

  /** Auth headers — el business token de la WABA, como Bearer. */
  protected authHeaders(providerConfig: Record<string, string>): Record<string, string> {
    if (!providerConfig.accessToken) {
      throw new Error('Meta Template API: missing accessToken in providerConfig');
    }
    return { Authorization: `Bearer ${providerConfig.accessToken}` };
  }

  async createTemplate(params: CreateTemplateParams): Promise<{ metaTemplateId: string; status: string }> {
    const url = `${this.graphBaseUrl()}/${params.wabaId}/message_templates`;
    try {
      const data = await this.request<{ id: string; status: string }>(url, params.providerConfig, 'POST', {
        name: params.name,
        language: params.language,
        category: params.category.toUpperCase(),
        components: params.components,
        ...(params.messageSendTtlSeconds
          ? { message_send_ttl_seconds: params.messageSendTtlSeconds }
          : {}),
      });
      return { metaTemplateId: data.id, status: data.status };
    } catch (error) {
      throw this.explainWabaEdgeError(error, params.wabaId);
    }
  }

  /**
   * El error 100 sobre el borde `message_templates` casi siempre significa que
   * el ID guardado no es una WABA. El caso típico: pegar el ID del **portafolio
   * de negocio** (Business Manager), que también existe y también se deja leer,
   * así que el mensaje crudo de Meta —"does not exist, cannot be loaded due to
   * missing permissions, or does not support this operation"— manda a buscar un
   * problema de permisos que no es.
   */
  private explainWabaEdgeError(error: unknown, wabaId: string): unknown {
    const message = error instanceof Error ? error.message : '';
    // "Unsupported post request" al crear, "Unsupported get request" al sincronizar.
    const looksLikeWrongNode =
      message.includes('Unsupported') || message.includes('does not exist');
    if (!(error instanceof MetaApiError) || error.code !== 100 || !looksLikeWrongNode) return error;

    return new MetaApiError(
      error.code,
      error.subcode,
      `Meta no acepta plantillas en la cuenta "${wabaId}". Suele pasar cuando ahí está cargado el ID ` +
        'del portafolio de negocio en lugar del de la cuenta de WhatsApp (WABA). En el Administrador ' +
        'comercial de Meta, WhatsApp → Cuentas de WhatsApp Business, copiá el ID de la cuenta que ' +
        'contiene este número y cargalo en el número.',
      false,
      error.severity,
      error.httpStatus,
    );
  }

  async updateTemplate(params: UpdateTemplateParams): Promise<void> {
    const url = `${this.graphBaseUrl()}/${params.metaTemplateId}`;
    await this.request(url, params.providerConfig, 'POST', {
      ...(params.category ? { category: params.category.toUpperCase() } : {}),
      ...(params.components ? { components: params.components } : {}),
    });
  }

  async deleteTemplate(params: DeleteTemplateParams): Promise<void> {
    const query = new URLSearchParams({ name: params.name });
    if (params.metaTemplateId) query.set('hsm_id', params.metaTemplateId);
    const url = `${this.graphBaseUrl()}/${params.wabaId}/message_templates?${query}`;
    await this.request(url, params.providerConfig, 'DELETE');
  }

  /**
   * Borrado masivo. Meta acepta hasta 100 ids por request en `hsm_ids`; se
   * mandan en tandas para que borrar una lista larga no falle entera.
   */
  async deleteTemplates(params: TemplateProviderContext, metaTemplateIds: string[]): Promise<void> {
    const ids = metaTemplateIds.filter(Boolean);
    for (let offset = 0; offset < ids.length; offset += MAX_BULK_DELETE) {
      const chunk = ids.slice(offset, offset + MAX_BULK_DELETE);
      const query = new URLSearchParams({ hsm_ids: JSON.stringify(chunk) });
      const url = `${this.graphBaseUrl()}/${params.wabaId}/message_templates?${query}`;
      await this.request(url, params.providerConfig, 'DELETE');
    }
  }

  async listTemplates(params: TemplateProviderContext): Promise<RemoteTemplate[]> {
    const fields = 'id,name,language,status,category,quality_score,components,rejected_reason';
    let url: string | undefined =
      `${this.graphBaseUrl()}/${params.wabaId}/message_templates?fields=${fields}&limit=100`;

    // `paging.next` es una URL absoluta que viene en la respuesta, y a cada
    // request le pegamos el access token: si apuntara a otro host le estaríamos
    // mandando la credencial del cliente. Solo se sigue dentro del mismo origen.
    const origin = new URL(this.graphBaseUrl()).origin;
    const templates: RemoteTemplate[] = [];
    for (let page = 0; url && page < MAX_TEMPLATE_PAGES; page++) {
      let body: MetaTemplateListResponse;
      try {
        body = await this.request<MetaTemplateListResponse>(url, params.providerConfig, 'GET');
      } catch (error) {
        throw this.explainWabaEdgeError(error, params.wabaId);
      }
      for (const item of body.data ?? []) {
        templates.push({
          metaTemplateId: item.id,
          name: item.name,
          language: item.language,
          category: item.category,
          status: item.status,
          qualityScore: item.quality_score?.score ?? null,
          components: item.components ?? [],
          rejectionReason: item.rejected_reason ?? null,
        });
      }
      url = this.sameOrigin(body.paging?.next, origin);
    }
    return templates;
  }

  /** Devuelve la URL solo si es del mismo origen que la API; si no, corta el paginado. */
  private sameOrigin(next: string | undefined, origin: string): string | undefined {
    if (!next) return undefined;
    let parsed: URL;
    try {
      parsed = new URL(next);
    } catch {
      return undefined;
    }
    if (parsed.origin !== origin) {
      this.logger.warn(`Se descarta paging.next hacia ${parsed.origin}: no es el origen de la API`);
      return undefined;
    }
    return parsed.toString();
  }

  private async request<T = unknown>(
    url: string,
    providerConfig: Record<string, string>,
    method: 'GET' | 'POST' | 'DELETE',
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
      this.logger.error(`Template API error: ${method} ${response.status} ${errorText}`);
      let errorBody: MetaErrorBody | null = null;
      try {
        errorBody = JSON.parse(errorText) as MetaErrorBody;
      } catch {
        // non-JSON error body — classify by HTTP status alone
      }
      throw classifyMetaError(response.status, errorBody);
    }

    return (await response.json()) as T;
  }
}
