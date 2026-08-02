import { MediaAssetRepository, MediaUsageSummary } from '../../../domain/repositories/media-asset.repository.js';
import { MediaAccessService } from './media-access.service.js';

export interface MediaUsageResult extends MediaUsageSummary {
  /** `false` = operamos en passthrough y los archivos se pierden a los 30 días. */
  storageEnabled: boolean;
  /** Plan efectivo del tenant. */
  plan: string;
  /** El plan contratado incluye biblioteca. */
  planIncludesLibrary: boolean;
  /**
   * Hay storage configurado en esta instalación. Cuando es `false` con un plan
   * que sí incluye biblioteca, el problema es de configuración —no del plan— y
   * la UI tiene que decir eso, no ofrecer un upgrade que no arregla nada.
   */
  storageConfigured: boolean;
  quotaBytes: number;
  /** Porcentaje usado, 0–100. `null` cuando no hay tope. */
  usedPercent: number | null;
  retentionDays: number;
  /** Archivos que se van a perder en los próximos días si no hay upgrade. */
  atRiskCount: number;
}

/**
 * Alimenta la pantalla de Uso. En plan free es, además, el motor de conversión:
 * "este mes recibiste 412 archivos, 89 ya se perdieron" convierte mucho más que
 * cualquier beneficio abstracto — y sale gratis de tener la metadata.
 */
export class GetMediaUsageUseCase {
  constructor(
    private readonly assetRepo: MediaAssetRepository,
    private readonly mediaAccess: MediaAccessService,
  ) {}

  async execute(tenantId: string): Promise<MediaUsageResult> {
    const now = new Date();
    const [summary, capabilities] = await Promise.all([
      this.assetRepo.usageSummary(tenantId, now),
      this.mediaAccess.capabilities(tenantId),
    ]);

    const quotaBytes = capabilities.limits.storageBytes;

    return {
      ...summary,
      storageEnabled: capabilities.enabled,
      plan: capabilities.plan,
      planIncludesLibrary: capabilities.planIncludesLibrary,
      storageConfigured: capabilities.storageConfigured,
      quotaBytes,
      usedPercent:
        quotaBytes > 0 ? Math.min(100, Math.round((summary.storedBytes / quotaBytes) * 100)) : null,
      retentionDays: capabilities.limits.mediaRetentionDays,
      // En passthrough todo lo que todavía vive en Meta está en la cuenta
      // regresiva de 30 días.
      atRiskCount: capabilities.enabled ? 0 : summary.metaOnlyCount,
    };
  }
}
