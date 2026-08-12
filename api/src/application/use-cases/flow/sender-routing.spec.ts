import { FlowInboundRouterUseCase } from './flow-inbound-router.use-case.js';

// Rutear por quién escribe: un contacto nuevo tiene que caer en el flujo de
// bienvenida y no en el de siempre.
//
// Equivocarse acá es peor que un error visible: el mensaje entra igual, arranca
// el flujo equivocado y el cliente recibe algo que no tiene sentido.

const FLOW_A = {
  id: 'f-a',
  publishedVersionId: 'v-a',
  priority: 10,
  defaultForPhoneNumberId: null,
};
const FLOW_B = {
  id: 'f-b',
  publishedVersionId: 'v-b',
  priority: 20,
  defaultForPhoneNumberId: null,
};

function version(id: string, senderTypes: string[], senderLabelIds: string[] = []) {
  return {
    id,
    graph: { nodes: [{ id: 'trigger', type: 'trigger.inbound_message', data: {} }], edges: [] },
    trigger: {
      type: 'inbound_message',
      phoneNumberIds: [],
      match: 'any',
      keywords: [],
      keywordMode: 'contains',
      onlyNewConversations: false,
      senderTypes,
      senderLabelIds,
      contactPhoneField: null,
      contactNameField: null,
      campaignIds: [],
    },
  };
}

function buildRouter(opts: {
  flows: any[];
  versions: any[];
  labels?: Array<{ labelId: string }>;
  onStart: jest.Mock;
}) {
  const execRepo = {
    findActiveByConversationId: async () => null,
    countStartedSince: async () => 0,
    tryCreateActive: async (input: any) => {
      opts.onStart(input);
      return { id: 'exec-1', ...input };
    },
  };

  return new FlowInboundRouterUseCase(
    { findPublishedByTenantId: async () => opts.flows, findById: async () => ({ name: 'F' }), incrementStats: async () => {} } as any,
    { findByIds: async () => opts.versions } as any,
    execRepo as any,
    {} as any,
    {} as any,
    { create: async () => ({}) } as any,
    { emitToConversation: () => {}, emitToTenant: () => {} } as any,
    { enqueue: async () => {} } as any,
    { emit: () => {} } as any,
    { execute: async () => null } as any,
    { findByConversationId: async () => opts.labels ?? [] } as any,
  );
}

function input(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: 't1',
    phoneId: 'linea-1',
    conversation: { id: 'c1', agentId: null, autopilot: { enabled: true, pausedReason: null, pausedAt: null, aiNode: null } },
    contact: { id: 'ct1', phone: '59899123456' },
    message: { id: 'm1', messageType: 'text', body: 'hola' },
    created: false,
    promotedFromCampaign: false,
    ...overrides,
  } as any;
}

describe('ruteo por quién escribe', () => {
  it('distingue un contacto nuevo de uno recurrente', async () => {
    const onStart = jest.fn();
    const router = buildRouter({
      flows: [FLOW_A, FLOW_B],
      versions: [version('v-a', ['nuevo']), version('v-b', ['recurrente'])],
      onStart,
    });

    await router.route(input({ created: true }));
    expect(onStart.mock.calls[0][0].flowId).toBe('f-a');

    onStart.mockClear();
    await router.route(input({ created: false }));
    expect(onStart.mock.calls[0][0].flowId).toBe('f-b');
  });

  it('un flujo sin filtro agarra a cualquiera', async () => {
    const onStart = jest.fn();
    const router = buildRouter({
      flows: [FLOW_A, FLOW_B],
      versions: [version('v-a', ['nuevo']), version('v-b', [])],
      onStart,
    });

    await router.route(input({ created: false }));

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStart.mock.calls[0][0].flowId).toBe('f-b');
  });

  it('filtra por etiqueta con un "o" entre varias', async () => {
    const onStart = jest.fn();
    const router = buildRouter({
      flows: [FLOW_A, FLOW_B],
      versions: [version('v-a', [], ['lab-mayorista', 'lab-vip']), version('v-b', [])],
      labels: [{ labelId: 'lab-vip' }],
      onStart,
    });

    await router.route(input());
    expect(onStart.mock.calls[0][0].flowId).toBe('f-a');
  });

  it('sin la etiqueta pedida, no matchea', async () => {
    const onStart = jest.fn();
    const router = buildRouter({
      flows: [FLOW_A, FLOW_B],
      versions: [version('v-a', [], ['lab-mayorista']), version('v-b', [])],
      labels: [{ labelId: 'lab-otra' }],
      onStart,
    });

    await router.route(input());
    expect(onStart.mock.calls[0][0].flowId).toBe('f-b');
  });

  it('deja el tipo disponible como variable del flujo', async () => {
    // El nodo Condición lo lee como `sender.type` para bifurcar adentro de un
    // mismo flujo, sin necesidad de armar uno por audiencia.
    const onStart = jest.fn();
    const router = buildRouter({
      flows: [FLOW_B],
      versions: [version('v-b', [])],
      onStart,
    });

    await router.route(input({ created: true }));

    expect(onStart.mock.calls[0][0].variables.sender).toEqual({ type: 'nuevo' });
  });

  it('no consulta nada cuando ningún flujo agarra el mensaje', async () => {
    // La resolución es perezosa y la mayoría de los mensajes entrantes no
    // arrancan un flujo (reanudan uno, o no matchea ninguno). Esos no pagan.
    const findByConversationId = jest.fn().mockResolvedValue([]);

    const router = new FlowInboundRouterUseCase(
      { findPublishedByTenantId: async () => [] } as any,
      { findByIds: async () => [] } as any,
      { findActiveByConversationId: async () => null } as any,
      {} as any, {} as any, {} as any,
      { emitToConversation: () => {}, emitToTenant: () => {} } as any,
      { enqueue: async () => {} } as any,
      { emit: () => {} } as any,
      { execute: async () => null } as any,
      { findByConversationId } as any,
    );

    const result = await router.route(input());

    expect(result.handled).toBe(false);
    expect(findByConversationId).not.toHaveBeenCalled();
  });

  it('tampoco consulta con el piloto apagado', async () => {
    const findByConversationId = jest.fn().mockResolvedValue([]);
    const findPublishedByTenantId = jest.fn();

    const router = new FlowInboundRouterUseCase(
      { findPublishedByTenantId } as any,
      {} as any,
      { findActiveByConversationId: jest.fn() } as any,
      {} as any, {} as any, {} as any,
      { emitToConversation: () => {}, emitToTenant: () => {} } as any,
      {} as any, { emit: () => {} } as any,
      { execute: async () => null } as any,
      { findByConversationId } as any,
    );

    await router.route(
      input({
        conversation: {
          id: 'c1',
          agentId: null,
          autopilot: { enabled: false, pausedReason: 'agent_reply', pausedAt: new Date(), aiNode: null },
        },
      }),
    );

    expect(findPublishedByTenantId).not.toHaveBeenCalled();
    expect(findByConversationId).not.toHaveBeenCalled();
  });
});
