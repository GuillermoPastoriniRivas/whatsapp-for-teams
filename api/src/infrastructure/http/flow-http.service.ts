import { Injectable, Logger } from '@nestjs/common';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { lookup as dnsLookup } from 'node:dns';
import type { LookupAddress } from 'node:dns';
import { isIP } from 'node:net';
import type { FlowHttpPort, FlowHttpRequest, FlowHttpResponse } from '../../application/ports/flow-http.port.js';

const MAX_RESPONSE_BYTES = 256 * 1024;
const MAX_REDIRECTS = 3;

/**
 * Cliente HTTP del nodo de flujo. Plataforma multi-tenant llamando URLs
 * arbitrarias del tenant ⇒ el guard SSRF es obligatorio.
 *
 * Se usa node:http/https en vez de fetch porque permiten un `lookup` propio:
 * la IP se valida DENTRO de la resolución que abre el socket. Validar aparte y
 * después llamar a fetch deja una ventana TOCTOU que el DNS rebinding explota
 * (segunda resolución → IP interna).
 */
@Injectable()
export class FlowHttpService implements FlowHttpPort {
  private readonly logger = new Logger(FlowHttpService.name);

  async request(req: FlowHttpRequest): Promise<FlowHttpResponse> {
    let url = new URL(req.url);
    const origin = url.origin;
    let headers = req.headers;

    for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
      if (url.protocol !== 'https:' && url.protocol !== 'http:') {
        throw new Error('Solo se permiten URLs http(s)');
      }
      // Con una IP literal Node conecta sin pasar por `lookup`, así que ese
      // camino hay que cerrarlo acá. URL.hostname envuelve IPv6 en corchetes.
      const literal = url.hostname.replace(/^\[|\]$/g, '');
      if (isIP(literal) && this.isPrivateAddress(literal)) {
        throw new Error('La URL apunta a una red privada');
      }

      const result = await this.send(url, req, headers);

      if (result.status >= 300 && result.status < 400 && result.location) {
        if (redirect === MAX_REDIRECTS) return { status: result.status, body: null };
        const next = new URL(result.location, url);
        // Nunca degradar a texto plano un origen seguro.
        if (url.protocol === 'https:' && next.protocol === 'http:') {
          throw new Error('El redirect degrada HTTPS a HTTP');
        }
        // Cambio de origen ⇒ se descartan los headers del caller: ahí viaja el
        // secreto de la Conexión y no debe llegar a un host que eligió el
        // servidor remoto.
        if (next.origin !== origin) headers = {};
        url = next;
        continue;
      }

      let body: unknown = result.text;
      if ((result.contentType ?? '').includes('json')) {
        try {
          body = JSON.parse(result.text);
        } catch {
          // se devuelve el string crudo
        }
      }
      return { status: result.status, body };
    }

    throw new Error('Too many redirects');
  }

  private send(
    url: URL,
    req: FlowHttpRequest,
    headers: Record<string, string>,
  ): Promise<{ status: number; text: string; contentType: string | null; location: string | null }> {
    return new Promise((resolve, reject) => {
      const send = url.protocol === 'https:' ? httpsRequest : httpRequest;
      const outgoing = send(
        url,
        {
          method: req.method,
          headers,
          lookup: this.safeLookup,
        },
        (response) => {
          const chunks: Buffer[] = [];
          let total = 0;
          response.on('data', (chunk: Buffer) => {
            total += chunk.length;
            if (total > MAX_RESPONSE_BYTES) {
              response.destroy();
              return;
            }
            chunks.push(chunk);
          });
          response.on('end', () =>
            resolve({
              status: response.statusCode ?? 0,
              text: Buffer.concat(chunks).toString('utf8'),
              contentType: response.headers['content-type'] ?? null,
              location: response.headers.location ?? null,
            }),
          );
          response.on('error', reject);
        },
      );

      outgoing.setTimeout(req.timeoutMs, () => outgoing.destroy(new Error('Timeout de la solicitud HTTP')));
      outgoing.on('error', reject);
      if (req.body && req.method !== 'GET') outgoing.write(req.body);
      outgoing.end();
    });
  }

  /**
   * Resolución usada por el socket: si alguna dirección apunta a una red
   * interna se corta la conexión. Al ser el mismo lookup que usa net.connect,
   * no hay margen para que la IP cambie entre la validación y la conexión.
   */
  private readonly safeLookup = (
    hostname: string,
    options: unknown,
    callback: (err: NodeJS.ErrnoException | null, address: any, family?: number) => void,
  ): void => {
    if (isIP(hostname)) {
      if (this.isPrivateAddress(hostname)) {
        callback(new Error('La URL apunta a una red privada'), '', 0);
        return;
      }
      callback(null, hostname, isIP(hostname));
      return;
    }

    dnsLookup(hostname, { ...(options as object), all: true }, (err, addresses: LookupAddress[]) => {
      if (err) return callback(err, '', 0);
      const list = Array.isArray(addresses) ? addresses : [addresses];
      if (list.length === 0) return callback(new Error(`No se pudo resolver el host ${hostname}`), '', 0);
      if (list.some((entry) => this.isPrivateAddress(entry.address))) {
        return callback(new Error('La URL apunta a una red privada'), '', 0);
      }
      const all = (options as { all?: boolean } | undefined)?.all;
      callback(null, all ? (list as any) : list[0].address, all ? undefined : list[0].family);
    });
  };

  private isPrivateAddress(address: string): boolean {
    if (address.includes(':')) {
      // IPv6: loopback, link-local, unique-local, no especificada y mapeadas v4
      const lower = address.toLowerCase();
      if (lower === '::1' || lower === '::') return true;
      if (lower.startsWith('fe80') || lower.startsWith('fc') || lower.startsWith('fd')) return true;
      if (lower.startsWith('::ffff:')) return this.isPrivateAddress(lower.slice(7));
      return false;
    }
    const parts = address.split('.').map(Number);
    if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true;
    const [a, b] = parts;
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true; // link-local / metadata de la nube
    return false;
  }
}
