export type ReferralSourceType = 'ad' | 'post';

export type ReferralMediaType = 'image' | 'video';

export interface MessageReferral {
  sourceType: ReferralSourceType;
  sourceId: string;
  sourceUrl: string | null;
  headline: string | null;
  body: string | null;
  mediaType: ReferralMediaType | null;
  imageUrl: string | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  ctwaClid: string | null;
}

export interface ConversationAttribution extends MessageReferral {
  capturedAt: Date;
  waMessageId: string;
}

export interface RawMetaReferral {
  source_type?: unknown;
  source_id?: unknown;
  source_url?: unknown;
  headline?: unknown;
  body?: unknown;
  media_type?: unknown;
  image_url?: unknown;
  video_url?: unknown;
  thumbnail_url?: unknown;
  ctwa_clid?: unknown;
}

const textOrNull = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const toSourceType = (value: unknown): ReferralSourceType =>
  textOrNull(value)?.toLowerCase() === 'post' ? 'post' : 'ad';

const toMediaType = (value: unknown): ReferralMediaType | null => {
  const normalized = textOrNull(value)?.toLowerCase();
  if (normalized === 'image' || normalized === 'video') return normalized;
  return null;
};

export function toMessageReferral(input: RawMetaReferral | null | undefined): MessageReferral | null {
  if (!input || typeof input !== 'object') return null;

  const sourceId = textOrNull(input.source_id);
  if (!sourceId) return null;

  return {
    sourceType: toSourceType(input.source_type),
    sourceId,
    sourceUrl: textOrNull(input.source_url),
    headline: textOrNull(input.headline),
    body: textOrNull(input.body),
    mediaType: toMediaType(input.media_type),
    imageUrl: textOrNull(input.image_url),
    videoUrl: textOrNull(input.video_url),
    thumbnailUrl: textOrNull(input.thumbnail_url),
    ctwaClid: textOrNull(input.ctwa_clid),
  };
}

export function toConversationAttribution(
  referral: MessageReferral,
  waMessageId: string,
  capturedAt: Date,
): ConversationAttribution {
  return { ...referral, waMessageId, capturedAt };
}

export function referralLabel(referral: MessageReferral): string {
  return referral.headline ?? referral.body ?? referral.sourceId;
}

export function adVariables(
  attribution: ConversationAttribution | null | undefined,
): Record<string, unknown> | null {
  if (!attribution) return null;
  return {
    sourceType: attribution.sourceType,
    sourceId: attribution.sourceId,
    sourceUrl: attribution.sourceUrl,
    headline: attribution.headline,
    body: attribution.body,
    label: referralLabel(attribution),
    clickId: attribution.ctwaClid,
  };
}
