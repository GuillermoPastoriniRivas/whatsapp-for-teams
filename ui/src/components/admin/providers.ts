export type Provider = "meta";

export const PROVIDERS: Provider[] = ["meta"];

/** Nombre comercial, tal como lo escribe cada marca. */
export const PROVIDER_LABELS: Record<Provider, string> = {
  meta: "Meta",
};

/**
 * Credenciales que pide el proveedor. Las etiquetas son los nombres exactos de
 * su API, así que no se traducen.
 */
export const PROVIDER_CONFIG_FIELDS: Record<Provider, { key: string; label: string }[]> = {
  // El App ID solo hace falta para cambiar la foto del perfil: la subida
  // reanudable de Meta cuelga de la app dueña del token. El resto funciona sin él.
  meta: [
    { key: "accessToken", label: "Access Token" },
    { key: "appId", label: "App ID" },
  ],
};
