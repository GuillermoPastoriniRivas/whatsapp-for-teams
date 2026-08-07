import type { InteractiveSendPayload } from '../../application/ports/messaging-api.port.js';

/**
 * Construye el objeto `interactive` del Cloud API de Meta a partir del payload
 * agnóstico del port.
 */
export function buildInteractivePayload(interactive: InteractiveSendPayload): Record<string, unknown> {
  const base = {
    body: { text: interactive.body },
    ...(interactive.header ? { header: { type: 'text', text: interactive.header } } : {}),
    ...(interactive.footer ? { footer: { text: interactive.footer } } : {}),
  };

  switch (interactive.kind) {
    case 'buttons':
      return {
        ...base,
        type: 'button',
        action: {
          buttons: (interactive.buttons ?? []).map((b) => ({
            type: 'reply',
            reply: { id: b.id, title: b.title },
          })),
        },
      };

    /**
     * Botón con link sin necesidad de plantilla: sólo vale dentro de la ventana
     * de 24 h, que es justamente donde una plantilla sería un desperdicio.
     */
    case 'cta_url':
      return {
        ...base,
        type: 'cta_url',
        action: {
          name: 'cta_url',
          parameters: {
            display_text: interactive.buttonText ?? 'Abrir',
            url: interactive.url ?? '',
          },
        },
      };

    /** Le pide la ubicación al cliente con un botón nativo de WhatsApp. */
    case 'location_request':
      return {
        ...base,
        type: 'location_request_message',
        action: { name: 'send_location' },
      };

    case 'address_message':
      return {
        ...base,
        type: 'address_message',
        action: {
          name: 'address_message',
          parameters: { country: interactive.country ?? '' },
        },
      };

    case 'list':
    default:
      return {
        ...base,
        type: 'list',
        action: {
          button: interactive.buttonText ?? 'Ver opciones',
          sections: [
            {
              rows: (interactive.rows ?? []).map((r) => ({
                id: r.id,
                title: r.title,
                ...(r.description ? { description: r.description } : {}),
              })),
            },
          ],
        },
      };
  }
}
