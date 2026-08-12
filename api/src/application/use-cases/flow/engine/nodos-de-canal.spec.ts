import { validateFlowGraph, type FlowGraphRefs } from './flow-graph.validator.js';
import { outputHandles, isWaitNode, isSessionSend, NODE_TYPES } from './flow-node-types.js';
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

function grafoCon(node: FlowNode, handle: string): FlowGraph {
  const disparador = nodo('t1', 'trigger.inbound_message', { phoneScope: 'all', phoneNumberIds: [] });
  const cierre = nodo('fin', 'action.send_text', { body: 'Listo' });
  return {
    nodes: [disparador, node, cierre],
    edges: [
      { id: 'e1', source: 't1', sourceHandle: 'out', target: node.id },
      { id: 'e2', source: node.id, sourceHandle: handle, target: 'fin' },
    ],
  } as FlowGraph;
}

function erroresDe(node: FlowNode, handle: string): string[] {
  return validateFlowGraph(grafoCon(node, handle), refs).errors.map((issue) => issue.code);
}

describe('Nodos nuevos del canal', () => {
  it('están todos declarados en el catálogo del motor', () => {
    for (const type of ['action.send_contact', 'action.request_location', 'action.react', 'action.typing']) {
      expect(NODE_TYPES).toContain(type);
    }
  });

  describe('Enviar contacto', () => {
    const valido = nodo('n1', 'action.send_contact', { contactName: 'Martín', contactPhone: '59899123456' });

    it('publica cuando tiene nombre y una forma de contacto', () => {
      expect(erroresDe(valido, 'out')).toEqual([]);
    });

    it('exige nombre', () => {
      const sinNombre = nodo('n1', 'action.send_contact', { contactPhone: '59899123456' });
      expect(erroresDe(sinNombre, 'out')).toContain('missing_contact_name');
    });

    it('una tarjeta sin teléfono ni email no sirve de nada', () => {
      const vacia = nodo('n1', 'action.send_contact', { contactName: 'Martín' });
      expect(erroresDe(vacia, 'out')).toContain('missing_contact_data');
    });

    it('gasta ventana de 24 h como cualquier mensaje de sesión', () => {
      expect(isSessionSend('action.send_contact')).toBe(true);
    });
  });

  describe('Pedir ubicación', () => {
    const valido = nodo('n1', 'action.request_location', {
      body: '¿Nos compartís tu ubicación?',
      saveAs: 'ubicacion',
      timeout: { amount: 1, unit: 'days' },
    });

    it('publica y espera respuesta', () => {
      expect(erroresDe(valido, 'reply')).toEqual([]);
      expect(isWaitNode('action.request_location')).toBe(true);
    });

    it('separa "mandó la ubicación" de "mandó otra cosa"', () => {
      expect(outputHandles(valido)).toEqual(['reply', 'invalid', 'timeout', 'error']);
    });

    it('exige dónde guardar las coordenadas: si no, se piden y se tiran', () => {
      const sinDestino = nodo('n1', 'action.request_location', { body: 'Mandámela', timeout: { amount: 1, unit: 'days' } });
      expect(erroresDe(sinDestino, 'reply')).toContain('missing_save_as');
    });
  });

  describe('Reaccionar', () => {
    it('publica con un emoji', () => {
      expect(erroresDe(nodo('n1', 'action.react', { emoji: '👍' }), 'out')).toEqual([]);
    });

    it('exige elegir uno', () => {
      expect(erroresDe(nodo('n1', 'action.react', {}), 'out')).toContain('missing_emoji');
    });

    it('rechaza más de un emoji: WhatsApp acepta uno solo', () => {
      expect(erroresDe(nodo('n1', 'action.react', { emoji: '👍👍' }), 'out')).toContain('bad_emoji');
    });
  });

  describe('Escribiendo…', () => {
    it('publica con una duración razonable', () => {
      expect(erroresDe(nodo('n1', 'action.typing', { seconds: 3 }), 'out')).toEqual([]);
    });

    it('no deja pasar los 25 segundos, que es cuando Meta lo baja solo', () => {
      expect(erroresDe(nodo('n1', 'action.typing', { seconds: 40 }), 'out')).toContain('bad_typing_seconds');
    });

    it('espera: sin espera el mensaje siguiente borraría el indicador al instante', () => {
      expect(isWaitNode('action.typing')).toBe(true);
    });
  });
});
