import { createHash, randomBytes } from 'node:crypto';
import { Notification } from '../../../domain/entities/notification.entity.js';
import { PhoneNumber } from '../../../domain/entities/phone-number.entity.js';
import { DomainError } from '../../../domain/errors/domain-errors.js';
import { PhoneNumberRepository } from '../../../domain/repositories/phone-number.repository.js';
import { normalizePhone } from '../contact/normalize-phone.js';

/** Id público de una notificación: `ntf_` + 24 hex (96 bits). */
export function generateNotificationId(): string {
  return `ntf_${randomBytes(12).toString('hex')}`;
}

/** Los ids internos (teléfono, plantilla) son ObjectId de Mongo. */
export function isObjectIdLike(value: string | null | undefined): boolean {
  return !!value && /^[0-9a-f]{24}$/i.test(value);
}

/**
 * Resuelve el número emisor con las mismas reglas que la API de mensajes:
 * por id si viene, si no el único activo de la cuenta.
 */
export async function resolveNotificationPhone(
  phoneRepo: PhoneNumberRepository,
  tenantId: string,
  phoneNumberId?: string,
): Promise<PhoneNumber | DomainError> {
  if (phoneNumberId) {
    if (!isObjectIdLike(phoneNumberId)) {
      return new DomainError('PHONE_NUMBER_NOT_FOUND', 'Phone number not found.');
    }
    const phone = await phoneRepo.findById(phoneNumberId);
    if (!phone || phone.tenantId !== tenantId) {
      return new DomainError('PHONE_NUMBER_NOT_FOUND', 'Phone number not found.');
    }
    if (phone.status !== 'active') {
      return new DomainError('PHONE_NUMBER_INACTIVE', 'This phone number is currently inactive.');
    }
    return phone;
  }

  const phones = (await phoneRepo.findByTenantId(tenantId)).filter((p) => p.status === 'active');
  if (phones.length === 0) {
    return new DomainError('PHONE_NUMBER_NOT_FOUND', 'The account has no active WhatsApp numbers.');
  }
  if (phones.length > 1) {
    return new DomainError(
      'PHONE_NUMBER_AMBIGUOUS',
      'The account has multiple WhatsApp numbers; specify `phoneNumberId`. List them with GET /v1/phone-numbers.',
    );
  }
  return phones[0];
}

/** Destinatario normalizado o `INVALID_PHONE`. */
export function normalizeNotificationRecipient(raw: string): string | DomainError {
  const phone = normalizePhone(raw);
  if (!phone) {
    return new DomainError(
      'INVALID_PHONE',
      `'${raw}' is not a valid phone number. Send it in international format, with the country code.`,
    );
  }
  return phone;
}

/** Ordena las claves de un objeto para que el hash no dependa del orden. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
}

/**
 * Huella del pedido. La misma `Idempotency-Key` con otra huella es un 409: no
 * es un reintento, es otro mensaje con la misma clave.
 */
export function hashNotificationRequest(input: {
  to: string;
  templateId?: string;
  template?: { name: string; language: string };
  variables?: Record<string, string>;
  sendAt?: string;
  metadata?: Record<string, unknown>;
  phoneNumberId?: string;
}): string {
  const parsedSendAt = input.sendAt ? new Date(input.sendAt) : null;
  const sendAt =
    parsedSendAt && !Number.isNaN(parsedSendAt.getTime())
      ? parsedSendAt.toISOString()
      : (input.sendAt ?? null);

  const canonical = stableStringify({
    to: normalizePhone(input.to) ?? input.to,
    templateId: input.templateId ?? null,
    template: input.template ?? null,
    variables: input.variables ?? {},
    sendAt,
    metadata: input.metadata ?? {},
    phoneNumberId: input.phoneNumberId ?? null,
  });
  return createHash('sha256').update(canonical).digest('hex');
}

function toIso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

/**
 * Forma pública que viaja en los webhooks `notification.*`. Es la misma que
 * devuelve el detalle HTTP, sin el timeline (el desarrollador lo arma con las
 * marcas de tiempo si lo necesita).
 */
export function serializeNotificationPayload(notification: Notification) {
  return {
    id: notification.id,
    status: notification.status,
    to: notification.to,
    templateId: notification.templateId,
    templateName: notification.templateName,
    sandbox: notification.sandbox,
    metadata: notification.metadata,
    createdAt: toIso(notification.createdAt),
    sendAt: toIso(notification.sendAt),
    queuedAt: toIso(notification.queuedAt),
    sentAt: toIso(notification.sentAt),
    deliveredAt: toIso(notification.deliveredAt),
    readAt: toIso(notification.readAt),
    failedAt: toIso(notification.failedAt),
    failureCode: notification.failureCode,
    failureReason: notification.failureReason,
  };
}
