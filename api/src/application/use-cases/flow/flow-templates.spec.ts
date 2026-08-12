import { FLOW_TEMPLATES } from './flow-templates.js';
import { validateFlowGraph, FlowGraphRefs } from './engine/flow-graph.validator.js';
import { outputHandles } from './engine/flow-node-types.js';

// Las plantillas de la galería son lo primero que toca un tenant nuevo: si una
// no pasa la validación de publicación, el "usar plantilla → publicar" falla en
// el primer intento. El validador se fue endureciendo (fallback de ai_route,
// línea de la plantilla), así que esto queda como red para que ningún cambio
// futuro las rompa en silencio.

const refs: FlowGraphRefs = {
  templates: new Map(),
  labelIds: new Set(),
  agentIds: new Set(),
  connectionIds: new Set(),
  phones: new Set(['linea-meta']),
};

describe('galería de plantillas de flujos', () => {
  it('expone las 4 recetas con id y grafo', () => {
    expect(FLOW_TEMPLATES).toHaveLength(4);
    for (const template of FLOW_TEMPLATES) {
      expect(template.id).toMatch(/^[a-z0-9-]+$/);
      expect(template.graph.nodes.length).toBeGreaterThan(1);
    }
  });

  it.each(FLOW_TEMPLATES.map((t) => [t.id, t] as const))('«%s» publica sin errores', (_id, template) => {
    const { errors } = validateFlowGraph(template.graph, refs);
    expect(errors).toEqual([]);
  });

  it.each(FLOW_TEMPLATES.map((t) => [t.id, t] as const))(
    '«%s» conecta solo salidas que existen',
    (_id, template) => {
      const nodeById = new Map(template.graph.nodes.map((n) => [n.id, n]));
      for (const edge of template.graph.edges) {
        const source = nodeById.get(edge.source);
        expect(source).toBeDefined();
        expect(nodeById.has(edge.target)).toBe(true);
        // outputHandles del backend devuelve string[] (el del catálogo de la UI
        // devuelve objetos: son espejos, no el mismo tipo).
        expect(outputHandles(source!)).toContain(edge.sourceHandle);
      }
    },
  );
});
