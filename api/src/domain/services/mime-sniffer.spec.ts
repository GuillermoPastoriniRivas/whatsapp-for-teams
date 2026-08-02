import { detectMimeType, resolveMimeType } from './mime-sniffer.js';

/** Cabecera mínima con los magic bytes de cada formato. */
function header(bytes: number[], length = 32): Buffer {
  const buffer = Buffer.alloc(length);
  Buffer.from(bytes).copy(buffer);
  return buffer;
}

describe('detectMimeType', () => {
  it('reconoce JPEG y PNG', () => {
    expect(detectMimeType(header([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(detectMimeType(header([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png');
  });

  it('distingue WEBP de otros contenedores RIFF', () => {
    const webp = header([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
    expect(detectMimeType(webp)).toBe('image/webp');

    const wav = header([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]);
    expect(detectMimeType(wav)).toBeNull();
  });

  it('lee la marca de los contenedores ISO-BMFF', () => {
    const mp4 = header([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32]);
    expect(detectMimeType(mp4)).toBe('video/mp4');

    const heic = header([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]);
    expect(detectMimeType(heic)).toBe('image/heic');
  });

  it('devuelve null cuando no reconoce nada', () => {
    expect(detectMimeType(header([0x00, 0x01, 0x02, 0x03]))).toBeNull();
  });
});

describe('resolveMimeType', () => {
  it('los bytes le ganan al tipo declarado: un HTML disfrazado de JPEG no pasa', () => {
    const png = header([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(resolveMimeType(png, 'image/jpeg', 'foto.jpg')).toBe('image/png');
  });

  it('los OOXML son zips: ahí sí desempata la extensión', () => {
    const zip = header([0x50, 0x4b, 0x03, 0x04]);
    const declared = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    expect(resolveMimeType(zip, declared, 'contrato.docx')).toBe(declared);
  });

  it('un zip sin pistas de OOXML queda como zip', () => {
    const zip = header([0x50, 0x4b, 0x03, 0x04]);
    expect(resolveMimeType(zip, 'application/octet-stream', 'backup.zip')).toBe('application/zip');
  });

  it('cae al declarado cuando los bytes no dicen nada (texto plano)', () => {
    const text = Buffer.from('hola, esto es un archivo de texto');
    expect(resolveMimeType(text, 'text/plain', 'nota.txt')).toBe('text/plain');
  });
});
