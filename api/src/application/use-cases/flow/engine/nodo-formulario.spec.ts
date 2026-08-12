import { validateFlowGraph, type FlowGraphRefs } from './flow-graph.validator.js';
import { outputHandles, isWaitNode, isSessionSend, NODE_TYPES } from './flow-node-types.js';
import { buildInteractivePayload } from '../../../../infrastructure/messaging/interactive-payload.builder.js';
import { parseMetaWebhook, mapMetaMessageToInbound } from '../../../../presentation/webhooks/meta-webhook.parser.js';
import type { MetaWebhookPayload } from '../../../../presentation/webhooks/meta-webhook.types.js';
import type { FlowGraph, FlowNode } from '../../../../domain/entities/flow.entity.js';

const refs: FlowGraphRefs = {
  templates: new Map(),
  labelIds: new Set(),
  agentIds: new Set(),
  connectionIds: new Set(),
  phones: new Set(['linea']),
};

function nodo(data: Record<string, unknown>): FlowNode {
  return { id: 'n1', type: 'action.send_flow', position: { x: 0, y: 0 }, data } as FlowNode;
}

function grafoCon(node: FlowNode, handle: string): FlowGraph {
  const disparador = { id: 't1', type: 'trigger.inbound_message', position: { x: 0, y: 0 }, data: { phoneScope: 'all', phoneNumberIds: [] } };
  const cierre = { id: 'fin', type: 'action.send_text', position: { x: 0, y: 0 }, data: { body: 'Listo' } };
  return {
    nodes: [disparador, node, cierre],
    edges: [
      { id: 'e1', source: 't1', sourceHandle: 'out', target: node.id },
      { id: 'e2', source: node.id, sourceHandle: handle, target: 'fin' },
    ],
  } as unknown as FlowGraph;
}

const completo = {
  body: 'Completá tus datos para reservar',
  flowId: '123456',
  cta: 'Completar',
  saveAs: 'formulario',
  timeout: { amount: 1, unit: 'days' },
};

function erroresDe(data: Record<string, unknown>): string[] {
  return validateFlowGraph(grafoCon(nodo(data), 'completed'), refs).errors.map((issue) => issue.code);
}

function avisosDe(data: Record<string, unknown>): string[] {
  return validateFlowGraph(grafoCon(nodo(data), 'completed'), refs).warnings.map((issue) => issue.code);
}

describe('Nodo de formulario de WhatsApp', () => {
  it('está declarado en el catálogo del motor', () => {
    expect(NODE_TYPES).toContain('action.send_flow');
  });

  describe('Validación', () => {
    it('publica cuando tiene mensaje, formulario, botón y variable', () => {
      expect(erroresDe(completo)).toEqual([]);
    });

    it('exige elegir el formulario: sin id no hay nada que abrir', () => {
      const { flowId: _sin, ...resto } = completo;
      expect(erroresDe(resto)).toContain('missing_flow');
    });

    it('exige el texto del botón, que es lo único que se ve del formulario', () => {
      const { cta: _sin, ...resto } = completo;
      expect(erroresDe(resto)).toContain('missing_flow_cta');
    });

    it('corta el botón en 30 caracteres, que es el máximo de Meta', () => {
      expect(erroresDe({ ...completo, cta: 'a'.repeat(31) })).toContain('field_too_long');
    });

    it('exige dónde guardar las respuestas: si no, se completan y se tiran', () => {
      const { saveAs: _sin, ...resto } = completo;
      expect(erroresDe(resto)).toContain('missing_save_as');
    });

    it('avisa del modo borrador: al cliente le llega un formulario que no puede abrir', () => {
      expect(avisosDe({ ...completo, mode: 'draft' })).toContain('flow_draft_mode');
    });
  });

  describe('Ramas y ventana', () => {
    it('no tiene rama "inválido": el formulario vuelve entero o no vuelve', () => {
      expect(outputHandles(nodo(completo))).toEqual(['completed', 'timeout', 'error']);
    });

    it('espera la respuesta como cualquier pregunta', () => {
      expect(isWaitNode('action.send_flow')).toBe(true);
    });

    it('gasta ventana de 24 h', () => {
      expect(isSessionSend('action.send_flow')).toBe(true);
    });
  });

  describe('Payload que sale a Meta', () => {
    const base = {
      kind: 'flow' as const,
      body: 'Completá tus datos',
      flow: { id: '123456', token: 'exec-1:n1', cta: 'Completar' },
    };

    it('manda la versión 3 del protocolo, que es la que soporta la API', () => {
      const payload = buildInteractivePayload(base) as any;
      expect(payload.type).toBe('flow');
      expect(payload.action.parameters.flow_message_version).toBe('3');
      expect(payload.action.parameters.flow_token).toBe('exec-1:n1');
    });

    it('solo manda la pantalla de entrada cuando navega: en data_exchange la elige el servidor', () => {
      const navegando = buildInteractivePayload({
        ...base,
        flow: { ...base.flow, action: 'navigate', screen: 'DATOS' },
      }) as any;
      expect(navegando.action.parameters.flow_action_payload).toEqual({ screen: 'DATOS' });

      const intercambiando = buildInteractivePayload({
        ...base,
        flow: { ...base.flow, action: 'data_exchange', screen: 'DATOS' },
      }) as any;
      expect(intercambiando.action.parameters.flow_action_payload).toBeUndefined();
    });
  });

  describe('Respuesta que vuelve por el webhook', () => {
    /** Del webhook crudo al input de la app, que es donde vive `flowResponse`. */
    function entrada(raw: MetaWebhookPayload) {
      const { messages } = parseMetaWebhook(raw);
      return mapMetaMessageToInbound(messages[0], '111');
    }

    function payload(interactive: Record<string, unknown>): MetaWebhookPayload {
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
                  contacts: [{ wa_id: '5491155551001', profile: { name: 'Cliente' } }],
                  messages: [
                    {
                      id: 'wamid.1',
                      from: '5491155551001',
                      timestamp: '1790000000',
                      type: 'interactive',
                      interactive,
                    },
                  ],
                },
              },
            ],
          },
        ],
      } as unknown as MetaWebhookPayload;
    }

    it('saca los campos del nfm_reply y separa el token de correlación', () => {
      const entrante = entrada(
        payload({
          type: 'nfm_reply',
          nfm_reply: {
            name: 'flow',
            body: 'Sent',
            response_json: JSON.stringify({ flow_token: 'exec-1:n1', nombre: 'Ana', servicio: 'depilacion' }),
          },
        }),
      );

      expect(entrante?.flowResponse).toEqual({
        token: 'exec-1:n1',
        fields: { nombre: 'Ana', servicio: 'depilacion' },
      });
    });

    it('un JSON roto no tumba el webhook: el mensaje entra sin respuesta de formulario', () => {
      const entrante = entrada(
        payload({ type: 'nfm_reply', nfm_reply: { name: 'flow', body: 'Sent', response_json: '{roto' } }),
      );
      expect(entrante?.flowResponse).toBeNull();
    });

    it('un botón común no se confunde con un formulario', () => {
      const entrante = entrada(
        payload({ type: 'button_reply', button_reply: { id: 'btn:0', title: 'Sí' } }),
      );
      expect(entrante?.flowResponse).toBeNull();
    });
  });
});
