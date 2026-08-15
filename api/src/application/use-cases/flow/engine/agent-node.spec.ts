import { validateFlowGraph, type FlowGraphRefs } from './flow-graph.validator.js';
import { outputHandles } from './flow-node-types.js';
import {
  AGENT_FINISH_TOOL,
  agentExitsOf,
  agentMaxTurnsOf,
  buildAgentFinishTool,
  buildAgentExitInstructions,
  DEFAULT_AGENT_MAX_TURNS,
} from './agent-node.js';
import type { FlowGraph, FlowNode } from '../../../../domain/entities/flow.entity.js';

const refs: FlowGraphRefs = {
  templates: new Map(),
  labelIds: new Set(),
  agentIds: new Set(),
  connectionIds: new Set(),
  phones: new Set(['linea']),
};

const EXITS = [
  { key: 'reservo', label: 'Reservó', description: 'La clienta confirmó que quiere el turno' },
  { key: 'quiere_persona', label: 'Quiere hablar con alguien', description: 'Pidió una persona' },
];

function nodo(id: string, type: string, data: Record<string, unknown>): FlowNode {
  return { id, type, position: { x: 0, y: 0 }, data } as FlowNode;
}

function grafoConAgente(data: Record<string, unknown>, handles: string[]): FlowGraph {
  return {
    nodes: [
      nodo('t1', 'trigger.inbound_message', { phoneScope: 'all', phoneNumberIds: [], match: 'any' }),
      nodo('agente', 'action.agent', data),
      nodo('fin', 'action.send_text', { body: 'listo' }),
    ],
    edges: [
      { id: 'e0', source: 't1', sourceHandle: 'out', target: 'agente' },
      ...handles.map((handle, index) => ({
        id: `e${index + 1}`,
        source: 'agente',
        sourceHandle: handle,
        target: 'fin',
      })),
    ],
  } as FlowGraph;
}

function codigos(graph: FlowGraph): string[] {
  return validateFlowGraph(graph, refs).errors.map((issue) => issue.code);
}

describe('salidas del nodo Agente', () => {
  it('cada salida declarada abre su propio handle', () => {
    const handles = outputHandles(nodo('a', 'action.agent', { exits: EXITS }));
    expect(handles).toEqual(['exit:reservo', 'exit:quiere_persona', 'timeout', 'error']);
  });

  it('sin salidas solo quedan las de escape, así que el agente no puede volver al flujo', () => {
    expect(outputHandles(nodo('a', 'action.agent', {}))).toEqual(['timeout', 'error']);
  });

  it('la herramienta de cierre ofrece exactamente las claves declaradas', () => {
    const tool = buildAgentFinishTool(agentExitsOf({ exits: EXITS }));
    expect(tool.name).toBe(AGENT_FINISH_TOOL);
    expect((tool.parameters.properties as any).exit.enum).toEqual(['reservo', 'quiere_persona']);
  });

  it('las instrucciones le dicen al agente cuándo usar cada puerta', () => {
    const text = buildAgentExitInstructions(agentExitsOf({ exits: EXITS }));
    expect(text).toContain('reservo: La clienta confirmó que quiere el turno');
    expect(text).toContain(AGENT_FINISH_TOOL);
  });

  it('el tope de turnos se acota y tiene default', () => {
    expect(agentMaxTurnsOf({})).toBe(DEFAULT_AGENT_MAX_TURNS);
    expect(agentMaxTurnsOf({ maxTurns: 0 })).toBe(DEFAULT_AGENT_MAX_TURNS);
    expect(agentMaxTurnsOf({ maxTurns: 500 })).toBe(50);
    expect(agentMaxTurnsOf({ maxTurns: 3 })).toBe(3);
  });
});

describe('validación del nodo Agente', () => {
  it('acepta un agente bien armado', () => {
    const errores = codigos(
      grafoConAgente({ name: 'Sofía', exits: EXITS, tools: ['search_knowledge'] }, [
        'exit:reservo',
        'exit:quiere_persona',
        'timeout',
        'error',
      ]),
    );
    expect(errores).toEqual([]);
  });

  it('un agente sin salidas no publica: no tendría cómo devolver el control', () => {
    expect(codigos(grafoConAgente({ name: 'Sofía', exits: [] }, ['timeout']))).toContain('agent_exits_count');
  });

  it('rechaza claves inválidas y repetidas', () => {
    const conMayusculas = codigos(
      grafoConAgente({ exits: [{ key: 'Reservó', label: 'x' }] }, ['timeout']),
    );
    expect(conMayusculas).toContain('agent_exit_key');

    const repetida = codigos(
      grafoConAgente({ exits: [{ key: 'a', label: 'x' }, { key: 'a', label: 'y' }] }, ['timeout']),
    );
    expect(repetida).toContain('agent_exit_dup');
  });

  it('una salida sin explicación no sirve: el agente no sabría cuándo usarla', () => {
    expect(codigos(grafoConAgente({ exits: [{ key: 'listo' }] }, ['timeout']))).toContain('agent_exit_label');
  });

  it('rechaza herramientas que no existen', () => {
    const errores = codigos(
      grafoConAgente({ exits: EXITS, tools: ['borrar_todo'] }, ['exit:reservo', 'exit:quiere_persona']),
    );
    expect(errores).toContain('agent_unknown_tool');
  });

  it('una conexión a una salida que el agente no declara es inválida', () => {
    const errores = codigos(grafoConAgente({ exits: EXITS }, ['exit:inventada']));
    expect(errores).toContain('edge_bad_handle');
  });
});
