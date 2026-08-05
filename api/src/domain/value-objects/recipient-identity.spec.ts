import { isBsuid, isBsuidOnly, isRoutable, recipientIdentityOf, templateRequiresPhone } from './recipient-identity.js';

describe('recipientIdentityOf', () => {
  it('manda los dos ejes cuando se conocen ambos', () => {
    // Meta le da precedencia a `to`, y dejar el BSUID puesto sirve de respaldo
    // si el teléfono quedó viejo.
    expect(recipientIdentityOf({ phone: '5491155551001', bsuid: 'US.1349' })).toEqual({
      to: '5491155551001',
      recipient: 'US.1349',
    });
  });

  it('omite el teléfono en vez de mandarlo vacío', () => {
    expect(recipientIdentityOf({ phone: null, bsuid: 'US.1349' })).toEqual({ recipient: 'US.1349' });
  });

  it('omite el BSUID para un contacto que solo tiene teléfono', () => {
    expect(recipientIdentityOf({ phone: '5491155551001', bsuid: null })).toEqual({ to: '5491155551001' });
  });

  it('no es ruteable sin ningún eje', () => {
    expect(isRoutable(recipientIdentityOf({ phone: null, bsuid: null }))).toBe(false);
  });
});

describe('isBsuidOnly', () => {
  it('detecta el destino que exige soporte de `recipient`', () => {
    expect(isBsuidOnly({ recipient: 'US.1349' })).toBe(true);
    expect(isBsuidOnly({ to: '549', recipient: 'US.1349' })).toBe(false);
    expect(isBsuidOnly({ to: '549' })).toBe(false);
  });
});

describe('isBsuid', () => {
  it('acepta el formato de Meta, con y sin ENT', () => {
    expect(isBsuid('US.13491208655302741918')).toBe(true);
    expect(isBsuid('US.ENT.11815799212886844830')).toBe(true);
  });

  it('rechaza un teléfono', () => {
    expect(isBsuid('5491155551001')).toBe(false);
  });
});

describe('templateRequiresPhone', () => {
  it('marca las de autenticación, que Meta rechaza contra un BSUID (131062)', () => {
    expect(templateRequiresPhone('authentication')).toBe(true);
  });

  it('deja pasar utility y marketing', () => {
    expect(templateRequiresPhone('utility')).toBe(false);
    expect(templateRequiresPhone('marketing')).toBe(false);
  });

  it('el guard solo aplica cuando no hay teléfono', () => {
    // Con teléfono disponible Meta usa `to` y la plantilla de auth entra bien,
    // aunque el contacto también tenga BSUID.
    const conTelefono = recipientIdentityOf({ phone: '5491155551001', bsuid: 'US.1349' });
    expect(isBsuidOnly(conTelefono) && templateRequiresPhone('authentication')).toBe(false);

    const soloBsuid = recipientIdentityOf({ phone: null, bsuid: 'US.1349' });
    expect(isBsuidOnly(soloBsuid) && templateRequiresPhone('authentication')).toBe(true);
  });
});
