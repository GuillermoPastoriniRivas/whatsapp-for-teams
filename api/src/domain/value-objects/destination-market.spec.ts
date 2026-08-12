import { resolveDestinationMarket } from './destination-market.js';

describe('resolveDestinationMarket', () => {
  it('resuelve los mercados grandes de WhatsApp', () => {
    expect(resolveDestinationMarket('5491155551001').country).toBe('AR');
    expect(resolveDestinationMarket('5511987654321').country).toBe('BR');
    expect(resolveDestinationMarket('919876543210').country).toBe('IN');
    expect(resolveDestinationMarket('34612345678').country).toBe('ES');
    expect(resolveDestinationMarket('442071838750').country).toBe('GB');
    expect(resolveDestinationMarket('6281234567890').country).toBe('ID');
  });

  it('distingue países que comparten prefijo', () => {
    // El motivo de usar libphonenumber con metadata completa: una tabla de
    // prefijos manda todos estos al mismo lado, y son tarifas distintas.
    expect(resolveDestinationMarket('12125550100').country).toBe('US');
    expect(resolveDestinationMarket('14165550100').country).toBe('CA');
    expect(resolveDestinationMarket('18095550100').country).toBe('DO');
    // +44 no es sólo Reino Unido: este rango es de Guernsey.
    expect(resolveDestinationMarket('447911123456').country).toBe('GG');
  });

  it('guarda el prefijo aunque el número no sea válido', () => {
    // Un número que libphonenumber da por inválido igual se entregó y se cobró:
    // el prefijo alcanza para tarifar y para recalcular después.
    const market = resolveDestinationMarket('5400');
    expect(market.prefix).toBe('54');
  });

  it('cae al ISO-2 del BSUID cuando el contacto no tiene teléfono', () => {
    expect(resolveDestinationMarket(null, 'US.13491208655302741918')).toEqual({
      country: 'US',
      prefix: null,
    });
    expect(resolveDestinationMarket(null, 'AR.ENT.1349')).toEqual({ country: 'AR', prefix: null });
  });

  it('no inventa un mercado cuando no hay con qué', () => {
    expect(resolveDestinationMarket(null, null)).toEqual({ country: null, prefix: null });
    expect(resolveDestinationMarket('', 'no-es-un-bsuid')).toEqual({ country: null, prefix: null });
  });
});
