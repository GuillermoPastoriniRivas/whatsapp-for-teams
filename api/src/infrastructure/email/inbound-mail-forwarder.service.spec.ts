import { rewriteForForwarding } from './inbound-mail-forwarder.service.js';

/**
 * Reenviar es cirugía de strings sobre MIME: si se corta mal el bloque de
 * cabeceras, el buzón muestra los headers como cuerpo o pierde los adjuntos.
 */

const FROM = 'no-reply@asis.chat';
const TO = ['guillepastorini5@gmail.com'];

const mail = (headers: string[], body: string, sep = '\r\n') =>
  headers.join(sep) + sep + sep + body;

const headersOf = (raw: string) => {
  const sep = raw.includes('\r\n') ? '\r\n' : '\n';
  return raw.slice(0, raw.indexOf(sep + sep)).split(sep);
};

const bodyOf = (raw: string) => {
  const sep = raw.includes('\r\n') ? '\r\n' : '\n';
  return raw.slice(raw.indexOf(sep + sep) + sep.length * 2);
};

describe('rewriteForForwarding', () => {
  it('manda desde el dominio propio y deja al remitente real en Reply-To', () => {
    const raw = mail(
      ['From: "Facebook" <notification@facebookmail.com>', 'To: guillermo@asis.chat', 'Subject: Verifica tu correo'],
      'Codigo: 020001',
    );

    const headers = headersOf(rewriteForForwarding(raw, FROM, TO));

    // SES rechaza enviar con un From que no sea del dominio verificado.
    expect(headers).toContain('From: "Facebook (via notification@facebookmail.com)" <no-reply@asis.chat>');
    expect(headers).toContain('Reply-To: notification@facebookmail.com');
    expect(headers).toContain('To: guillepastorini5@gmail.com');
  });

  it('conserva el cuerpo intacto', () => {
    const body = 'Linea 1\r\n\r\nLinea 2 con "comillas" y acentuación\r\n';
    const raw = mail(['From: a@b.com', 'To: guillermo@asis.chat', 'Subject: Hola'], body);

    expect(bodyOf(rewriteForForwarding(raw, FROM, TO))).toBe(body);
  });

  it('recuerda a qué casilla le habían escrito', () => {
    const raw = mail(['From: a@b.com', 'To: contact@asis.chat', 'Subject: Consulta'], 'hola');

    expect(headersOf(rewriteForForwarding(raw, FROM, TO))).toContain('X-Original-To: contact@asis.chat');
  });

  it('descarta las firmas del remitente original', () => {
    const raw = mail(
      [
        'From: a@b.com',
        'To: guillermo@asis.chat',
        'DKIM-Signature: v=1; a=rsa-sha256; d=b.com; s=sel;',
        'Return-Path: <bounce@b.com>',
        'Authentication-Results: mx.google.com; spf=pass',
        'Subject: Hola',
      ],
      'hola',
    );

    const headers = headersOf(rewriteForForwarding(raw, FROM, TO));

    // Ya no validan sobre un mensaje con otro From: dejarlas lo hace ver falsificado.
    expect(headers.some((h) => /^DKIM-Signature:/i.test(h))).toBe(false);
    expect(headers.some((h) => /^Return-Path:/i.test(h))).toBe(false);
    expect(headers.some((h) => /^Authentication-Results:/i.test(h))).toBe(false);
    expect(headers).toContain('Subject: Hola');
  });

  it('mantiene pegadas las cabeceras partidas en varias líneas', () => {
    const raw = mail(
      [
        'From: a@b.com',
        'To: guillermo@asis.chat',
        'Content-Type: multipart/alternative;\r\n\tboundary="----=_Part_123"',
        'Subject: Hola',
      ],
      '------=_Part_123--',
    );

    const out = rewriteForForwarding(raw, FROM, TO);

    // Partir el boundary rompe el MIME y el adjunto desaparece.
    expect(out).toContain('Content-Type: multipart/alternative;\r\n\tboundary="----=_Part_123"');
  });

  it('soporta mensajes con saltos LF en vez de CRLF', () => {
    const raw = mail(['From: a@b.com', 'To: guillermo@asis.chat', 'Subject: Hola'], 'cuerpo', '\n');

    const out = rewriteForForwarding(raw, FROM, TO);

    expect(out).toContain('\nReply-To: a@b.com\n');
    expect(bodyOf(out)).toBe('cuerpo');
  });

  it('no rompe cuando el mensaje no trae From', () => {
    const raw = mail(['To: guillermo@asis.chat', 'Subject: Sin remitente'], 'cuerpo');

    expect(() => rewriteForForwarding(raw, FROM, TO)).not.toThrow();
  });
});
