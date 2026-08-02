import { Logger } from '@nestjs/common';
import { MediaAsset } from '../../../domain/entities/media-asset.entity.js';
import { PhoneNumber } from '../../../domain/entities/phone-number.entity.js';
import { MediaAssetStatus } from '../../../domain/enums/media-asset-status.enum.js';
import { MediaKind } from '../../../domain/enums/media-kind.enum.js';
import { PlanTier } from '../../../domain/enums/plan-tier.enum.js';
import { PLAN_LIMITS, PlanLimits } from '../../../domain/constants/plan-limits.js';
import { effectiveLimits, effectivePlan } from '../billing/plan-resolution.util.js';
import {
  isUnsafeInline,
  mediaIdCacheExpiryFrom,
} from '../../../domain/constants/media-constraints.js';
import { MediaAssetRepository } from '../../../domain/repositories/media-asset.repository.js';
import { MediaProviderRefRepository } from '../../../domain/repositories/media-provider-ref.repository.js';
import { PhoneNumberRepository } from '../../../domain/repositories/phone-number.repository.js';
import { SubscriptionRepository } from '../../../domain/repositories/subscription.repository.js';
import { MediaGoneAtSourceError, MediaProviderPort } from '../../ports/media-provider.port.js';
import { MediaUrlSignerPort, MediaVariant } from '../../ports/media-url-signer.port.js';
import { StoragePort } from '../../ports/storage.port.js';

export interface MediaUrls {
  /** `false` cuando no hay bytes propios y el original ya venció en Meta. */
  available: boolean;
  url: string | null;
  thumbnailUrl: string | null;
  downloadUrl: string | null;
  expiresAt: Date | null;
}

export interface MediaBytes {
  buffer: Buffer;
  mimeType: string;
  filename: string;
  /** El navegador puede cachearlo: el contenido de un asset nunca cambia. */
  immutable: boolean;
}

export interface MediaSendRef {
  mediaId: string;
}

export interface MediaCapabilities {
  plan: PlanTier;
  limits: PlanLimits;
  /** El plan contratado incluye biblioteca. */
  planIncludesLibrary: boolean;
  /** Esta instalación tiene un backend de storage configurado. */
  storageConfigured: boolean;
  /** Las dos cosas: recién acá guardamos bytes. */
  enabled: boolean;
}

/**
 * El único lugar donde importa si el tenant tiene storage propio o corre en
 * passthrough contra Meta.
 *
 * Todo el resto de la app —la burbuja del chat, los flujos, las campañas, la
 * API pública— pide "una URL para mostrar" o "una referencia para enviar" y no
 * se entera del plan. Si esa condición se filtra afuera de acá, terminamos
 * manteniendo dos productos en paralelo.
 */
export class MediaAccessService {
  private readonly logger = new Logger(MediaAccessService.name);

  constructor(
    private readonly assetRepo: MediaAssetRepository,
    private readonly refRepo: MediaProviderRefRepository,
    private readonly phoneRepo: PhoneNumberRepository,
    private readonly subscriptionRepo: SubscriptionRepository,
    private readonly storage: StoragePort,
    private readonly signer: MediaUrlSignerPort,
    private readonly mediaProvider: MediaProviderPort,
    private readonly urlTtlSeconds: number,
  ) {}

  // ── Plan ────────────────────────────────────────────────

  async planFor(tenantId: string): Promise<PlanLimits> {
    const subscription = await this.subscriptionRepo.findByTenantId(tenantId);
    return effectiveLimits(subscription);
  }

