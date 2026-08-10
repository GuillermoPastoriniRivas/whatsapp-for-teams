import { validateFlowGraph, FlowGraphRefs } from './flow-graph.validator.js';
import { outputHandles } from './flow-node-types.js';
import type { FlowGraph } from '../../../../domain/entities/flow.entity.js';

// El nodo que le pasa el dato del cliente a un proveedor externo. Lo delicado no
// es el envío sino lo que pasa cuando algo falta: sin plantilla aprobada Meta
// rechaza, y sin salida de "no hay proveedor" el lead se pierde en silencio.

const refs: FlowGraphRefs = {
  templates: new Map([
    ['tpl-ok', { approved: true, phoneNumberId: 'linea-1' }],
    ['tpl-pendiente', { approved: false, phoneNumberId: 'linea-1' }],
  ]),
  labelIds: new Set(),
  agentIds: new Set(),
  connectionIds: new Set(),
  phones: new Set(['linea-1']),
};

const trigger = {
  id: 't',
  type: 'trigger.inbound_message',
  position: { x: 0, y: 0 },
  data: { phoneScope: 'specific', phoneNumberIds: ['linea-1'], match: 'any', keywords: [] },
};

function graphWith(data: Record<string, unknown>): FlowGraph {
  return {
    nodes: [
      trigger,
      { id: 'derivar', type: 'action.handoff_provider', position: { x: 300, y: 0 }, data },
      { id: 'humano', type: 'action.handoff_human', position: { x: 600, y: 0 }, data: { note: '' } },
    ],
    edges: [
      { id: 'e1', source: 't', sourceHandle: 'out', target: 'derivar' },
      { id: 'e2', source: 'derivar', sourceHandle: 'no_provider', target: 'humano' },
    ],
  } as FlowGraph;
}

const valid = {
  service: '{{vars.opcion}}',
  templateId: 'tpl-ok',
  variables: {},
  notifyCustomer: true,
  customerBody: 'Le pasé tus datos a {{provider.name}}.',
};

describe('nodo «pasar el dato a un proveedor»', () => {
  it('publica con la config completa', () => {
    expect(validateFlowGraph(graphWith(valid), refs).errors).toEqual([]);
  });

  it('no es terminal: deja seguir el flujo si no hay proveedor', () => {
    // Si fuera terminal, un servicio sin proveedor cargado cortaría la
    // conversación sin contestarle nada al cliente.
    const handles = outputHandles({ id: 'x', type: 'action.handoff_provider', position: { x: 0, y: 0 }, data: {} });
    expect(handles).toEqual(['out', 'no_provider', 'error']);
  });

  it('exige una plantilla', () => {
    const { errors } = validateFlowGraph(graphWith({ ...valid, templateId: '' }), refs);
    expect(errors.some((e) => e.code === 'missing_template')).toBe(true);
  });

  it('rechaza una plantilla sin aprobar', () => {
    // Al proveedor le escribimos primero y nunca nos habló: sin plantilla
    // aprobada Meta rechaza el envío y el dato no llega a nadie.
    const { errors } = validateFlowGraph(graphWith({ ...valid, templateId: 'tpl-pendiente' }), refs);
    expect(errors.some((e) => e.code === 'template_not_approved')).toBe(true);
  });

  it('exige saber qué servicio se busca', () => {
    const { errors } = validateFlowGraph(graphWith({ ...valid, service: '  ' }), refs);
    expect(errors.some((e) => e.code === 'missing_service')).toBe(true);
  });

  it('exige el aviso al cliente salvo que se apague', () => {
    const sinTexto = validateFlowGraph(graphWith({ ...valid, customerBody: '' }), refs);
    expect(sinTexto.errors.some((e) => e.code === 'missing_customer_body')).toBe(true);

    const apagado = validateFlowGraph(graphWith({ ...valid, customerBody: '', notifyCustomer: false }), refs);
    expect(apagado.errors).toEqual([]);
  });

  it('bloquea una plantilla de otra línea', () => {
    // La plantilla vive en una WABA concreta: mandarla por otra la rechaza Meta.
    const otraLinea: FlowGraphRefs = {
      ...refs,
      templates: new Map([['tpl-ok', { approved: true, phoneNumberId: 'linea-2' }]]),
      phones: new Set(['linea-1', 'linea-2']),
    };
    const { errors } = validateFlowGraph(graphWith(valid), otraLinea);
    expect(errors.some((e) => e.code === 'template_wrong_phone')).toBe(true);
  });
});
