import { MediaProviderRef } from '../entities/media-provider-ref.entity.js';

export interface UpsertMediaProviderRefInput {
  assetId: string;
  phoneNumberId: string;
  providerMediaId: string;
  expiresAt: Date;
}

export interface MediaProviderRefRepository {
  /** Devuelve la referencia solo si sigue vigente. */
  findValid(assetId: string, phoneNumberId: string, now: Date): Promise<MediaProviderRef | null>;
  upsert(input: UpsertMediaProviderRefInput): Promise<MediaProviderRef>;
  deleteByAssetId(assetId: string): Promise<void>;
}