  /**
   * Por qué este tenant guarda (o no) sus archivos.
   *
   * Son dos causas distintas y confundirlas es un problema real: a un cliente
   * Business en un entorno sin bucket configurado no se le puede decir "pasate
   * a un plan pago". Una es del plan, la otra es de la instalación.
   */
  async capabilities(tenantId: string): Promise<MediaCapabilities> {
    const subscription = await this.subscriptionRepo.findByTenantId(tenantId);
    const plan = effectivePlan(subscription);
    const limits = PLAN_LIMITS[plan];
    const storageConfigured = this.storage.enabled;

    if (limits.mediaLibrary && !storageConfigured) {
      this.logger.warn(
        `Tenant ${tenantId} tiene plan ${plan} (con biblioteca) pero no hay storage configurado: ` +
          'definí MEDIA_S3_BUCKET (producción) o MEDIA_LOCAL_PATH (desarrollo).',
      );
    }

    return {
      plan,
      limits,
      planIncludesLibrary: limits.mediaLibrary,
      storageConfigured,
      enabled: limits.mediaLibrary && storageConfigured,
    };
  }

  /** ¿Guardamos los bytes de este tenant, o corre en passthrough? */
  async hasStorage(tenantId: string): Promise<boolean> {
    if (!this.storage.enabled) return false;
    const limits = await this.planFor(tenantId);
    return limits.mediaLibrary;
  }

  // ── Lectura ─────────────────────────────────────────────

  /**
   * URLs listas para el front. Con bytes propios y un backend que sepa firmar
   * salen directo del storage (no pasan por la API); si no, van por el proxy.
   */
  async viewUrls(asset: MediaAsset, now: Date = new Date()): Promise<MediaUrls> {
    if (asset.isUnavailable(now)) {
      return { available: false, url: null, thumbnailUrl: null, downloadUrl: null, expiresAt: null };
    }

    if (asset.isStored) {
      const signed = await this.storageUrls(asset);
      if (signed) return signed;
    }

    // Passthrough, o storage que no sabe firmar (disco local): proxy.
    const raw = this.signer.sign({ assetId: asset.id, variant: 'raw', download: false }, this.urlTtlSeconds);
    const download = this.signer.sign({ assetId: asset.id, variant: 'raw', download: true }, this.urlTtlSeconds);
    const thumb = asset.derivatives.some((d) => d.kind === 'thumb-256')
      ? this.signer.sign({ assetId: asset.id, variant: 'thumb-256', download: false }, this.urlTtlSeconds)
      : null;

    return {
      available: true,
      url: raw.url,
      // Sin derivados, la miniatura es el original: el navegador lo escala.
      thumbnailUrl: thumb?.url ?? raw.url,
      downloadUrl: download.url,
      expiresAt: raw.expiresAt,
    };
  }

  private async storageUrls(asset: MediaAsset): Promise<MediaUrls | null> {
    const thumbKey = asset.derivatives.find((d) => d.kind === 'thumb-256');

    const [main, download, thumb] = await Promise.all([
      this.storage.signedUrl({
        key: asset.storageKey!,
        expiresInSeconds: this.urlTtlSeconds,
        // Nunca servir contenido de terceros con un Content-Type ejecutable.
        contentType: isUnsafeInline(asset.mimeType) ? 'application/octet-stream' : asset.mimeType,
      }),
      this.storage.signedUrl({
        key: asset.storageKey!,
        expiresInSeconds: this.urlTtlSeconds,
        downloadFilename: asset.filename ?? `archivo-${asset.id}`,
      }),
      thumbKey
        ? this.storage.signedUrl({
            key: thumbKey.storageKey,
            expiresInSeconds: this.urlTtlSeconds,
            contentType: thumbKey.mimeType,
          })
        : Promise.resolve(null),
    ]);

    if (!main) return null;

    return {
      available: true,
      url: main.url,
      thumbnailUrl: thumb?.url ?? main.url,
      downloadUrl: download?.url ?? main.url,
      expiresAt: main.expiresAt,
    };
  }

