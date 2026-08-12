export const FIRST_TOUCH_STORAGE_KEY = "asis-first-touch";

export interface FirstTouchAttribution {
  channel: string;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  referrerHost: string | null;
  landingPath: string;
  arrivedAt: string;
}

const REFERRER_HOST_TO_CHANNEL: Record<string, string> = {
  "pulsemcp.com": "mcp-directory",
  "www.pulsemcp.com": "mcp-directory",
  "smithery.ai": "mcp-directory",
  "glama.ai": "mcp-directory",
  "mcp.so": "mcp-directory",
  "registry.modelcontextprotocol.io": "mcp-registry",
  "claude.ai": "claude",
  "claude.com": "claude",
  "chatgpt.com": "chatgpt",
  "n8n.io": "n8n",
  "community.n8n.io": "n8n",
  "github.com": "github",
  "www.workana.com": "freelance-marketplace",
  "www.upwork.com": "freelance-marketplace",
};

const SEARCH_ENGINE_HOST_FRAGMENTS = ["google.", "bing.", "duckduckgo.", "ecosia.", "yahoo."];

function channelFor(source: string | null, referrerHost: string | null): string {
  if (source) return source;
  if (!referrerHost) return "direct";
  const known = REFERRER_HOST_TO_CHANNEL[referrerHost];
  if (known) return known;
  if (SEARCH_ENGINE_HOST_FRAGMENTS.some((fragment) => referrerHost.includes(fragment))) return "organic-search";
  return "referral";
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export function readFirstTouchAttribution(): FirstTouchAttribution | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(FIRST_TOUCH_STORAGE_KEY);
    return stored ? (JSON.parse(stored) as FirstTouchAttribution) : null;
  } catch {
    return null;
  }
}

export function captureFirstTouchAttribution(): FirstTouchAttribution | null {
  if (typeof window === "undefined") return null;

  const alreadyAttributed = readFirstTouchAttribution();
  if (alreadyAttributed) return alreadyAttributed;

  try {
    const params = new URLSearchParams(window.location.search);
    const referrerHost = document.referrer ? hostOf(document.referrer) : null;
    const isSelfReferral = referrerHost === window.location.hostname;
    const source = params.get("utm_source") ?? params.get("ref");

    const attribution: FirstTouchAttribution = {
      channel: channelFor(source, isSelfReferral ? null : referrerHost),
      source,
      medium: params.get("utm_medium"),
      campaign: params.get("utm_campaign"),
      referrerHost: isSelfReferral ? null : referrerHost,
      landingPath: window.location.pathname,
      arrivedAt: new Date().toISOString(),
    };

    window.localStorage.setItem(FIRST_TOUCH_STORAGE_KEY, JSON.stringify(attribution));
    return attribution;
  } catch {
    return null;
  }
}
