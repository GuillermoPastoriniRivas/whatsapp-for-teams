import { SimulateFlowUseCase } from './simulate-flow.use-case.js';
import { FLOW_TEMPLATES } from '../flow-templates.js';
import { FlowStatus } from '../../../../domain/enums/flow-status.enum.js';
import { FlowExecutionStatus } from '../../../../domain/enums/flow-execution-status.enum.js';
import type { Flow, FlowGraph } from '../../../../domain/entities/flow.entity.js';

// El probador corre el MOTOR REAL contra dobles. Estos tests son la garantía
// de que sigue siendo así: si alguien lo reemplaza por una imitación del
// motor, los recorridos dejan de coincidir y esto falla.

const PHONE = {
  id: 'phone1',
  tenantId: 't1',
  provider: 'meta',
  providerConfig: {},
  status: 'active',
  phoneNumberId: 'meta-1',
  displayPhone: '+598 99 000 000',
  label: 'Principal',
  wabaId: 'waba1',
} as any;

function makeFlow(graph: FlowGraph): Flow {
  return {
    id: 'flow1',
    tenantId: 't1',
    name: 'Flujo de prueba',
    description: null,
    status: FlowStatus.DRAFT,
    draftGraph: graph,
    publishedVersionId: null,
    publishedVersion: null,
    priority: 10,
    webhookToken: null,
    stats: { started: 0, completed: 0, failed: 0, cancelled: 0 },
    createdByAgentId: 'agent1',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Flow;
}

function buildUseCase(flow: Flow) {
  const incrementStats = jest.fn();
  const flowRepo = {
    findById: async () => flow,
    findByTenantId: async () => [flow],
    findPublishedByTenantId: async () => [],
    create: async () => flow,
    update: async () => flow,
    transitionStatus: async () => flow,
    incrementStats,
  } as any;

  const useCase = new SimulateFlowUseCase(
    flowRepo,
    { findById: async () => null } as any,
    { findById: async () => null } as any,
    { findByTenantId: async () => [PHONE], findById: async () => PHONE } as any,
    { findById: async () => null, incrementActiveCount: async () => null } as any,
    { findById: async () => null } as any,
    // proveedores: la prueba no reparte datos a terceros
    { claimNextForService: async () => null } as any,
    { findByTenantId: async () => [], findById: async () => null } as any,
    { findById: async () => null } as any,
    { complete: async () => ({ content: '', toolCalls: [], tokensUsed: { prompt: 0, completion: 0, total: 0 }, finishReason: 'stop' }) } as any,
    { encrypt: (v: string) => v, decrypt: (v: string) => v } as any,
    { findById: async () => null } as any,
    { resolveSendRef: async () => ({ mediaId: 'm1' }) } as any,
  );

  return { useCase, incrementStats };
}

const TRIGGER = {
  id: 't',
  type: 'trigger.inbound_message',
  position: { x: 0, y: 0 },
  data: { phoneNumberIds: [], match: 'any', keywords: [], keywordMode: 'contains' },
};

describe('SimulateFlowUseCase', () => {
  it('corre el flujo y captura lo que el cliente habría recibido', async () => {
    const flow = makeFlow({
      nodes: [
        TRIGGER,
        { id: 'saludo', type: 'action.send_text', position: { x: 1, y: 0 }, data: { body: 'Hola {{contact.name}}' } },
      ],
      edges: [{ id: 'e1', source: 't', sourceHandle: 'out', target: 'saludo' }],
    });
    const { useCase } = buildUseCase(flow);

    const result = await useCase.execute({ tenantId: 't1', flowId: 'flow1', source: 'draft', session: null, text: 'hola' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.outbound).toHaveLength(1);
    expect(result.value.outbound[0].body).toBe('Hola Cliente de prueba');
    expect(result.value.status).toBe(FlowExecutionStatus.COMPLETED);
  });

  it('espera la respuesta en un menú y sigue la rama del botón tocado', async () => {
    const flow = makeFlow({
      nodes: [
        TRIGGER,
        {
          id: 'menu',
          type: 'action.send_buttons',
          position: { x: 1, y: 0 },
          data: { body: '¿Qué necesitás?', buttons: [{ title: 'Precios' }, { title: 'Horarios' }] },
        },
        { id: 'precios', type: 'action.send_text', position: { x: 2, y: 0 }, data: { body: 'Cuesta $100' } },
        { id: 'horarios', type: 'action.send_text', position: { x: 2, y: 1 }, data: { body: 'De 9 a 18' } },
      ],
      edges: [
        { id: 'e1', source: 't', sourceHandle: 'out', target: 'menu' },
        { id: 'e2', source: 'menu', sourceHandle: 'btn:0', target: 'precios' },
        { id: 'e3', source: 'menu', sourceHandle: 'btn:1', target: 'horarios' },
      ],
    });
    const { useCase } = buildUseCase(flow);

    const first = await useCase.execute({ tenantId: 't1', flowId: 'flow1', source: 'draft', session: null, text: 'hola' });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.value.status).toBe(FlowExecutionStatus.WAITING);
    expect(first.value.outbound[0].interactive).toMatchObject({ kind: 'buttons' });

    // El id del botón es el que el motor manda a WhatsApp: 'fl:<nodo>:<idx>'.
    const second = await useCase.execute({
      tenantId: 't1',
      flowId: 'flow1',
      source: 'draft',
      session: JSON.parse(JSON.stringify(first.value.session)), // simula el round-trip HTTP
      optionId: 'fl:menu:1',
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value.outbound.map((o) => o.body)).toEqual(['De 9 a 18']);
    expect(second.value.status).toBe(FlowExecutionStatus.COMPLETED);
  });

  it('guarda la respuesta abierta en una variable', async () => {
    const flow = makeFlow({
      nodes: [
        TRIGGER,
        {
          id: 'preg',
          type: 'action.ask',
          position: { x: 1, y: 0 },
          data: { body: '¿Tu nombre?', saveAs: 'nombre', validation: 'texto' },
        },
        { id: 'saludo', type: 'action.send_text', position: { x: 2, y: 0 }, data: { body: 'Gracias {{vars.nombre}}' } },
      ],
      edges: [
        { id: 'e1', source: 't', sourceHandle: 'out', target: 'preg' },
        { id: 'e2', source: 'preg', sourceHandle: 'reply', target: 'saludo' },
      ],
    });
    const { useCase } = buildUseCase(flow);

    const first = await useCase.execute({ tenantId: 't1', flowId: 'flow1', source: 'draft', session: null, text: 'hola' });
    if (!first.ok) throw new Error('falló el arranque');

    const second = await useCase.execute({
      tenantId: 't1',
      flowId: 'flow1',
      source: 'draft',
      session: JSON.parse(JSON.stringify(first.value.session)),
      text: 'Ana',
    });
    if (!second.ok) throw new Error('falló la respuesta');

    expect(second.value.variables.nombre).toBe('Ana');
    expect(second.value.outbound[0].body).toBe('Gracias Ana');
  });

  it('no toca los contadores del flujo: una prueba no ensucia las métricas', async () => {
    const flow = makeFlow({
      nodes: [TRIGGER, { id: 'x', type: 'action.send_text', position: { x: 1, y: 0 }, data: { body: 'hola' } }],
      edges: [{ id: 'e1', source: 't', sourceHandle: 'out', target: 'x' }],
    });
    const { useCase, incrementStats } = buildUseCase(flow);

    await useCase.execute({ tenantId: 't1', flowId: 'flow1', source: 'draft', session: null, text: 'hola' });
    expect(incrementStats).not.toHaveBeenCalled();
  });

  it('avisa cuando se pide probar publicado y el flujo nunca se publicó', async () => {
    const flow = makeFlow({ nodes: [TRIGGER], edges: [] });
    const { useCase } = buildUseCase(flow);

    const result = await useCase.execute({ tenantId: 't1', flowId: 'flow1', source: 'published', session: null, text: 'hola' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('FLOW_NOT_PUBLISHED');
  });

  it('la plantilla "Menú de bienvenida" se puede recorrer de punta a punta', async () => {
    const template = FLOW_TEMPLATES.find((t) => t.id === 'bienvenida-menu')!;
    const { useCase } = buildUseCase(makeFlow(template.graph));

    const first = await useCase.execute({ tenantId: 't1', flowId: 'flow1', source: 'draft', session: null, text: 'hola' });
    if (!first.ok) throw new Error('falló el arranque');
    expect(first.value.status).toBe(FlowExecutionStatus.WAITING);

    const second = await useCase.execute({
      tenantId: 't1',
      flowId: 'flow1',
      source: 'draft',
      session: JSON.parse(JSON.stringify(first.value.session)),
      optionId: 'fl:menu:0',
    });
    if (!second.ok) throw new Error('falló la elección');
    expect(second.value.outbound.length).toBeGreaterThan(0);
  });
});
