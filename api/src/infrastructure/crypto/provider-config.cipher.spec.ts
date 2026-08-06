import {
  decryptProviderConfig,
  encryptProviderConfig,
  isEncrypted,
} from './provider-config.cipher.js';

describe('provider-config.cipher', () => {
  const OLD = process.env.FLOW_SECRETS_KEY;
  beforeAll(() => {
    process.env.FLOW_SECRETS_KEY = 'clave-de-prueba';
  });
  afterAll(() => {
    process.env.FLOW_SECRETS_KEY = OLD;
  });

  it('cifra las claves secretas y deja los identificadores en claro', () => {
    const enc = encryptProviderConfig({
      accessToken: 'EAAsecreto',
      accountSid: 'AC123',
      fromNumber: '+59899260680',
    })!;

    expect(enc.accessToken).not.toBe('EAAsecreto');
    expect(isEncrypted(enc.accessToken)).toBe(true);
    // accountSid y fromNumber son identificadores, no secretos
    expect(enc.accountSid).toBe('AC123');
    expect(enc.fromNumber).toBe('+59899260680');
  });

  it('el ida y vuelta devuelve el valor original', () => {
    const original = { accessToken: 'EAAsecreto', apiKey: 'k-123', accountSid: 'AC1' };
    expect(decryptProviderConfig(encryptProviderConfig(original))).toEqual(original);
  });

  it('es idempotente: cifrar dos veces no vuelve a cifrar', () => {
    const once = encryptProviderConfig({ accessToken: 'EAAsecreto' })!;
    const twice = encryptProviderConfig(once)!;
    expect(twice.accessToken).toBe(once.accessToken);
  });

  /**
   * El caso que hace segura la migracion: una instancia con codigo nuevo tiene
   * que poder leer documentos que todavia no se migraron. Sin esto, desplegar
   * antes de migrar deja a la API sin poder enviar mensajes.
   */
  it('deja pasar los valores en texto plano sin migrar', () => {
    expect(decryptProviderConfig({ accessToken: 'EAAtodaviaEnClaro' })).toEqual({
      accessToken: 'EAAtodaviaEnClaro',
    });
  });

  it('no confunde una credencial con puntos con un valor cifrado', () => {
    const conPuntos = 'abc.def.ghi';
    expect(isEncrypted(conPuntos)).toBe(false);
    expect(decryptProviderConfig({ accessToken: conPuntos })).toEqual({ accessToken: conPuntos });
  });

  it('tolera un providerConfig ausente', () => {
    expect(decryptProviderConfig(undefined)).toEqual({});
    expect(encryptProviderConfig(undefined)).toBeUndefined();
  });
});
