import type { InteractiveSendPayload } from '../../application/ports/messaging-api.port.js';

/**
 * Construye el objeto `interactive` del Cloud API de Meta a partir del payload
 * agnóstico del port. Kapso proxya Meta verbatim, así que sirve para ambos.
 */
export function buildInteractivePayload(interactive: InteractiveSendPayload): Record<string, unknown> {
  if (interactive.kind === 'buttons') {
    return {
      type: 'button',
      body: { text: interactive.body },
      ...(interactive.footer ? { footer: { text: interactive.footer } } : {}),
      action: {
        buttons: (interactive.buttons ?? []).map((b) => ({
          type: 'reply',
          reply: { id: b.id, title: b.title },
        })),
      },
    };
  }

  return {
    type: 'list',
    body: { text: interactive.body },
    ...(interactive.footer ? { footer: { text: interactive.footer } } : {}),
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
