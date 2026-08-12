import { validateFlowGraph, type FlowGraphRefs } from './flow-graph.validator.js';
import type { FlowGraph, FlowNode } from '../../../../domain/entities/flow.entity.js';

const refs: FlowGraphRefs = {
  templates: new Map(),
  labelIds: new Set(),
  agentIds: new Set(),
  connectionIds: new Set(),
  phones: new Set(['linea']),
};

function nodo(id: string, type: string, data: Record<string, unknown>): FlowNode {
  return { id, type, position: { x: 0, y: 0 }, data } as FlowNode;
}

function grafo(nodes: FlowNode[], edges: Array<{ source: string; sourceHandle: string; target: string }>): FlowGraph {
  return {
    nodes: [
      nodo('t1', 'trigger.inbound_message', { phoneScope: 'all', phoneNumberIds: [], match: 'any' }),
      ...nodes,
    ],
    edges: edges.map((edge, index) => ({ id: `e${index}`, ...edge })),
  } as FlowGraph;
}

function codigos(graph: FlowGraph) {
  const result = validateFlowGraph(graph, refs);
  return {
    errores: result.errors.map((issue) => issue.code),
    avisos: result.warnings.map((issue) => issue.code),
  };
}

describe('Variables que nadie guarda', () => {
  const lista = (extra: Record<string, unknown>) =>
    nodo('lista', 'action.send_list', {
      body: '¿Qué te interesa?',
      buttonText: 'Ver opciones',
      rows: [{ title: 'Solarium' }, { title: 'Manicuría' }],
      ...extra,
    });

  const usaLaVariable = nodo('nota', 'action.internal_note', { body: 'Interés: {{vars.interes}}' });

  const conexiones = [
    { source: 't1', sourceHandle: 'out', target: 'lista' },
    { source: 'lista', sourceHandle: 'row:0', target: 'nota' },
    { source: 'lista', sourceHandle: 'row:1', target: 'nota' },
  ];

  it('marca error cuando se lee una variable que ningún paso guarda', () => {
    const { errores } = codigos(grafo([lista({}), usaLaVariable], conexiones));
    expect(errores).toContain('unknown_variable');
  });

  it('deja de marcarla cuando el paso que la recolecta la guarda', () => {
    const { errores } = codigos(grafo([lista({ saveAs: 'interes' }), usaLaVariable], conexiones));
    expect(errores).not.toContain('unknown_variable');
  });

  it('no confunde los otros espacios de nombres con variables del flujo', () => {
    const nota = nodo('nota', 'action.internal_note', {
      body: '{{contact.name}} escribió {{message.body}} y el webhook trajo {{webhook.pedido}} de {{ad.titulo}}',
    });
    const { errores } = codigos(
      grafo([nota], [{ source: 't1', sourceHandle: 'out', target: 'nota' }]),
    );
    expect(errores).not.toContain('unknown_variable');
  });

  it('encuentra la referencia aunque esté anidada dentro de la config del nodo', () => {
    const http = nodo('http', 'action.http', {
      method: 'POST',
      url: 'https://api.example/reservar',
      saveAs: 'reserva',
      fields: [{ key: 'horario', value: '{{vars.horario_elegido}}' }],
    });
    const { errores } = codigos(grafo([http], [{ source: 't1', sourceHandle: 'out', target: 'http' }]));
    expect(errores).toContain('unknown_variable');
  });
});

describe('El largo se mide sobre lo literal, no sobre el template', () => {
  const conLista = (rows: Array<Record<string, unknown>>) =>
    grafo(
      [
        nodo('lista', 'action.send_list', {
          body: 'Elegí un horario',
          buttonText: 'Ver horarios',
          saveAs: 'horario',
          rows,
        }),
        nodo('fin', 'action.send_text', { body: 'listo' }),
      ],
      [
        { source: 't1', sourceHandle: 'out', target: 'lista' },
        ...rows.map((_, index) => ({ source: 'lista', sourceHandle: `row:${index}`, target: 'fin' })),
      ],
    );

  it('no rechaza una opción por el largo del nombre de la variable', () => {
    const { errores, avisos } = codigos(conLista([{ title: '{{vars.huecos.slots.0.label}}' }]));
    expect(errores).not.toContain('row_title_long');
    expect(avisos).toContain('length_depends_on_data');
  });

  it('sigue rechazando una opción cuyo texto fijo se pasa del límite', () => {
    const { errores } = codigos(conLista([{ title: 'Depilación definitiva de piernas completas' }]));
    expect(errores).toContain('row_title_long');
  });

  it('rechaza cuando lo literal ya se pasa aunque haya una variable en el medio', () => {
    const { errores } = codigos(conLista([{ title: 'Turno confirmado para el día {{vars.h}}' }]));
    expect(errores).toContain('row_title_long');
  });

  it('mide igual el cuerpo de un mensaje con botones', () => {
    const graph = grafo(
      [
        nodo('botones', 'action.send_buttons', {
          body: `${'x'.repeat(1000)} {{vars.h}}`,
          buttons: [{ title: 'Sí' }],
          saveAs: 'h',
        }),
        nodo('fin', 'action.send_text', { body: 'listo' }),
      ],
      [
        { source: 't1', sourceHandle: 'out', target: 'botones' },
        { source: 'botones', sourceHandle: 'btn:0', target: 'fin' },
      ],
    );
    expect(codigos(graph).errores).not.toContain('field_too_long');
  });
});
