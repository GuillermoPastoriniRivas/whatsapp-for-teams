import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * Cifrado en reposo de las credenciales de proveedor que viven en
 * `phone_numbers.providerConfig` (el accessToken de Meta, el authToken de
 * Twilio, las apiKey de 360dialog y Kapso).
 *
 * Mismo esquema que `FlowSecretsService` — AES-256-GCM con formato
 * `base64(iv).base64(tag).base64(ciphertext)` — y **la misma key**
 * (`FLOW_SECRETS_KEY`), que es la clave de secretos-en-reposo de la app. Si
 * algun dia conviene separarlas, el unico cambio es `keyFor()`.
 *
 * `decryptProviderConfig` tolera valores en texto plano a proposito: durante
 * la migracion conviven documentos cifrados y sin cifrar, y una instancia con
 * codigo nuevo tiene que poder leer los dos. Sin esa tolerancia, desplegar
 * antes de migrar dejaria a la API sin poder enviar mensajes.
 */

/** Claves de `providerConfig` que son secretas. El resto son identificadores. */
const SECRET_KEYS = new Set(['accessToken', 'authToken', 'apiKey']);

let cachedKey: Buffer | null = null;

function keyFor(): Buffer {
  if (!cachedKey) {
    const secret = process.env.FLOW_SECRETS_KEY;
    if (!secret) {
      throw new Error('FLOW_SECRETS_KEY es necesaria para cifrar las credenciales de proveedor');
    }
    cachedKey = createHash('sha256').update(secret).digest();
  }
  return cachedKey;
}

/**
 * Un valor ya cifrado son tres partes base64 donde la primera decodifica a un
 * IV de 12 bytes y la segunda a un tag de 16. Chequear solo "tiene dos puntos"
 * daria falsos positivos con credenciales que contengan puntos.
 */
export function isEncrypted(value: string): boolean {
  const parts = value.split('.');
  if (parts.length !== 3) return false;
  try {
    return (
      Buffer.from(parts[0], 'base64').length === 12 &&
      Buffer.from(parts[1], 'base64').length === 16 &&
      Buffer.from(parts[2], 'base64').length > 0
    );
  } catch {
    return false;
  }
}

export function encryptValue(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFor(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
}

export function decryptValue(ciphertext: string): string {
  const [ivB64, tagB64, dataB64] = ciphertext.split('.');
  const decipher = createDecipheriv('aes-256-gcm', keyFor(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

/** Cifra las claves secretas que todavia esten en texto plano. Idempotente. */
export function encryptProviderConfig(
  config: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!config) return config;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(config)) {
    out[k] = SECRET_KEYS.has(k) && typeof v === 'string' && v && !isEncrypted(v) ? encryptValue(v) : v;
  }
  return out;
}

/** Descifra lo que este cifrado y deja pasar el resto tal cual. */
export function decryptProviderConfig(
  config: Record<string, string> | undefined,
): Record<string, string> {
  if (!config) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(config)) {
    out[k] = typeof v === 'string' && isEncrypted(v) ? decryptValue(v) : v;
  }
  return out;
}
