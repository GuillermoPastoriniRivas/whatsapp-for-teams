import type { MessageCharge, ChargeRate } from '../entities/message-charge.entity.js';
import type { MetaPricingSnapshot } from '../value-objects/meta-pricing.js';

export type RecordSentInput = Omit<
  MessageCharge,
  'id' | 'deliveredAt' | 'failedAt' | 'waErrorCode' | 'meta' | 'rate'
>;

export interface UsageQuery {
  tenantId: string;
  from: Date;
  to: Date;
  phoneNumberId?: string;
  /** Agrupa el resultado. Sin esto viene un solo total. */
  groupBy?: 'category' | 'senderKind' | 'phoneNumber' | 'template' | 'campaign' | 'country' | 'day' | 'ad';
}

export interface UsageBucket {
  key: string;
  /**
   * Nombre legible del grupo, cuando la clave es un id. Un reporte que muestra
   * ObjectIds no es un reporte: nadie sabe qué plantilla es `68f3a…`.
   */
  label?: string | null;
  /** Entregados y facturables. Es el número que se convierte en plata. */
  billable: number;
  /** Entregados que Meta no cobra (ventana gratis, free entry point). */
  free: number;
  /** Enviados que todavía no se entregaron ni fallaron. */
  pending: number;
  failed: number;
  /** Suma de `rate.amount`. Null si todavía no se tarifó nada del grupo. */
  amount: number | null;
  currency: string | null;
}

export interface MessageChargeRepository {
  /**
   * Registra un saliente. Idempotente por `waMessageId`: un reintento que
   * devuelve el mismo wamid no puede contar dos veces.
   */
  recordSent(input: RecordSentInput): Promise<MessageCharge>;

  /**
   * Sella la entrega y guarda lo que cobró Meta. Write-once en los dos campos.
   *
   * Crea la fila si no existe (`source: 'orphan'`): los mensajes que estaban en
   * vuelo cuando se deployó esto no tienen envío registrado, y perder su
   * `pricing` sería perderlo para siempre.
   */
  stampDelivered(
    waMessageId: string,
    deliveredAt: Date,
    pricing: MetaPricingSnapshot | null,
    fallback?: Pick<RecordSentInput, 'tenantId' | 'phoneNumberId' | 'conversationId' | 'senderKind'>,
  ): Promise<MessageCharge | null>;

  stampFailed(waMessageId: string, failedAt: Date, errorCode: string | null): Promise<MessageCharge | null>;

  /**
   * Enlaza el charge con el Message y la conversación cuando esos ids no
   * existían todavía al enviar (campañas: el chat se crea después del envío
   * para no dejar conversaciones fantasma cuando el envío falla).
   *
   * Sólo rellena lo que está en null: no toca nada de lo contable.
   */
  linkMessage(waMessageId: string, messageId: string, conversationId: string | null): Promise<void>;

  findByWaMessageId(waMessageId: string): Promise<MessageCharge | null>;

  /** Entregados sin tarifar todavía. Los consume el job de cálculo. */
  findUnrated(limit: number): Promise<MessageCharge[]>;

  setRate(id: string, rate: ChargeRate): Promise<void>;

  usage(query: UsageQuery): Promise<UsageBucket[]>;

  /** Para reconciliar contra los números de Meta. */
  countDelivered(tenantId: string, from: Date, to: Date): Promise<number>;
}
