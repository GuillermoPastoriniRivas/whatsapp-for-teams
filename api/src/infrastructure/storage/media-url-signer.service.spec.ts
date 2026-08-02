import { ConfigService } from '@nestjs/config';
import { MediaUrlSignerService } from './media-url-signer.service.js';

function makeSigner(secret = 'un-secreto-de-prueba') {
  const config = {
    get: (key: string) =>
      key === 'media.urlSecret' ? secret : 'https://media.asis.chat/',
  } as unknown as ConfigService;
  return new MediaUrlSignerService(config);
}

describe('MediaUrlSignerService', () => {
  it('firma y verifica ida y vuelta', () => {
    const signer = makeSigner();
    const signed = signer.sign({ assetId: 'abc123', variant: 'raw', download: false }, 900);

    const token = new URL(signed.url).searchParams.get('t')!;
    expect(signer.verify(token)).toEqual({ assetId: 'abc123', variant: 'raw', download: false });
  });

  it('arma la URL contra el dominio de media, sin barra doble', () => {
    const signed = makeSigner().sign({ assetId: 'abc', variant: 'raw', download: false }, 900);
    expect(signed.url.startsWith('https://media.asis.chat/api/media/abc/raw?t=')).toBe(true);
  });

  it('rechaza un token vencido', () => {
    const signer = makeSigner();
    const signed = signer.sign({ assetId: 'abc', variant: 'raw', download: false }, -10);
    const token = new URL(signed.url).searchParams.get('t')!;
    expect(signer.verify(token)).toBeNull();
  });

  it('rechaza un token manipulado: no se puede cambiar el asset ajeno', () => {
    const signer = makeSigner();
    const signed = signer.sign({ assetId: 'mio', variant: 'raw', download: false }, 900);
    const token = new URL(signed.url).searchParams.get('t')!;

    const tampered = token.replace('mio', 'ajeno');
    expect(signer.verify(tampered)).toBeNull();
  });

  it('rechaza una firma de otro secreto', () => {
    const signed = makeSigner('secreto-a').sign({ assetId: 'abc', variant: 'raw', download: false }, 900);
    const token = new URL(signed.url).searchParams.get('t')!;
    expect(makeSigner('secreto-b').verify(token)).toBeNull();
  });

  it('rechaza basura y tokens vacíos', () => {
    const signer = makeSigner();
    expect(signer.verify('')).toBeNull();
    expect(signer.verify('sinpunto')).toBeNull();
    expect(signer.verify('a~raw~999~0.firmatrucha')).toBeNull();
  });

  it('conserva la variante y el flag de descarga', () => {
    const signer = makeSigner();
    const signed = signer.sign({ assetId: 'abc', variant: 'thumb-256', download: true }, 900);
    const token = new URL(signed.url).searchParams.get('t')!;
    expect(signer.verify(token)).toEqual({ assetId: 'abc', variant: 'thumb-256', download: true });
  });
});
