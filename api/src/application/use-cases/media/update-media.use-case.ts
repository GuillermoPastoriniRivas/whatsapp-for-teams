import { MediaAsset } from '../../../domain/entities/media-asset.entity.js';
import { MediaAssetRepository } from '../../../domain/repositories/media-asset.repository.js';
import {
  MediaLibraryUnavailableError,
  MediaNotFoundError,
  MediaStorageNotConfiguredError,
} from '../../../domain/errors/media-errors.js';
import { DomainError } from '../../../domain/errors/domain-errors.js';
import { Result, ok, err } from '../../common/result.js';
import { MediaAccessService } from './media-access.service.js';

export interface UpdateMediaInput {
  assetId: string;
  tenantId: string;
  inLibrary?: boolean;
  title?: string | null;
  tags?: string[];
}

/** Curaduría: guardar en biblioteca, renombrar, etiquetar. */
export class UpdateMediaUseCase {
  constructor(
    private readonly assetRepo: MediaAssetRepository,
    private readonly mediaAccess: MediaAccessService,
  ) {}

  async execute(input: UpdateMediaInput): Promise<Result<MediaAsset, DomainError>> {
    const asset = await this.assetRepo.findById(input.assetId);
    if (!asset || asset.tenantId !== input.tenantId || asset.deletedAt) {
      return err(new MediaNotFoundError());
    }

    // Guardar en biblioteca implica guardar los bytes: sin storage no hay nada
    // que guardar y el archivo se perdería igual a los 30 días.
    if (input.inLibrary) {
      const capabilities = await this.mediaAccess.capabilities(input.tenantId);
      if (!capabilities.enabled) {
        return err(
          capabilities.planIncludesLibrary
            ? new MediaStorageNotConfiguredError()
            : new MediaLibraryUnavailableError(),
        );
      }
    }

    const updated = await this.assetRepo.update(input.assetId, {
      ...(input.inLibrary !== undefined ? { inLibrary: input.inLibrary } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.tags !== undefined ? { tags: normalizeTags(input.tags) } : {}),
    });

    return updated ? ok(updated) : err(new MediaNotFoundError());
  }
}

function normalizeTags(tags: string[]): string[] {
  const cleaned = tags
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => tag.length > 0 && tag.length <= 40);
  return [...new Set(cleaned)].slice(0, 20);
}
