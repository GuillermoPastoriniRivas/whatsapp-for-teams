import { classifyMediaDownloadError } from './meta-media-api.service.js';
import { MediaGoneAtSourceError } from '../../application/ports/media-provider.port.js';
import { MetaApiError } from './meta-api-error.js';

const MEDIA_ID = '2340958462976830';

describe('classifyMediaDownloadError', () => {
  it('da el archivo por perdido solo con la señal explícita de Meta', () => {
    const body = JSON.stringify({
      error: {
        message: `Unsupported get request. Object with ID '${MEDIA_ID}' does not exist`,
        type: 'GraphMethodException',
        code: 100,
        error_subcode: 33,
      },
    });
    expect(classifyMediaDownloadError(MEDIA_ID, 400, body)).toBeInstanceOf(MediaGoneAtSourceError);
  });

  it('un 410 tambien cuenta como perdido', () => {
    expect(classifyMediaDownloadError(MEDIA_ID, 410, '')).toBeInstanceOf(MediaGoneAtSourceError);
  });

  /**
   * El caso que rompió en producción: Kapso responde 404 cuando le falta el
   * phone_number_id. Tomarlo como "expirado" daba por perdido un audio de hacía
   * minutos y le echaba la culpa a WhatsApp.
   */
  it('el 404 de "WhatsApp configuration not found" de Kapso NO es un archivo perdido', () => {
    const error = classifyMediaDownloadError(
      MEDIA_ID,
      404,
      JSON.stringify({ error: 'WhatsApp configuration not found' }),
    );
    expect(error).not.toBeInstanceOf(MediaGoneAtSourceError);
  });

  it('un 400 pelado no es un archivo perdido', () => {
    expect(classifyMediaDownloadError(MEDIA_ID, 400, '')).not.toBeInstanceOf(MediaGoneAtSourceError);
  });

  it('un token vencido no es un archivo perdido', () => {
    const body = JSON.stringify({
      error: { message: 'Error validating access token', code: 190 },
    });
    const error = classifyMediaDownloadError(MEDIA_ID, 401, body);
    expect(error).not.toBeInstanceOf(MediaGoneAtSourceError);
    expect(error).toBeInstanceOf(MetaApiError);
  });

  it('un 500 del proveedor es transitorio y reintentable', () => {
    const error = classifyMediaDownloadError(MEDIA_ID, 500, '<html>oops</html>');
    expect(error).not.toBeInstanceOf(MediaGoneAtSourceError);
    expect((error as MetaApiError).retryable).toBe(true);
  });

  it('un code 100 sin el subcode 33 no alcanza', () => {
    const body = JSON.stringify({ error: { message: 'Invalid parameter', code: 100 } });
    expect(classifyMediaDownloadError(MEDIA_ID, 400, body)).not.toBeInstanceOf(
      MediaGoneAtSourceError,
    );
  });
});
