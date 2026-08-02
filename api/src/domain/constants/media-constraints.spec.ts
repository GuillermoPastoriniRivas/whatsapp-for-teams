import {
  isSupportedMimeType,
  isUnsafeInline,
  kindFromMimeType,
  mediaIdCacheExpiryFrom,
  metaExpiryFrom,
} from './media-constraints.js';
import { MediaKind } from '../enums/media-kind.enum.js';

describe('kindFromMimeType', () => {
  it('clasifica los tipos que acepta WhatsApp', () => {
    expect(kindFromMimeType('image/jpeg')).toBe(MediaKind.IMAGE);
    expect(kindFromMimeType('video/mp4')).toBe(MediaKind.VIDEO);
    expect(kindFromMimeType('audio/ogg')).toBe(MediaKind.AUDIO);
    expect(kindFromMimeType('application/pdf')).toBe(MediaKind.DOCUMENT);
  });

  it('image/webp es sticker, no imagen', () => {
    expect(kindFromMimeType('image/webp')).toBe(MediaKind.STICKER);
  });

  it('ignora los parámetros del header y el case', () => {
    expect(kindFromMimeType('IMAGE/JPEG; charset=binary')).toBe(MediaKind.IMAGE);
  });

  it('devuelve null para lo que WhatsApp no acepta', () => {
    expect(kindFromMimeType('image/gif')).toBeNull();
    expect(kindFromMimeType('image/heic')).toBeNull();
    expect(isSupportedMimeType('image/gif')).toBe(false);
  });
});

describe('isUnsafeInline', () => {
  it('marca los tipos que serían XSS almacenado si se sirven inline', () => {
    expect(isUnsafeInline('image/svg+xml')).toBe(true);
    expect(isUnsafeInline('text/html; charset=utf-8')).toBe(true);
    expect(isUnsafeInline('application/javascript')).toBe(true);
  });

  it('no molesta a los tipos normales', () => {
    expect(isUnsafeInline('image/png')).toBe(false);
    expect(isUnsafeInline('application/pdf')).toBe(false);
  });
});

describe('vencimientos', () => {
  const receivedAt = new Date('2026-08-02T12:00:00Z');

  it('Meta retiene 30 días desde la recepción', () => {
    expect(metaExpiryFrom(receivedAt).toISOString()).toBe('2026-09-01T12:00:00.000Z');
  });

  it('la caché del media_id corta 5 días antes, para no mandar uno vencido', () => {
    expect(mediaIdCacheExpiryFrom(receivedAt).toISOString()).toBe('2026-08-27T12:00:00.000Z');
    expect(mediaIdCacheExpiryFrom(receivedAt).getTime()).toBeLessThan(
      metaExpiryFrom(receivedAt).getTime(),
    );
  });
});
