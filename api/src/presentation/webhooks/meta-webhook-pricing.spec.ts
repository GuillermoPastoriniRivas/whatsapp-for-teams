import { parseMetaWebhook, mapMetaStatusToUpdate } from './meta-webhook.parser.js';
import type { MetaWebhookPayload } from './meta-webhook.types.js';

/**
 * El `pricing` llega pegado al `delivered` y Meta no lo repite. Si el parser lo
 * deja pasar, no hay forma de saber después qué se cobró: por eso tiene test.
 */
function payload(status: Record<string, unknown>): MetaWebhookPayload {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'waba-1',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { phone_number_id: '111', display_phone_number: '+5491100000000' },
              statuses: [status],
            },
          },
        ],
      },
    ],
  } as unknown as MetaWebhookPayload;
}

describe('pricing del webhook de estados', () => {
  it('captura lo que cobró Meta en un delivered', () => {
    const { statuses } = parseMetaWebhook(
      payload({
        id: 'wamid.1',
        status: 'delivered',
        timestamp: '1790000000',
        recipient_id: '5491155551001',
        pricing: { billable: true, pricing_model: 'PMP', type: 'regular', category: 'service' },
        conversation: { id: 'conv-1', origin: { type: 'service' }, expiration_timestamp: '1790086400' },
      }),
    );

    const update = mapMetaStatusToUpdate(statuses[0]);

    expect(update.pricing).toMatchObject({
      billable: true,
      pricingModel: 'PMP',
      pricingType: 'regular',
      category: 'service',
      conversationId: 'conv-1',
      conversationOrigin: 'service',
    });
    // El crudo se guarda igual: Meta agrega campos sin avisar y el detalle de
    // Meta Business Agent todavía no está publicado.
    expect(update.pricing?.raw).toBeTruthy();
  });

  it('no inventa un cobro cuando el status no lo trae', () => {
    const { statuses } = parseMetaWebhook(payload({ id: 'wamid.2', status: 'sent', timestamp: '1790000000' }));
    expect(mapMetaStatusToUpdate(statuses[0]).pricing).toBeNull();
  });

  it('marca no facturable lo que Meta no cobra', () => {
    const { statuses } = parseMetaWebhook(
      payload({
        id: 'wamid.3',
        status: 'delivered',
        timestamp: '1790000000',
        pricing: { billable: false, pricing_model: 'CBP', type: 'free_entry_point', category: 'service' },
      }),
    );
    expect(mapMetaStatusToUpdate(statuses[0]).pricing?.billable).toBe(false);
  });
});
