import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  FlowCatalogContext,
  FlowCatalogPort,
  WhatsAppFlowSummary,
} from '../../application/ports/flow-catalog.port.js';
import { classifyMetaError, type MetaErrorBody } from './meta-api-error.js';

interface MetaFlowListItem {
  id: string;
  name: string;
  status: string;
  categories?: string[];
  endpoint_uri?: string;
}

interface MetaFlowListResponse {
  data?: MetaFlowListItem[];
}

interface MetaFlowAssetsResponse {
  data?: Array<{ asset_type?: string; download_url?: string }>;
}

const MAX_FLOWS = 100;

/**
 * Los Flows de la cuenta, leídos de la WABA.
 *
 * No se crean desde acá: el JSON de un Flow se arma en el editor de WhatsApp
 * Manager, que ya es un producto entero. Nosotros los listamos para que un nodo
 * pueda elegir cuál mandar.
 */
@Injectable()
export class MetaFlowsApiService implements FlowCatalogPort {
  private readonly logger = new Logger(MetaFlowsApiService.name);
  private readonly apiVersion: string;

  constructor(configService: ConfigService) {
    this.apiVersion = configService.get<string>('META_API_VERSION', 'v21.0');
  }

  async listFlows(context: FlowCatalogContext): Promise<WhatsAppFlowSummary[]> {
    const url = `https://graph.facebook.com/${this.apiVersion}/${context.wabaId}/flows?fields=id,name,status,categories,endpoint_uri&limit=${MAX_FLOWS}`;
    const body = await this.request<MetaFlowListResponse>(url, context.providerConfig);

    return (body.data ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      status: item.status,
      categories: item.categories ?? [],
      hasEndpoint: !!item.endpoint_uri,
      screens: [],
    }));
  }

  /**
   * Las pantallas salen del JSON del Flow, que Meta entrega por una URL firmada
   * aparte. Es una llamada más por Flow, así que se pide solo del que se eligió.
   */
  async screensOf(context: FlowCatalogContext, flowId: string): Promise<string[]> {
    const url = `https://graph.facebook.com/${this.apiVersion}/${flowId}/assets`;
    try {
      const assets = await this.request<MetaFlowAssetsResponse>(url, context.providerConfig);
      const download = assets.data?.find((asset) => asset.asset_type === 'FLOW_JSON')?.download_url;
      if (!download) return [];

      const response = await fetch(download);
      if (!response.ok) return [];
      const flowJson = (await response.json()) as { screens?: Array<{ id?: string }> };
      return (flowJson.screens ?? []).map((screen) => String(screen.id ?? '')).filter(Boolean);
    } catch (error: any) {
      // Sin pantallas el nodo sigue andando: se entra por la primera del Flow.
      this.logger.warn(`No se pudieron leer las pantallas del Flow ${flowId}: ${error?.message}`);
      return [];
    }
  }

  private async request<T>(url: string, providerConfig: Record<string, string>): Promise<T> {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${providerConfig.accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`Flows API error: GET ${response.status} ${errorText}`);
      let errorBody: MetaErrorBody | null = null;
      try {
        errorBody = JSON.parse(errorText) as MetaErrorBody;
      } catch {
        // cuerpo no-JSON: se clasifica por el status
      }
      throw classifyMetaError(response.status, errorBody);
    }

    return (await response.json()) as T;
  }
}
