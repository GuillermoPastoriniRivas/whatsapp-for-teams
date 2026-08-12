import { DEFAULT_FLOW_PRIORITY, buildDefaultPhoneFlowGraph } from './default-phone-flow.js';
import { CreateFlowUseCase } from './create-flow.use-case.js';
import { FlowInboundRouterUseCase } from './flow-inbound-router.use-case.js';
import { validateFlowGraph, FlowGraphRefs } from './engine/flow-graph.validator.js';

// Desde ago-2026 el reparto de un chat nuevo no lo hace más el webhook: lo
// decide una automatización. Para que eso sea cierto, cada número nace con su
// automatización base. Estas pruebas cubren las tres cosas que, si se rompen,
// dejan chats sin atender y nadie se entera hasta que se queja un cliente.

const refs: FlowGraphRefs = {
  templates: new Map(),
  labelIds: new Set(),
  agentIds: new Set(),
  connectionIds: new Set(),
  phones: new Set(['linea-1']),
};

describe('automatización base de un número', () => {
  it('el grafo con reparto al equipo publica sin errores', () => {
    const graph = buildDefaultPhoneFlowGraph('linea-1', { kind: 'team' });
    expect(validateFlowGraph(graph, refs).errors).toEqual([]);
  });

  it('el grafo que entrega al bot publica sin errores', () => {
    const graph = buildDefaultPhoneFlowGraph('linea-1', { kind: 'ai', assistant: { name: 'Asistente' } });
    expect(validateFlowGraph(graph, refs).errors).toEqual([]);
  });

  it('queda acotada a su número y solo a los chats nuevos', () => {
    const graph = buildDefaultPhoneFlowGraph('linea-1', { kind: 'team' });
    const trigger = graph.nodes.find((n) => n.type === 'trigger.inbound_message')!;

    expect(trigger.data.phoneNumberIds).toEqual(['linea-1']);
    // Sin esto reasignaría en cada mensaje entrante, no solo al abrir el chat.
    expect(trigger.data.onlyNewConversations).toBe(true);
  });
});

describe('alcance de líneas del disparador', () => {
  const triggerOnly = (data: Record<string, unknown>) => ({
    nodes: [
      { id: 'trigger', type: 'trigger.inbound_message', position: { x: 0, y: 0 }, data },
      { id: 'fin', type: 'action.handoff_human', position: { x: 200, y: 0 }, data: { note: '' } },
    ],
    edges: [{ id: 'e1', source: 'trigger', sourceHandle: 'out', target: 'fin' }],
  });

  const base = { match: 'any', keywords: [], keywordMode: 'contains' };

  it('rechaza "solo estos números" sin ninguno elegido', () => {
    // Antes esto publicaba: la lista vacía se leía como "todos", así que el
    // flujo hacía lo contrario de lo que decía la pantalla.
    const { errors } = validateFlowGraph(
      triggerOnly({ ...base, phoneScope: 'specific', phoneNumberIds: [] }) as any,
      refs,
    );
    expect(errors.some((e) => e.code === 'no_phone_selected')).toBe(true);
  });

  it('acepta "todos los números" con la lista vacía', () => {
    const { errors } = validateFlowGraph(
      triggerOnly({ ...base, phoneScope: 'all', phoneNumberIds: [] }) as any,
      refs,
    );
    expect(errors).toEqual([]);
  });

  it('los flujos viejos sin phoneScope siguen valiendo', () => {
    // Publicados antes del cambio: la lista vacía sigue significando "todos".
    const { errors } = validateFlowGraph(triggerOnly({ ...base, phoneNumberIds: [] }) as any, refs);
    expect(errors).toEqual([]);
  });
});

