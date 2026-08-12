import { worstCaseBillableSends, isBillableSend } from './message-cost.js';
import type { FlowGraph, FlowNode } from '../../../../domain/entities/flow.entity.js';

function nodo(id: string, type: string): FlowNode {
  return { id, type, position: { x: 0, y: 0 }, data: {} } as FlowNode;
}

function arista(source: string, target: string, sourceHandle = 'out') {
  return { id: `${source}->${target}`, source, sourceHandle, target };
}

function grafo(nodes: FlowNode[], edges: ReturnType<typeof arista>[]): FlowGraph {
  return { nodes, edges } as FlowGraph;
}

describe('Costo en mensajes de un flujo', () => {
  describe('qué se cobra', () => {
    it('cuenta los envíos de sesión y las plantillas', () => {
      for (const type of ['action.send_text', 'action.send_buttons', 'action.ask', 'action.ai_reply', 'action.send_flow', 'action.send_template']) {
        expect(isBillableSend(type)).toBe(true);
      }
    });

    it('no cuenta lo que no sale como mensaje', () => {
      for (const type of ['action.typing', 'logic.delay', 'logic.condition', 'action.label', 'action.set_variable', 'action.http', 'trigger.inbound_message']) {
        expect(isBillableSend(type)).toBe(false);
      }
    });
  });

  it('un flujo lineal cuesta la cantidad de envíos que tiene', () => {
    const result = worstCaseBillableSends(
      grafo(
        [nodo('t', 'trigger.inbound_message'), nodo('a', 'action.send_text'), nodo('b', 'action.ask'), nodo('c', 'action.send_text')],
        [arista('t', 'a'), arista('a', 'b'), arista('b', 'c', 'reply')],
      ),
    );

    expect(result.worst).toBe(3);
    expect(result.path).toEqual(['t', 'a', 'b', 'c']);
  });

  it('el nodo de escribiendo y las esperas no suman', () => {
    const result = worstCaseBillableSends(
      grafo(
        [nodo('t', 'trigger.inbound_message'), nodo('typing', 'action.typing'), nodo('delay', 'logic.delay'), nodo('a', 'action.send_text')],
        [arista('t', 'typing'), arista('typing', 'delay'), arista('delay', 'a')],
      ),
    );

    expect(result.worst).toBe(1);
  });

  it('con ramas se queda con la más cara, no con la suma', () => {
    const result = worstCaseBillableSends(
      grafo(
        [
          nodo('t', 'trigger.inbound_message'),
          nodo('menu', 'action.send_buttons'),
          nodo('corta', 'action.send_text'),
          nodo('larga1', 'action.send_text'),
          nodo('larga2', 'action.send_text'),
          nodo('larga3', 'action.send_text'),
        ],
        [
          arista('t', 'menu'),
          arista('menu', 'corta', 'btn:0'),
          arista('menu', 'larga1', 'btn:1'),
          arista('larga1', 'larga2'),
          arista('larga2', 'larga3'),
        ],
      ),
    );

    expect(result.worst).toBe(4);
    expect(result.path).toEqual(['t', 'menu', 'larga1', 'larga2', 'larga3']);
  });

  it('un ciclo por un nodo de espera no cuelga ni da infinito', () => {
    const result = worstCaseBillableSends(
      grafo(
        [nodo('t', 'trigger.inbound_message'), nodo('menu', 'action.send_buttons'), nodo('info', 'action.send_text')],
        [arista('t', 'menu'), arista('menu', 'info', 'btn:0'), arista('info', 'menu')],
      ),
    );

    expect(result.worst).toBe(2);
    expect(result.truncated).toBe(false);
  });

  it('sin disparador arranca por los nodos que nadie apunta', () => {
    const result = worstCaseBillableSends(
      grafo([nodo('a', 'action.send_text'), nodo('b', 'action.send_text')], [arista('a', 'b')]),
    );

    expect(result.worst).toBe(2);
  });

  it('un grafo vacío no cuesta nada', () => {
    expect(worstCaseBillableSends(grafo([], []))).toEqual({ worst: 0, path: [], truncated: false });
  });

  it('ignora las aristas que apuntan a nodos que no existen', () => {
    const result = worstCaseBillableSends(
      grafo([nodo('t', 'trigger.inbound_message'), nodo('a', 'action.send_text')], [arista('t', 'a'), arista('a', 'fantasma')]),
    );

    expect(result.worst).toBe(1);
  });
});
