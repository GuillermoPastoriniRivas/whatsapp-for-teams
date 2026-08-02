import { MediaAssetRepository } from '../../../domain/repositories/media-asset.repository.js';
import { MediaProviderRefRepository } from '../../../domain/repositories/media-provider-ref.repository.js';
import { MediaNotFoundError } from '../../../domain/errors/media-errors.js';
import { DomainError } from '../../../domain/errors/domain-errors.js';
import { Result, ok, err } from '../../common/result.js';

/**
 * Borrado lógico con papelera: el primer borrado accidental de una carpeta no
 * puede ser irreversible. La purga física la hace el job de mantenimiento
 * pasados los 30 días, que además respeta la deduplicación.
 */
export class DeleteMediaUseCase {
  constructor(
    private readonly assetRepo: MediaAssetRepository,
    private readonly refRepo: MediaProviderRefRepository,
  ) {}

  async execute(assetId: string, tenantId: string): Promise<Result<true, DomainError>> {
    const asset = await this.assetRepo.findById(assetId);
    if (!asset || asset.tenantId !== tenantId || asset.deletedAt) {
      return err(new MediaNotFoundError());
    }

    await this.assetRepo.update(assetId, { deletedAt: new Date(), inLibrary: false });
    // Sin la referencia cacheada, un envío posterior falla en vez de mandar un
    // archivo que el tenant creía borrado.
    await this.refRepo.deleteByAssetId(assetId);

    return ok(true);
  }

  async restore(assetId: string, tenantId: string): Promise<Result<true, DomainError>> {
    const asset = await this.assetRepo.findById(assetId);
    if (!asset || asset.tenantId !== tenantId || !asset.deletedAt) {
      return err(new MediaNotFoundError());
    }

    await this.assetRepo.update(assetId, { deletedAt: null });
    return ok(true);
  }
}
