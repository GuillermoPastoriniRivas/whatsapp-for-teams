import { buildMediaPayload } from './media-payload.builder.js';
import type { SendMessageParams } from '../../application/ports/messaging-api.port.js';
import { MessagingProvider } from '../../domain/enums/messaging-provider.enum.js';

const base: SendMessageParams = {
  provider: MessagingProvider.META,
  providerConfig: { accessToken: 'token' },
  phoneNumberId: '123',
  to: '549',
  type: 'image',
  billing: {
    tenantId: 't1',
    phoneNumberId: 'p1',
    conversationId: 'c1',
    contactId: 'ct1',
    destinationPhone: '549',
    senderKind: 'agent',
  },
};

describe('buildMediaPayload', () => {
  it('prioriza el media_id sobre el link', () => {
    const payload = buildMediaPayload({ ...base, mediaId: 'MID', mediaUrl: 'https://x/y.jpg' });
    expect(payload).toEqual({ id: 'MID' });
  });

  it('usa el link cuando no hay id (URLs externas del tenant)', () => {
    const payload = buildMediaPayload({ ...base, mediaUrl: 'https://x/y.jpg' });
    expect(payload).toEqual({ link: 'https://x/y.jpg' });
  });

  it('agrega el caption en imagen, video y documento', () => {
    expect(buildMediaPayload({ ...base, mediaId: 'MID', body: 'hola' })).toEqual({
      id: 'MID',
      caption: 'hola',
    });
    expect(buildMediaPayload({ ...base, type: 'video', mediaId: 'MID', body: 'hola' })).toEqual({
      id: 'MID',
      caption: 'hola',
    });
  });

  it('no manda caption en audio ni en sticker: el Cloud API los rechaza', () => {
    expect(buildMediaPayload({ ...base, type: 'audio', mediaId: 'MID', body: 'hola' })).toEqual({
      id: 'MID',
    });
    expect(buildMediaPayload({ ...base, type: 'sticker', mediaId: 'MID', body: 'hola' })).toEqual({
      id: 'MID',
    });
  });

  it('solo los documentos llevan filename', () => {
    expect(
      buildMediaPayload({ ...base, type: 'document', mediaId: 'MID', filename: 'a.pdf' }),
    ).toEqual({ id: 'MID', filename: 'a.pdf' });
    expect(buildMediaPayload({ ...base, mediaId: 'MID', filename: 'a.pdf' })).toEqual({ id: 'MID' });
  });

  it('devuelve null para mensajes que no son de media o sin referencia', () => {
    expect(buildMediaPayload({ ...base, type: 'text', body: 'hola' })).toBeNull();
    expect(buildMediaPayload({ ...base, type: 'image' })).toBeNull();
  });
});
