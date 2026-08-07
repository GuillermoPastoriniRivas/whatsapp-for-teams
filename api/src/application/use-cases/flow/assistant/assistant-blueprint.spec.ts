import { buildAssistantGraph, defaultCopy, describeSchedule, topicsFor, type AssistantAnswers, type AssistantTopic } from './assistant-blueprint.js';
import { validateFlowGraph, type FlowGraphRefs } from '../engine/flow-graph.validator.js';

// La promesa del alta guiada es "de cuatro respuestas a un bot que contesta".
// Si el grafo generado no publica, el usuario nuevo queda varado justo en el
// momento que estamos tratando de salvar. Por eso se valida TODA combinación
// de respuestas contra el validador real de publicación.

const AI_AGENT_ID = 'ai1';

const REFS: FlowGraphRefs = {
  templates: new Map(),
  labelIds: new Set(),
  agentIds: new Set(),
  aiAgentIds: new Set([AI_AGENT_ID]),
  connectionIds: new Set(),
  phones: new Set(['p1']),
};

const BASE: AssistantAnswers = {
  businessName: 'Barbería Don Pedro',
  vertical: 'beauty',
  address: 'Av. Siempre Viva 123',
  topics: ['turno', 'horarios'],
  fallback: 'ai',
  schedule: { days: [1, 2, 3, 4, 5], from: '09:00', to: '18:00', timezone: 'America/Montevideo' },
};

function validate(answers: AssistantAnswers) {
  const graph = buildAssistantGraph(answers, defaultCopy(answers), AI_AGENT_ID);
  return { graph, ...validateFlowGraph(graph, REFS) };
}

describe('assistant-blueprint', () => {
  const verticals: AssistantAnswers['vertical'][] = ['beauty', 'food', 'retail', 'generic'];
  const fallbacks: AssistantAnswers['fallback'][] = ['ai', 'human', 'message'];

  it('genera un grafo publicable para toda combinación de rubro y derivación', () => {
    for (const vertical of verticals) {
      const available = topicsFor(vertical).map((t) => t.id);
      for (const fallback of fallbacks) {
        // Desde ningún tema elegido hasta todos.
        for (let count = 0; count <= available.length; count++) {
          const answers: AssistantAnswers = {
            ...BASE,
            vertical,
            fallback,
            topics: available.slice(0, count) as AssistantTopic[],
          };
          const { errors } = validate(answers);
          expect({ vertical, fallback, count, errors }).toEqual({ vertical, fallback, count, errors: [] });
        }
      }
    }
  });

  it('usa botones hasta 3 opciones y lista cuando hay más', () => {
    const pocos = validate({ ...BASE, vertical: 'generic', topics: ['horarios'] });
    expect(pocos.graph.nodes.find((n) => n.id === 'menu')?.type).toBe('action.send_buttons');

    const muchos = validate({ ...BASE, vertical: 'food', topics: ['pedido', 'precios', 'horarios', 'ubicacion'] });
    expect(muchos.graph.nodes.find((n) => n.id === 'menu')?.type).toBe('action.send_list');
  });

  it('siempre deja la opción de hablar con una persona', () => {
    const { graph } = validate({ ...BASE, topics: [] });
    expect(graph.nodes.some((n) => n.type === 'action.handoff_human')).toBe(true);
  });

  it('responde horarios y dirección con datos propios, sin depender de la IA', () => {
    const { graph } = validate(BASE);
    const horarios = graph.nodes.find((n) => n.id === 'tema-horarios');
    expect(horarios?.type).toBe('action.send_text');
    expect(String((horarios?.data as any).body)).toContain('09:00');
  });

  it('manda al asistente IA los temas que dependen del catálogo', () => {
    const { graph } = validate({ ...BASE, topics: ['turno', 'precios'] });
    const precios = graph.nodes.find((n) => n.id === 'tema-precios');
    expect(precios?.type).toBe('action.handoff_ai');
    expect((precios?.data as any).aiAgentId).toBe(AI_AGENT_ID);
  });

  it('conecta las salidas "otra respuesta" y "sin respuesta" del menú', () => {
    const { graph } = validate(BASE);
    const handles = graph.edges.filter((e) => e.source === 'menu').map((e) => e.sourceHandle);
    expect(handles).toContain('other');
    expect(handles).toContain('timeout');
  });

  it('respeta los límites de WhatsApp en los textos de las opciones', () => {
    const { graph } = validate({ ...BASE, vertical: 'food', topics: ['pedido', 'precios', 'horarios', 'ubicacion'] });
    const rows = (graph.nodes.find((n) => n.id === 'menu')?.data as any).rows as Array<{ title: string }>;
    expect(rows.length).toBeLessThanOrEqual(10);
    for (const row of rows) expect(row.title.length).toBeLessThanOrEqual(24);
  });

  it('describe el horario en palabras, no en números sueltos', () => {
    expect(describeSchedule({ days: [1, 2, 3, 4, 5], from: '09:00', to: '18:00', timezone: 'UTC' }))
      .toBe('lunes a viernes de 09:00 a 18:00');
    expect(describeSchedule({ days: [0, 1, 2, 3, 4, 5, 6], from: '10:00', to: '22:00', timezone: 'UTC' }))
      .toBe('todos los días de 10:00 a 22:00');
    expect(describeSchedule({ days: [1, 3, 5], from: '08:00', to: '12:00', timezone: 'UTC' }))
      .toBe('lunes, miércoles, viernes de 08:00 a 12:00');
  });
});
