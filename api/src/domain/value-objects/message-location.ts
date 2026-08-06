/**
 * Ubicación compartida por un contacto.
 *
 * Se guarda estructurada y no aplastada en `body`: con las coordenadas sueltas
 * en texto el inbox mostraba "-34.62,-54.15" y no había forma de dibujar un
 * mapa ni de abrir la ubicación en una app externa.
 */
export interface MessageLocation {
  latitude: number;
  longitude: number;
  /** Nombre del lugar, cuando el usuario comparte un POI y no un pin suelto. */
  name?: string | null;
  address?: string | null;
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/**
 * Normaliza lo que llega del proveedor. Devuelve `null` si las coordenadas no
 * son usables: un pin fuera de rango es un dato roto, y prefiero perder el
 * mapa antes que dibujar un punto en medio del océano.
 */
export function toMessageLocation(input: {
  latitude?: unknown;
  longitude?: unknown;
  name?: unknown;
  address?: unknown;
}): MessageLocation | null {
  const latitude = typeof input.latitude === 'string' ? Number(input.latitude) : input.latitude;
  const longitude = typeof input.longitude === 'string' ? Number(input.longitude) : input.longitude;

  if (!isFiniteNumber(latitude) || !isFiniteNumber(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;

  const text = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  };

  return {
    latitude,
    longitude,
    name: text(input.name),
    address: text(input.address),
  };
}

/**
 * Texto plano de una ubicación, para los canales que no dibujan un mapa: el
 * preview del listado, el transcript que lee la IA y la API pública.
 */
export function formatLocation(location: MessageLocation): string {
  const label = [location.name, location.address].filter(Boolean).join(', ');
  const coords = `${location.latitude}, ${location.longitude}`;
  return label ? `${label} (${coords})` : coords;
}
