/**
 * Meta Graph API error classified by how the caller should react:
 * - 'rate_limit': transient throttling — retry later without consuming attempts.
 * - 'recipient': permanent for this recipient (bad number, opt-out, param mismatch) — fail the recipient only.
 * - 'campaign': the whole send channel is broken (invalid token, template paused/deleted) — stop the campaign.
 */
export type MetaErrorSeverity = 'rate_limit' | 'recipient' | 'campaign';

export interface MetaErrorBody {
  error?: {
    code?: number;
    error_subcode?: number;
    message?: string;
    error_data?: { details?: string };
  };
}

export class MetaApiError extends Error {
  constructor(
    public readonly code: number,
    public readonly subcode: number | null,
    public readonly title: string,
    public readonly retryable: boolean,
    public readonly severity: MetaErrorSeverity,
    public readonly httpStatus: number,
  ) {
    super(`Meta API error ${code}: ${title}`);
    this.name = 'MetaApiError';
  }
}

const RATE_LIMIT_CODES = new Set([4, 80007, 130429, 131048, 131056]);

const RECIPIENT_CODES = new Set([
  100, // invalid parameter
  131008, // required parameter missing
  131009, // parameter value not valid
  131021, // recipient cannot be sender
  131026, // message undeliverable / not a WhatsApp user
  131047, // re-engagement message (outside 24h window without template)
  131049, // marketing message limit per user (Meta healthy-ecosystem cap)
  130472, // user's number is part of a Meta experiment
  132000, // template parameter count mismatch
]);

const CAMPAIGN_CODES = new Set([
  0, // auth exception
  190, // access token expired/invalid
  132001, // template does not exist or not approved
  132005, // template hydrated text too long
  132007, // template format policy violation
  132015, // template is paused
  132016, // template is disabled
  133010, // phone number not registered on Cloud API
]);

export function classifyMetaError(httpStatus: number, body: MetaErrorBody | null): MetaApiError {
  const code = body?.error?.code ?? -1;
  const subcode = body?.error?.error_subcode ?? null;
  const title = body?.error?.error_data?.details ?? body?.error?.message ?? `HTTP ${httpStatus}`;

  if (RATE_LIMIT_CODES.has(code)) {
    return new MetaApiError(code, subcode, title, true, 'rate_limit', httpStatus);
  }
  if (RECIPIENT_CODES.has(code)) {
    return new MetaApiError(code, subcode, title, false, 'recipient', httpStatus);
  }
  if (CAMPAIGN_CODES.has(code)) {
    return new MetaApiError(code, subcode, title, false, 'campaign', httpStatus);
  }
  // Unknown application error on a 4xx: treat as recipient-level and non-retryable.
  if (httpStatus >= 400 && httpStatus < 500 && code !== -1) {
    return new MetaApiError(code, subcode, title, false, 'recipient', httpStatus);
  }
  // 5xx / unparseable: transient on Meta's side.
  return new MetaApiError(code, subcode, title, true, 'rate_limit', httpStatus);
}
