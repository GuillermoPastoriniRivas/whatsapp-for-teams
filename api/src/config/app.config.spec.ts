import appConfig from './app.config.js';

/**
 * ConfigModule carga el `.env` en `process.env` recién antes de invocar el
 * factory. Si alguna variable se lee a nivel de módulo, se evalúa al importar
 * el archivo —cuando `process.env` todavía no tiene nada del `.env`— y se queda
 * pegada al default para siempre.
 */
describe('appConfig', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it('lee PORT en el momento de invocar el factory, no al importar el módulo', () => {
    process.env.PORT = '3007';
    expect(appConfig().port).toBe(3007);

    process.env.PORT = '4001';
    expect(appConfig().port).toBe(4001);
  });

  it('cae al 3000 solo cuando PORT no está definido', () => {
    delete process.env.PORT;
    expect(appConfig().port).toBe(3000);
  });

  it('arma apiUrl con el puerto real', () => {
    delete process.env.API_PUBLIC_URL;
    process.env.PORT = '3007';
    expect(appConfig().apiUrl).toBe('http://localhost:3007');
  });

  it('API_PUBLIC_URL le gana al default de localhost', () => {
    process.env.API_PUBLIC_URL = 'https://asis.chat';
    expect(appConfig().apiUrl).toBe('https://asis.chat');
  });

  it('media.publicBaseUrl cae a apiUrl salvo que haya un dominio propio', () => {
    process.env.API_PUBLIC_URL = 'https://asis.chat';
    delete process.env.MEDIA_PUBLIC_BASE_URL;
    expect(appConfig().media.publicBaseUrl).toBe('https://asis.chat');

    process.env.MEDIA_PUBLIC_BASE_URL = 'https://media.asis.chat';
    expect(appConfig().media.publicBaseUrl).toBe('https://media.asis.chat');
  });
});
