import { Inject, Injectable, Logger } from '@nestjs/common';
import type {
  MessagingApiPort,
  ReadReceiptParams,
  SendMessageParams,
  SendMessageResult,
} from '../../application/ports/messaging-api.port.js';
import type { MessageChargeRepository } from '../../domain/repositories/message-charge.repository.js';
import type { EstimatedCategory, OutboundBillingContext } from '../../domain/value-objects/outbound-billing.js';
import { isWithinFreeEntryPoint } from '../../domain/value-objects/outbound-billing.js';
import { resolveDestinationMarket } from '../../domain/value-objects/destination-market.js';

/**
 * Envuelve al puerto de mensajería y deja una fila de contabilidad por cada
 * saliente que Meta acepta.
 *
 * Va acá y no en cada caso de uso a propósito: los puntos de envío son doce y
 * crecen, y cada vez que se agrega uno hay que acordarse de contabilizarlo.
 * Envolviendo el puerto, contabilizar deja de ser algo que alguien recuerda y
 * pasa a ser algo que no se puede saltear — el `billing` es un campo requerido
 * de `sendMessage`, así que el compilador marca el sitio nuevo antes de que
 * llegue a producción.
 *
 * Sólo se registra lo que Meta aceptó: si `sendMessage` tira, no hubo wamid, no
 * hubo mensaje y no hay nada que cobrar.
 */
@Injectable()
export class LedgeredMessagingApi implements MessagingApiPort {
  private readonly logger = new Logger(LedgeredMessagingApi.name);

  constructor(
    private readonly inner: MessagingApiPort,
    @Inject('MessageChargeRepository') private readonly charges: MessageChargeRepository,
  ) {}

  async sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
    const result = await this.inner.sendMessage(params);

    try {
      await this.record(params, result.waMessageId);
    } catch (error) {
      // Contabilizar no puede tumbar un envío que Meta ya aceptó: el mensaje le
      // llegó al cliente igual. Se registra el hueco y sigue — el webhook de
      // entrega después crea la fila huérfana con lo que cobró Meta.
      this.logger.error(
        `No se pudo contabilizar el saliente ${result.waMessageId}: ${(error as Error)?.message}`,
      );
    }

    return result;
  }

  markAsRead(params: ReadReceiptParams): Promise<void> {
    // El acuse de lectura no es un mensaje al usuario: Meta no lo cobra.
    return this.inner.markAsRead(params);
  }

  private async record(params: SendMessageParams, waMessageId: string): Promise<void> {
    const billing = params.billing;
    const sentAt = new Date();
    const isTemplate = params.type === 'template' || !!params.template;
    const market = resolveDestinationMarket(
      billing.destinationPhone ?? params.to ?? null,
      billing.destinationBsuid ?? params.recipient ?? null,
    );
    const freeEntryPoint = isWithinFreeEntryPoint(billing.freeEntryPointAt, sentAt);

    await this.charges.recordSent({
      waMessageId,
      tenantId: billing.tenantId,
      phoneNumberId: billing.phoneNumberId,
      conversationId: billing.conversationId,
      messageId: null,
      contactId: billing.contactId,
      destinationCountry: market.country,
      destinationPrefix: market.prefix,
      sentAt,
      senderKind: billing.senderKind,
      campaignId: billing.campaignId ?? null,
      adSourceId: billing.adSourceId ?? null,
      flowId: billing.flowId ?? null,
      isTemplate,
      templateId: billing.templateId ?? null,
      templateCategory: billing.templateCategory ?? null,
      marketingLite: billing.marketingLite ?? params.marketingLite ?? false,
      estimatedCategory: estimateCategory(billing, isTemplate),
      freeEntryPoint,
      windowOpen: billing.windowOpen ?? true,
      source: 'live',
    });
  }
}

/**
 * Qué creemos que nos van a cobrar, antes de que Meta lo diga.
 *
 * Una plantilla se cobra por su categoría; cualquier no-plantilla es `service`
 * desde julio 2026, salvo que la conteste Meta Business Agent —que hoy no
 * usamos—. Es una estimación y se guarda como tal: cuando llega el `delivered`,
 * la categoría de Meta la pisa, y la diferencia entre las dos es un bug nuestro
 * que hay que poder ver.
 */
function estimateCategory(billing: OutboundBillingContext, isTemplate: boolean): EstimatedCategory {
  if (isTemplate) return billing.templateCategory ?? 'utility';
  return 'service';
}
