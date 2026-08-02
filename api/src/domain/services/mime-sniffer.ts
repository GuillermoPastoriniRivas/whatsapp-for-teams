/**
 * Detección de tipo por magic bytes.
 *
 * Nunca se confía en el `Content-Type` declarado ni en la extensión: un archivo
 * que dice ser `image/jpeg` y en realidad es HTML es XSS almacenado esperando a
 * que alguien lo abra.
 *
 * Cubre lo que WhatsApp acepta más los formatos que hay que poder reconocer
 * para rechazarlos con un mensaje claro (webp, gif, heic).
 */

interface Signature {
  mimeType: string;
  offset: number;
  bytes: number[];
  /** Chequeo extra sobre el buffer completo (contenedores como RIFF o ISO-BMFF). */
  verify?: (buffer: Buffer) => boolean;
}

const SIGNATURES: Signature[] = [
  { mimeType: 'image/jpeg', offset: 0, bytes: [0xff, 0xd8, 0xff] },
  { mimeType: 'image/png', offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mimeType: 'image/gif', offset: 0, bytes: [0x47, 0x49, 0x46, 0x38] },
  {
    mimeType: 'image/webp',
    offset: 0,
    bytes: [0x52, 0x49, 0x46, 0x46], // RIFF
    verify: (buffer) => buffer.subarray(8, 12).toString('ascii') === 'WEBP',
  },
  { mimeType: 'application/pdf', offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] },
  { mimeType: 'audio/ogg', offset: 0, bytes: [0x4f, 0x67, 0x67, 0x53] },
  { mimeType: 'audio/mpeg', offset: 0, bytes: [0x49, 0x44, 0x33] }, // ID3
  { mimeType: 'audio/mpeg', offset: 0, bytes: [0xff, 0xfb] },
  { mimeType: 'audio/amr', offset: 0, bytes: [0x23, 0x21, 0x41, 0x4d, 0x52] }, // #!AMR
  // Office moderno y cualquier otro zip; se afina con la extensión declarada.
  { mimeType: 'application/zip', offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] },
  { mimeType: 'application/msword', offset: 0, bytes: [0xd0, 0xcf, 0x11, 0xe0] },
];

/** Marcas de ISO-BMFF (mp4/3gp/heic) que viven después de `ftyp`. */
const FTYP_BRANDS: Record<string, string> = {
  isom: 'video/mp4',
  iso2: 'video/mp4',
  mp41: 'video/mp4',
  mp42: 'video/mp4',
  avc1: 'video/mp4',
  M4V: 'video/mp4',
  M4A: 'audio/mp4',
  '3gp': 'video/3gpp',
  '3g2': 'video/3gpp',
  qt: 'video/quicktime',
  heic: 'image/heic',
  heix: 'image/heic',
  hevc: 'image/heic',
  mif1: 'image/heif',
};

export function detectMimeType(buffer: Buffer): string | null {
  if (buffer.byteLength < 12) return null;

  // ISO-BMFF: 'ftyp' en el offset 4, marca en el 8.
  if (buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = buffer.subarray(8, 12).toString('ascii').trim();
    const exact = FTYP_BRANDS[brand];
    if (exact) return exact;
    if (brand.startsWith('3g')) return 'video/3gpp';
    return 'video/mp4';
  }

  for (const signature of SIGNATURES) {
    const slice = buffer.subarray(signature.offset, signature.offset + signature.bytes.length);
    if (slice.length !== signature.bytes.length) continue;
    if (!signature.bytes.every((byte, index) => slice[index] === byte)) continue;
    if (signature.verify && !signature.verify(buffer)) continue;
    return signature.mimeType;
  }

  return null;
}

const OOXML_BY_EXTENSION: Record<string, string> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

/**
 * Tipo definitivo del archivo: manda lo que dicen los bytes, con dos matices.
 *
 * - Los OOXML son zips: los magic bytes no los distinguen entre sí, así que ahí
 *   sí se usa la extensión (siempre que el declarado también sea OOXML).
 * - Si los bytes no dicen nada (texto plano, por ejemplo) se cae al declarado.
 */
export function resolveMimeType(
  buffer: Buffer,
  declaredMimeType: string | null,
  filename: string | null,
): string {
  const detected = detectMimeType(buffer);
  const declared = declaredMimeType?.split(';')[0].trim().toLowerCase() ?? null;

  if (detected === 'application/zip') {
    const extension = filename?.split('.').pop()?.toLowerCase() ?? '';
    const byExtension = OOXML_BY_EXTENSION[extension];
    if (byExtension) return byExtension;
    // Sin extensión útil, el declarado solo vale si también dice OOXML: un zip
    // que dice ser octet-stream es un zip, y así lo rechaza el allowlist.
    return declared?.includes('openxmlformats') ? declared : 'application/zip';
  }

  if (detected) return detected;
  return declared ?? 'application/octet-stream';
}
