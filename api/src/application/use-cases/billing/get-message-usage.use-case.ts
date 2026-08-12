import type { MessageChargeRepository, UsageBucket, UsageQuery } from '../../../domain/repositories/message-charge.repository.js';
import type { RateCardRepository } from '../../../domain/repositories/rate-card.repository.js';
import type { MessageTemplateRepository } from '../../../domain/repositories/message-template.repository.js';
import type { CampaignRepository } from '../../../domain/repositories/campaign.repository.js';
import type { PhoneNumberRepository } from '../../../domain/repositories/phone-number.repository.js';

/** Agrupados cuya clave es un id y necesitan que le busquemos el nombre. */
const LABELLED_GROUPS = new Set<NonNullable<UsageQuery['groupBy']>>(['template', 'campaign', 'phoneNumber']);

export interface MessageUsageInput {
  tenantId: string;
  from: Date;
  to: Date;
  phoneNumberId?: string;
  groupBy?: UsageQuery['groupBy'];
}

export interface MessageUsageResult {
  from: Date;
  to: Date;
  currency: string | null;
  total: UsageBucket;
  buckets: UsageBucket[];
  /**
   * Quién cobra qué. Va en la respuesta y no sólo en la UI para que ningún
   * consumidor de la API pueda presentar estos números como un cargo nuestro.
   */
  disclaimer: {
    chargedBy: 'meta';
    /** asis no aplica ningún margen sobre los mensajes. */
    markup: 0;
    note: string;
  };
  /** Advertencias: lo que falta para que el número sea confiable. */
  warnings: string[];
}

const PASSTHROUGH_NOTE =
  'Los mensajes los cobra Meta directamente a tu cuenta. asis no cobra los mensajes ni les aplica ningún recargo: este cálculo es informativo y la factura es la de Meta.';

/**
 * Qué se envió, qué se entregó y cuánto costó en un período.
 *
 * El costo se calcula con la rate card vigente al momento de cada entrega, así
 * que no cambia si Meta actualiza sus precios después.
 *
 * Sólo mensajes. El consumo de IA es costo nuestro y no se traslada, así que no
 * tiene nada que hacer en la cuenta que le mostramos al cliente.
 */
export class GetMessageUsageUseCase {
  constructor(
    private readonly charges: MessageChargeRepository,
    private readonly cards: RateCardRepository,
    private readonly templates: MessageTemplateRepository,
    private readonly campaigns: CampaignRepository,
    private readonly phones: PhoneNumberRepository,
  ) {}

  async execute(input: MessageUsageInput): Promise<MessageUsageResult> {
    const [buckets, totals] = await Promise.all([
      input.groupBy
        ? this.charges.usage({ ...input, groupBy: input.groupBy })
        : Promise.resolve([]),
      this.charges.usage({ ...input, groupBy: undefined }),
    ]);

    const total = totals[0] ?? { key: 'total', billable: 0, free: 0, pending: 0, failed: 0, amount: null, currency: null };
    const warnings = await this.warningsFor(input, total);

    return {
      from: input.from,
      to: input.to,
      currency: total.currency,
      total,
      buckets: await this.withLabels(buckets, input.groupBy),
      disclaimer: { chargedBy: 'meta', markup: 0, note: PASSTHROUGH_NOTE },
      warnings,
    };
  }

  /**
   * Le pone nombre a los grupos que agrupan por id.
   *
   * Se resuelve acá y no en la UI porque el nombre vive del lado del servidor y
   * el front no tiene forma de pedirlo sin una llamada por fila. Los que no se
   * resuelven —una plantilla borrada— quedan sin `label` y la UI muestra la
   * clave: peor es esconder el gasto.
   */
  private async withLabels(
    buckets: UsageBucket[],
    groupBy: MessageUsageInput['groupBy'],
  ): Promise<UsageBucket[]> {
    if (!groupBy || !LABELLED_GROUPS.has(groupBy) || buckets.length === 0) return buckets;

    const resolve = async (key: string): Promise<string | null> => {
      if (!key || key === 'null') return null;
      if (groupBy === 'template') return (await this.templates.findById(key))?.name ?? null;
      if (groupBy === 'campaign') return (await this.campaigns.findById(key))?.name ?? null;
      return (await this.phones.findById(key))?.label ?? null;
    };

    return Promise.all(
      buckets.map(async (bucket) => ({ ...bucket, label: await resolve(bucket.key) })),
    );
  }

  /**
   * Un total incompleto tiene que decirlo. Mostrar "$12" cuando la mitad de los
   * mensajes no se pudo tarifar es peor que no mostrar nada.
   */
  private async warningsFor(input: MessageUsageInput, total: UsageBucket): Promise<string[]> {
    const warnings: string[] = [];

    const card = await this.cards.findEffectiveAt(input.to);
    if (!card) {
      warnings.push(
        'No hay tabla de precios cargada para este período: se muestran los mensajes contados, sin costo.',
      );
    }

    if (total.pending > 0) {
      warnings.push(
        `${total.pending} mensajes todavía no fueron confirmados por Meta. Sólo se cobra lo entregado, así que el costo puede subir.`,
      );
    }

    if (total.amount === null && total.billable > 0) {
      warnings.push('Hay mensajes facturables sin tarifar todavía: el costo está incompleto.');
    }

    return warnings;
  }
}