describe('prioridad de la automatización base', () => {
  const makeRepo = (existing: Array<{ priority: number; defaultForPhoneNumberId: string | null }>) => {
    const created: any[] = [];
    return {
      created,
      repo: {
        findByTenantId: async () => existing,
        create: async (input: any) => {
          created.push(input);
          return { id: 'nuevo', ...input };
        },
      } as any,
    };
  };

  it('la base nace al fondo, sin importar qué prioridades haya', async () => {
    const { repo, created } = makeRepo([{ priority: 10, defaultForPhoneNumberId: null }]);
    await new CreateFlowUseCase(repo).execute({
      tenantId: 't1',
      createdByAgentId: 'a1',
      name: 'Atención de Ventas',
      defaultForPhoneNumberId: 'linea-1',
    });

    expect(created[0].priority).toBe(DEFAULT_FLOW_PRIORITY);
    expect(created[0].defaultForPhoneNumberId).toBe('linea-1');
  });

  it('un flujo común ignora a las base al calcular su prioridad', async () => {
    // Si contara a la base, el flujo nuevo saldría con 1.000.010 y quedaría
    // detrás de ella — o sea, no se ejecutaría nunca.
    const { repo, created } = makeRepo([
      { priority: 10, defaultForPhoneNumberId: null },
      { priority: DEFAULT_FLOW_PRIORITY, defaultForPhoneNumberId: 'linea-1' },
    ]);
    await new CreateFlowUseCase(repo).execute({ tenantId: 't1', createdByAgentId: 'a1', name: 'Promo' });

    expect(created[0].priority).toBe(20);
    expect(created[0].priority).toBeLessThan(DEFAULT_FLOW_PRIORITY);
  });
});

describe('red de seguridad del router', () => {
  const buildRouter = (autoAssign: { execute: jest.Mock }) =>
    new FlowInboundRouterUseCase(
      { findPublishedByTenantId: async () => [] } as any,
      {} as any,
      { findActiveByConversationId: async () => null } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      autoAssign as any,
      { findByConversationId: async () => [] } as any,
    );

  const input = (created: boolean, autopilotOn = true) =>
    ({
      tenantId: 't1',
      phoneId: 'linea-1',
      conversation: {
        id: 'c1',
        agentId: null,
        autopilot: { enabled: autopilotOn, pausedReason: null, pausedAt: null },
      },
      contact: { id: 'ct1' },
      message: { id: 'm1' },
      created,
      promotedFromCampaign: false,
    }) as any;

  it('reparte al equipo cuando ningún flujo agarra un chat nuevo', async () => {
    // Es el caso del número que se quedó sin su automatización base: sin esto
    // el chat entra y no se le asigna a nadie, en silencio.
    const autoAssign = { execute: jest.fn().mockResolvedValue({ id: 'agente-1' }) };
    const result = await buildRouter(autoAssign).route(input(true));

    expect(result.handled).toBe(false);
    expect(result.fallbackAgent).toEqual({ id: 'agente-1' });
    expect(autoAssign.execute).toHaveBeenCalledWith('c1');
  });

  it('no reasigna cuando el chat ya existía', async () => {
    const autoAssign = { execute: jest.fn() };
    const result = await buildRouter(autoAssign).route(input(false));

    expect(result.handled).toBe(false);
    expect(result.fallbackAgent).toBeNull();
    expect(autoAssign.execute).not.toHaveBeenCalled();
  });
});

describe('piloto automático apagado', () => {
  it('ninguna automatización actúa, pero el chat nuevo igual se reparte', async () => {
    // Esta es la regla que reemplazó a `ignoreIfAssignedToHuman`: alguien tomó
    // el chat, así que los flujos no lo tocan hasta que vuelva a prenderse.
    const autoAssign = { execute: jest.fn().mockResolvedValue({ id: 'agente-1' }) };
    const execRepo = { findActiveByConversationId: jest.fn() };
    const flowRepo = { findPublishedByTenantId: jest.fn() };
    const router = new FlowInboundRouterUseCase(
      flowRepo as any, {} as any, execRepo as any, {} as any, {} as any,
      {} as any, {} as any, {} as any, {} as any, autoAssign as any,
      { findByConversationId: async () => [] } as any,
    );

    const result = await router.route({
      tenantId: 't1',
      phoneId: 'linea-1',
      conversation: { id: 'c1', agentId: null, autopilot: { enabled: false, pausedReason: 'agent_reply', pausedAt: new Date() } },
      contact: { id: 'ct1' },
      message: { id: 'm1' },
      created: true,
      promotedFromCampaign: false,
    } as any);

    expect(result.handled).toBe(false);
    // Corta antes de mirar siquiera si hay flujos publicados.
    expect(flowRepo.findPublishedByTenantId).not.toHaveBeenCalled();
    expect(execRepo.findActiveByConversationId).not.toHaveBeenCalled();
  });
});
