import type { MediaAsset, MediaKind } from "@/types";

export function formatBytes(bytes: number): string {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exponent);
  return `${value >= 10 || exponent === 0 ? Math.round(value) : value.toFixed(1)} ${units[exponent]}`;
}

export function formatDuration(ms: number | null): string | null {
  if (!ms) return null;
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** Días que le quedan al archivo antes de que WhatsApp lo descarte. */
export function daysUntilExpiry(asset: MediaAsset): number | null {
  if (!asset.temporary || !asset.expiresAt) return null;
  const remaining = new Date(asset.expiresAt).getTime() - Date.now();
  return remaining <= 0 ? 0 : Math.ceil(remaining / (24 * 60 * 60 * 1000));
}

export const MEDIA_KIND_LABELS: Record<MediaKind, { es: string; en: string }> = {
  image: { es: "Imagen", en: "Image" },
  video: { es: "Video", en: "Video" },
  audio: { es: "Audio", en: "Audio" },
  document: { es: "Documento", en: "Document" },
  sticker: { es: "Sticker", en: "Sticker" },
};

/**
 * Lo que WhatsApp acepta. El input filtra por acá para que el agente no elija
 * un archivo que va a fallar tres pasos después.
 */
export const ACCEPTED_UPLOAD_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/3gpp",
  "audio/aac",
  "audio/mp4",
  "audio/mpeg",
  "audio/amr",
  "audio/ogg",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
].join(",");

const SIZE_LIMITS: Record<MediaKind, number> = {
  image: 5 * 1024 * 1024,
  video: 16 * 1024 * 1024,
  audio: 16 * 1024 * 1024,
  document: 100 * 1024 * 1024,
  sticker: 500 * 1024,
};

export function kindFromMimeType(mimeType: string): MediaKind {
  if (mimeType === "image/webp") return "sticker";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return "document";
}

/**
 * Validación previa en el cliente: mejor decirlo antes de subir 30 MB para
 * después rechazarlos. El servidor vuelve a validar igual.
 */
export function validateUpload(file: File): string | null {
  const kind = kindFromMimeType(file.type);
  const limit = SIZE_LIMITS[kind];

  if (file.type === "image/heic" || file.type === "image/heif" || /\.hei[cf]$/i.test(file.name)) {
    return "WhatsApp no acepta fotos HEIC. Convertila a JPG antes de enviarla.";
  }
  if (file.type === "image/gif" || /\.gif$/i.test(file.name)) {
    return "WhatsApp no acepta GIF. Convertilo a MP4 para poder enviarlo.";
  }
  // Las imágenes grandes las recomprime el servidor; el resto no.
  if (kind !== "image" && file.size > limit) {
    return `El archivo pesa ${formatBytes(file.size)} y WhatsApp acepta hasta ${formatBytes(limit)} para ${MEDIA_KIND_LABELS[kind].es.toLowerCase()}s.`;
  }
  return null;
}