  /**
   * Bytes del asset, para el proxy. Con storage propio salen de ahí; en
   * passthrough se bajan de Meta en el momento.
   */
  async readBytes(asset: MediaAsset, variant: MediaVariant = 'raw'): Promise<MediaBytes> {
    const filename = asset.filename ?? `archivo-${asset.id}`;

    if (variant !== 'raw') {
      const derivative = asset.derivatives.find((d) => d.kind === variant);
      if (derivative) {
        return {
          buffer: await this.storage.get(derivative.storageKey),
          mimeType: derivative.mimeType,
          filename,
          immutable: true,
        };
      }
      // Sin el derivado pedido se cae al original.
    }

    if (asset.isStored) {
      return {
        buffer: await this.storage.get(asset.storageKey!),
        mimeType: asset.mimeType,
        filename,
        immutable: true,
      };
    }

    const downloaded = await this.downloadFromProvider(asset);
    return {
      buffer: downloaded.buffer,
      mimeType: downloaded.mimeType || asset.mimeType,
      filename,
      immutable: true,
    };
  }

  /**
   * Baja el original del proveedor. Si ya no está, deja el asset marcado como
   * perdido para no volver a intentarlo ni mostrar un spinner eterno.
   */
  async downloadFromProvider(asset: MediaAsset) {
    if (!asset.metaMediaId) {
      throw new MediaGoneAtSourceError(asset.id);
    }

    const phone = asset.phoneNumberId ? await this.phoneRepo.findById(asset.phoneNumberId) : null;
    if (!phone) {
      throw new MediaGoneAtSourceError(asset.metaMediaId);
    }

    try {
      return await this.mediaProvider.download({
        provider: phone.provider,
        providerConfig: phone.providerConfig,
        providerMediaId: asset.metaMediaId,
      });
    } catch (error) {
      if (error instanceof MediaGoneAtSourceError) {
        await this.markExpired(asset);
      }
      throw error;
    }
  }

  private async markExpired(asset: MediaAsset): Promise<void> {
    if (asset.isStored) return;
    await this.assetRepo.update(asset.id, { status: MediaAssetStatus.EXPIRED_AT_SOURCE });
  }

  // ── Envío ───────────────────────────────────────────────

  /**
   * Referencia que WhatsApp acepta para enviar este archivo por este número.
   *
   * Siempre `media_id`, nunca un link: no expone nada públicamente y saca del
   * medio todos los fallos de "Meta no pudo descargar tu URL".
   *
   * Los ids están atados al número que hizo el upload, así que la caché va por
   * par (asset, número). Tampoco se reusa el id que trajo un mensaje entrante:
   * Meta no garantiza que un id de recepción sirva para enviar.
   */
  async resolveSendRef(
    asset: MediaAsset,
    phone: PhoneNumber,
    now: Date = new Date(),
  ): Promise<MediaSendRef> {
    const cached = await this.refRepo.findValid(asset.id, phone.id, now);
    if (cached) return { mediaId: cached.providerMediaId };

    const bytes = await this.readBytes(asset, 'raw');

    const uploaded = await this.mediaProvider.upload({
      provider: phone.provider,
      providerConfig: phone.providerConfig,
      phoneNumberId: phone.phoneNumberId,
      buffer: bytes.buffer,
      mimeType: bytes.mimeType,
      filename: asset.filename ?? this.defaultFilename(asset),
    });

    await this.refRepo.upsert({
      assetId: asset.id,
      phoneNumberId: phone.id,
      providerMediaId: uploaded.providerMediaId,
      expiresAt: mediaIdCacheExpiryFrom(now),
    });

    this.logger.debug(`Media ${asset.id} subido a ${phone.phoneNumberId} → ${uploaded.providerMediaId}`);

    return { mediaId: uploaded.providerMediaId };
  }

  private defaultFilename(asset: MediaAsset): string {
    const extension = asset.mimeType.split('/')[1]?.split('+')[0] ?? 'bin';
    const prefix: Record<MediaKind, string> = {
      [MediaKind.IMAGE]: 'imagen',
      [MediaKind.VIDEO]: 'video',
      [MediaKind.AUDIO]: 'audio',
      [MediaKind.DOCUMENT]: 'documento',
      [MediaKind.STICKER]: 'sticker',
    };
    return `${prefix[asset.kind]}-${asset.id}.${extension}`;
  }
}
