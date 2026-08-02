import { MediaAsset } from '../../../domain/entities/media-asset.entity.js';
import { MediaKind } from '../../../domain/enums/media-kind.enum.js';
import { MediaSource } from '../../../domain/enums/media-source.enum.js';
import { AgentRole } from '../../../domain/enums/agent-role.enum.js';
import { AgentPhoneAccessRepository } from '../../../domain/repositories/agent-phone-access.repository.js';
import { MediaAssetRepository } from '../../../domain/repositories/media-asset.repository.js';
import { PaginatedResult } from '../../../domain/repositories/conversation.repository.js';
import { MediaAccessService, MediaUrls } from './media-access.service.js';

export interface ListMediaInput {
  tenantId: string;
  agentId: string;
  agentRole: string;
  /** `true` biblioteca curada, `false` historial, `undefined` todo. */
  inLibrary?: boolean;
  kinds?: MediaKind[];
  sources?: MediaSource[];
  conversationId?: string;
  contactId?: string;
  tags?: string[];
  search?: string;
  from?: Date;
  to?: Date;
  page: number;
  limit: number;
}

export interface MediaListItem {
  asset: MediaAsset;
  urls: MediaUrls;
}

/**
 * Listado de la biblioteca y del historial.
 *
 * Un agente ve solo el media de los números que tiene asignados; los admins ven
 * todo. Los archivos de biblioteca no cuelgan de ningún número, así que están
 * disponibles para todo el equipo.
 */
export class ListMediaUseCase {
  constructor(
    private readonly assetRepo: MediaAssetRepository,
    private readonly accessRepo: AgentPhoneAccessRepository,
    private readonly mediaAccess: MediaAccessService,
  ) {}

  async execute(input: ListMediaInput): Promise<PaginatedResult<MediaListItem>> {
    const phoneNumberIds = await this.visiblePhoneNumbers(input.agentId, input.agentRole);

    const result = await this.assetRepo.search({
      tenantId: input.tenantId,
      inLibrary: input.inLibrary,
      kinds: input.kinds,
      sources: input.sources,
      conversationId: input.conversationId,
      contactId: input.contactId,
      tags: input.tags,
      search: input.search,
      from: input.from,
      to: input.to,
      phoneNumberIds,
      page: input.page,
      limit: input.limit,
    });

    const now = new Date();
    const data = await Promise.all(
      result.data.map(async (asset) => ({
        asset,
        urls: await this.mediaAccess.viewUrls(asset, now),
      })),
    );

    return { data, meta: result.meta };
  }

  /** `undefined` = sin restricción (admin). */
  private async visiblePhoneNumbers(agentId: string, role: string): Promise<string[] | undefined> {
    if (role === AgentRole.ADMIN) return undefined;
    const access = await this.accessRepo.findByAgentId(agentId);
    return access.map((entry) => entry.phoneNumberId);
  }
}
