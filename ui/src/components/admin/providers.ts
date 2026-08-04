export type Provider = "meta" | "twilio" | "360dialog" | "kapso";

export const PROVIDERS: Provider[] = ["meta", "twilio", "360dialog", "kapso"];

/** Nombre comercial, tal como lo escribe cada marca. */
export const PROVIDER_LABELS: Record<Provider, string> = {
  meta: "Meta",
  twilio: "Twilio",
  "360dialog": "360dialog",
  kapso: "Kapso",
};

/**
 * Credenciales que pide cada proveedor. Las etiquetas son los nombres exactos
 * de su API (Meta, Twilio…), así que no se traducen.
 */
export const PROVIDER_CONFIG_FIELDS: Record<Provider, { key: string; label: string }[]> = {
  meta: [{ key: "accessToken", label: "Access Token" }],
  twilio: [
    { key: "accountSid", label: "Account SID" },
    { key: "authToken", label: "Auth Token" },
    { key: "fromNumber", label: "From Number" },
  ],
  "360dialog": [{ key: "apiKey", label: "API Key" }],
  kapso: [{ key: "apiKey", label: "API Key" }],
};
