import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3';
import { SESClient, SendRawEmailCommand } from '@aws-sdk/client-ses';

/**
 * Reenvía a un buzón real el correo que SES recibió para el dominio.
 *
 * SES deja el mail crudo en S3 (ver `infra/terraform/email-inbound.tf`) y acá
 * se lo saca de ahí y se lo manda al destino. Lo natural sería un Lambda, pero
 * esta cuenta de AWS tiene bloqueado `CreateFunction`, así que el trabajo lo
 * hace el único proceso que ya corre: este.
 *
 * No se puede reenviar el MIME tal cual: SES solo acepta enviar con un `From`
 * del dominio verificado, y el remitente original (gmail.com, meta.com…) no lo
 * es. Se reescribe el `From` al propio y el remitente real va en `Reply-To`,
 * así responder desde el buzón le llega a la persona correcta.
 */
@Injectable()
export class InboundMailForwarderService {
  private readonly logger = new Logger(InboundMailForwarderService.name);
  private readonly s3: S3Client | null;
  private readonly ses: SESClient;
  private readonly bucket: string;
  private readonly prefix: string;
  private readonly from: string;
  private readonly to: string[];

  constructor(config: ConfigService) {
    this.bucket = config.get<string>('INBOUND_MAIL_BUCKET', '');
    this.prefix = config.get<string>('INBOUND_MAIL_PREFIX', 'inbound/');
    this.from = config.get<string>('SES_FROM_EMAIL') ?? 'no-reply@asis.chat';
    this.to = (config.get<string>('INBOUND_MAIL_FORWARD_TO', '') || '')
      .split(',')
      .map((address) => address.trim())
      .filter(Boolean);

    const region = config.get<string>('AWS_SES_REGION') ?? config.get<string>('AWS_REGION', 'us-east-1');
    const accessKeyId = config.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = config.get<string>('AWS_SECRET_ACCESS_KEY');
    const credentials = accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined;

    this.ses = new SESClient({ region, ...(credentials ? { credentials } : {}) });
    this.s3 = this.bucket ? new S3Client({ region, ...(credentials ? { credentials } : {}) }) : null;

    if (!this.enabled) {
      this.logger.log('Reenvío de correo entrante deshabilitado (falta INBOUND_MAIL_BUCKET o INBOUND_MAIL_FORWARD_TO)');
    }
  }

  get enabled(): boolean {
    return Boolean(this.s3 && this.bucket && this.to.length);
  }

  /** Reenvía todo lo que haya sin procesar. Devuelve cuántos mails salieron. */
  async forwardPending(): Promise<number> {
    if (!this.enabled) return 0;

    const listed = await this.s3!.send(
      new ListObjectsV2Command({ Bucket: this.bucket, Prefix: this.prefix, MaxKeys: 25 }),
    );

    let forwarded = 0;
    for (const object of listed.Contents ?? []) {
      const key = object.Key;
      // SES escribe este objeto al crear la regla para probar que puede: no es
      // un mail y no tiene a quién reenviarse.
      if (!key || key.endsWith('AMAZON_SES_SETUP_NOTIFICATION')) continue;

      try {
        await this.forwardOne(key);
        forwarded++;
      } catch (error: any) {
        // Un mail que no se puede reenviar no puede frenar a los que siguen.
        // Queda en S3: el lifecycle lo limpia a los 30 días.
        this.logger.error(`No se pudo reenviar ${key}: ${error?.message}`);
      }
    }

    return forwarded;
  }

  private async forwardOne(key: string): Promise<void> {
    const object = await this.s3!.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const raw = await object.Body!.transformToString();

    await this.ses.send(
      new SendRawEmailCommand({
        Source: this.from,
        Destinations: this.to,
        RawMessage: { Data: Buffer.from(rewriteForForwarding(raw, this.from, this.to)) },
      }),
    );

    // Recién después de que SES lo aceptó: si se borra antes y el envío falla,
    // el mail se pierde sin que nadie lo sepa.
    await this.s3!.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    this.logger.log(`Correo ${key} reenviado a ${this.to.join(', ')}`);
  }
}

/**
 * Cabeceras que dejan de ser ciertas al reenviar. Las firmas DKIM del remitente
 * original no validan sobre un mensaje con otro `From`, y dejarlas hace que el
 * buzón lo marque como falsificado en vez de simplemente no verificado.
 */
const DROP = new Set([
  'dkim-signature',
  'domainkey-signature',
  'authentication-results',
  'received-spf',
  'arc-authentication-results',
  'arc-message-signature',
  'arc-seal',
  'return-path',
  'sender',
  'from',
  'reply-to',
  'to',
  'cc',
  'bcc',
  'message-id',
]);

const nameOf = (header: string) => header.slice(0, header.indexOf(':')).trim().toLowerCase();
const valueOf = (header: string) => header.slice(header.indexOf(':') + 1).trim();

/** `"Meta" <no-reply@meta.com>` → dirección suelta y `From` listo para SES. */
function senderOf(from: string, forwardFrom: string): { address: string; header: string } {
  const angle = from.lastIndexOf('<');
  const address = angle === -1 ? from.trim() : from.slice(angle + 1).replace('>', '').trim();
  const label = angle === -1 ? '' : from.slice(0, angle).trim().replace(/^"|"$/g, '');
  const shown = (label || address).replace(/["\\]/g, '');
  return { address, header: `"${shown} (via ${address})" <${forwardFrom}>` };
}

/**
 * Reescribe las cabeceras del mensaje para que SES lo acepte como propio,
 * dejando el cuerpo intacto (con sus adjuntos y su estructura MIME).
 *
 * Exportada para poder testearla: es todo string surgery sobre MIME y es donde
 * se rompen los reenvíos.
 */
export function rewriteForForwarding(raw: string, forwardFrom: string, forwardTo: string[]): string {
  const boundary = raw.indexOf('\r\n\r\n');
  const useCrlf = boundary !== -1;
  const cut = useCrlf ? boundary : raw.indexOf('\n\n');
  const sep = useCrlf ? '\r\n' : '\n';

  const head = cut === -1 ? raw : raw.slice(0, cut);
  const body = cut === -1 ? '' : raw.slice(cut + sep.length * 2);

  // Una cabecera puede ocupar varias líneas: las continuaciones arrancan con
  // espacio o tab y hay que mantenerlas pegadas a la suya.
  const headers: string[] = [];
  for (const line of head.split(sep)) {
    if (/^[ \t]/.test(line) && headers.length) headers[headers.length - 1] += sep + line;
    else headers.push(line);
  }

  const original = headers.find((h) => h.includes(':') && nameOf(h) === 'from');
  const originalTo = headers.find((h) => h.includes(':') && nameOf(h) === 'to');
  const { address, header } = senderOf(original ? valueOf(original) : 'desconocido', forwardFrom);

  const kept = headers.filter((h) => h.includes(':') && !DROP.has(nameOf(h)));

  const rewritten = [
    `From: ${header}`,
    `Reply-To: ${address}`,
    `To: ${forwardTo.join(', ')}`,
    // Con varias casillas reenviando al mismo buzón, es lo único que dice a
    // cuál de todas le escribieron.
    ...(originalTo ? [`X-Original-To: ${valueOf(originalTo)}`] : []),
    ...kept,
  ];

  return rewritten.join(sep) + sep + sep + body;
}
