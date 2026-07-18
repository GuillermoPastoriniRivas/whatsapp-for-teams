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
import { classifyMetaError, MetaErrorBody } from './meta-api-error.js';

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

@Injectable()
export class MetaTemplateApiService {
  protected readonly logger = new Logger(this.constructor.name);
  protected readonly apiVersion: string;

  constructor(configService: ConfigService) {
    this.apiVersion = configService.get<string>('META_API_VERSION', 'v21.0');
  }

  /** Base Graph API URL — Kapso overrides this with its Meta-proxy host. */
  protected graphBaseUrl(): string {
    return `https://graph.facebook.com/${this.apiVersion}`;
  }

  /** Auth headers — Meta uses a Bearer token; Kapso overrides with X-API-Key. */
  protected authHeaders(providerConfig: Record<string, string>): Record<string, string> {
    if (!providerConfig.accessToken) {
      throw new Error('Meta Template API: missing accessToken in providerConfig');
    }
    return { Authorization: `Bearer ${providerConfig.accessToken}` };
  }

  async createTemplate(params: CreateTemplateParams): Promise<{ metaTemplateId: string; status: string }> {
    const url = `${this.graphBaseUrl()}/${params.wabaId}/message_templates`;
    const data = await this.request<{ id: string; status: string }>(url, params.providerConfig, 'POST', {
      name: params.name,
      language: params.language,
      category: params.category.toUpperCase(),
      components: params.components,
    });
    return { metaTemplateId: data.id, status: data.status };
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

  async listTemplates(params: TemplateProviderContext): Promise<RemoteTemplate[]> {
    const fields = 'id,name,language,status,category,quality_score,components,rejected_reason';
    let url: string | undefined =
      `${this.graphBaseUrl()}/${params.wabaId}/message_templates?fields=${fields}&limit=100`;

    const templates: RemoteTemplate[] = [];
    while (url) {
      const page: MetaTemplateListResponse = await this.request<MetaTemplateListResponse>(
        url,
        params.providerConfig,
        'GET',
      );
      for (const item of page.data ?? []) {
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
      url = page.paging?.next;
    }
    return templates;
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

/**
 * Kapso proxies the Meta Graph API verbatim (same paths and payloads) at
 * api.kapso.ai/meta/whatsapp, authenticating with the project API key.
 * Template endpoints work identically, so this only swaps host + auth.
 */
@Injectable()
export class KapsoTemplateApiService extends MetaTemplateApiService {
  protected graphBaseUrl(): string {
    return 'https://api.kapso.ai/meta/whatsapp/v24.0';
  }

  protected authHeaders(providerConfig: Record<string, string>): Record<string, string> {
    if (!providerConfig.apiKey) {
      throw new Error('Kapso Template API: missing apiKey in providerConfig');
    }
    return { 'X-API-Key': providerConfig.apiKey };
  }
}
