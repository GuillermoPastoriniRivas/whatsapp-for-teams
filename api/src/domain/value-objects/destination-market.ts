// `/max` y no el import por defecto: la metadata mínima no alcanza para
// desambiguar los prefijos compartidos. Con ella, +44 devuelve null (Reino
// Unido, Guernsey, Jersey e Isla de Man lo comparten) y +1 no separa Estados
// Unidos de Canadá ni del Caribe. Acá el peso del bundle no importa —esto corre
// en el servidor— y devolver el país equivocado sí.
import { getCountries, getCountryCallingCode, parsePhoneNumberFromString } from 'libphonenumber-js/max';

// ── De qué mercado es el destinatario ────────────────────────────
//
// Meta tarifa por **mercado del usuario**, no por el de la empresa: el mismo
// mensaje a Brasil y a India cuesta distinto. Sin esto no hay precio posible.
//
// Se usa libphonenumber y no una tabla de prefijos propia porque el mapa no es
// un prefijo por país: +1 cubre Estados Unidos, Canadá y una docena de países
// del Caribe, cada uno con su tarifa, y sólo se distinguen por el código de
// área. Una tabla hecha a mano ahí devuelve el país equivocado en silencio, que
// es la peor forma de fallar para algo que después se convierte en plata.

export interface DestinationMarket {
  /** ISO-2 en mayúsculas. Null = no se pudo resolver. */
  country: string | null;
  /** Código de país (`54`, `1`, `91`). Se guarda igual aunque falle el ISO-2. */
  prefix: string | null;
}

const UNKNOWN: DestinationMarket = { country: null, prefix: null };

/** `US.13491208…` — el BSUID arranca con el ISO-2 del usuario. */
const BSUID_COUNTRY = /^([A-Z]{2})\./;

/**
 * Códigos de país válidos, del más largo al más corto, sacados de la misma
 * metadata de libphonenumber. No es una tabla a mano: se regenera sola cuando
 * se actualiza la librería.
 */
const CALLING_CODES: string[] = Array.from(
  new Set(getCountries().map((country) => getCountryCallingCode(country) as string)),
).sort((a, b) => b.length - a.length);

/** El prefijo más largo que matchea. `1876` (Jamaica) antes que `1`. */
function extractCallingCode(digits: string): string | null {
  return CALLING_CODES.find((code) => digits.startsWith(code)) ?? null;
}

/**
 * Resuelve el mercado a partir del teléfono y, si no hay, del BSUID.
 *
 * El prefijo se devuelve **siempre que se pueda**, incluso cuando el ISO-2 no
 * se resuelve: un número que libphonenumber da por inválido igual se entregó y
 * se cobró, y con el prefijo crudo guardado se puede recalcular hacia atrás.
 * Sin él, el dato está perdido.
 */
export function resolveDestinationMarket(
  phone: string | null | undefined,
  bsuid?: string | null,
): DestinationMarket {
  const digits = (phone ?? '').replace(/\D/g, '');

  if (digits) {
    // Los teléfonos se guardan en dígitos E.164 sin '+', y libphonenumber lo
    // necesita para no tener que adivinar el país por defecto.
    const parsed = parsePhoneNumberFromString(`+${digits}`);
    const country = parsed?.country ?? null;
    const prefix = parsed?.countryCallingCode
      ? String(parsed.countryCallingCode)
      : extractCallingCode(digits);

    if (country || prefix) return { country, prefix };
  }

  if (bsuid) {
    const match = BSUID_COUNTRY.exec(bsuid);
    // Es lo único que tenemos de quien sólo comparte su username. No da el
    // prefijo, pero el país alcanza para tarifar.
    if (match) return { country: match[1], prefix: null };
  }

  return UNKNOWN;
}
