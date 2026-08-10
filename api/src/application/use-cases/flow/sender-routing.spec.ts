import { FlowInboundRouterUseCase } from './flow-inbound-router.use-case.js';

// Rutear por quién escribe: un proveedor que le contesta al número tiene que
// caer en el flujo de proveedores, no en el de clientes.
//
// Equivocarse acá es peor que un error visible: el mensaje entra igual, arranca
// el flujo equivocado y el cliente recibe algo que no tiene sentido.

const FLOW_PROVEEDORES = {
  id: 'f-prov',
  publishedVersionId: 'v-prov',
  priority: 10,
  defaultForPhoneNumberId: null,
};
const FLOW_CLIENTES = {
  id: 'f-cli',
  publishedVersionId: 'v-cli',
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
  provider?: any;
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
    { findByTenantAndPhone: async () => opts.provider ?? null } as any,
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

const ACTIVE_PROVIDER = { canReceive: true, name: 'Juan' };

describe('ruteo por quién escribe', () => {
  it('un proveedor entra al flujo de proveedores, no al de clientes', async () => {
    const onStart = jest.fn();
    const router = buildRouter({
      flows: [FLOW_PROVEEDORES, FLOW_CLIENTES],
      versions: [version('v-prov', ['proveedor']), version('v-cli', [])],
      provider: ACTIVE_PROVIDER,
      onStart,
    });

    await router.route(input());

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStart.mock.calls[0][0].flowId).toBe('f-prov');
  });

  it('un cliente saltea el flujo de proveedores y cae en el siguiente', async () => {
    const onStart = jest.fn();
    const router = buildRouter({
      flows: [FLOW_PROVEEDORES, FLOW_CLIENTES],
      versions: [version('v-prov', ['proveedor']), version('v-cli', [])],
      provider: null,
      onStart,
    });

    await router.route(input());

    expect(onStart.mock.calls[0][0].flowId).toBe('f-cli');
  });

  it('un proveedor pausado se rutea como cliente', async () => {
    // `canReceive` es false sin opt-in o desactivado: no es un proveedor
    // operativo, así que no puede secuestrar el flujo de proveedores.
    const onStart = jest.fn();
    const router = buildRouter({
      flows: [FLOW_PROVEEDORES, FLOW_CLIENTES],
      versions: [version('v-prov', ['proveedor']), version('v-cli', [])],
      provider: { canReceive: false, name: 'Juan' },
      onStart,
    });

    await router.route(input());

    expect(onStart.mock.calls[0][0].flowId).toBe('f-cli');
  });

  it('distingue un contacto nuevo de uno recurrente', async () => {
    const onStart = jest.fn();
    const router = buildRouter({
      flows: [FLOW_PROVEEDORES, FLOW_CLIENTES],
      versions: [version('v-prov', ['nuevo']), version('v-cli', ['recurrente'])],
      onStart,
    });

    await router.route(input({ created: true }));
    expect(onStart.mock.calls[0][0].flowId).toBe('f-prov');

    onStart.mockClear();
    await router.route(input({ created: false }));
    expect(onStart.mock.calls[0][0].flowId).toBe('f-cli');
  });

  it('filtra por etiqueta con un "o" entre varias', async () => {
    const onStart = jest.fn();
    const router = buildRouter({
      flows: [FLOW_PROVEEDORES, FLOW_CLIENTES],
      versions: [version('v-prov', [], ['lab-mayorista', 'lab-vip']), version('v-cli', [])],
      labels: [{ labelId: 'lab-vip' }],
      onStart,
    });

    await router.route(input());
    expect(onStart.mock.calls[0][0].flowId).toBe('f-prov');
  });

  it('sin la etiqueta pedida, no matchea', async () => {
    const onStart = jest.fn();
    const router = buildRouter({
      flows: [FLOW_PROVEEDORES, FLOW_CLIENTES],
      versions: [version('v-prov', [], ['lab-mayorista']), version('v-cli', [])],
      labels: [{ labelId: 'lab-otra' }],
      onStart,
    });

    await router.route(input());
    expect(onStart.mock.calls[0][0].flowId).toBe('f-cli');
  });

  it('deja el tipo disponible como variable del flujo', async () => {
    // El nodo Condición lo lee como `sender.type` para bifurcar adentro de un
    // mismo flujo, sin necesidad de armar uno por audiencia.
    const onStart = jest.fn();
    const router = buildRouter({
      flows: [FLOW_CLIENTES],
      versions: [version('v-cli', [])],
      provider: ACTIVE_PROVIDER,
      onStart,
    });

    await router.route(input());

    expect(onStart.mock.calls[0][0].variables.sender).toEqual({ type: 'proveedor' });
  });

  it('no consulta nada cuando ningún flujo agarra el mensaje', async () => {
    // La resolución es perezosa y la mayoría de los mensajes entrantes no
    // arrancan un flujo (reanudan uno, o no matchea ninguno). Esos no pagan.
    //
    // Cuando sí arranca uno, la consulta se hace aunque el disparador no haya
    // filtrado: `{{sender.type}}` queda en las variables y tiene que ser
    // correcto, no una adivinanza barata.
    const findByTenantAndPhone = jest.fn().mockResolvedValue(null);
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
      { findByTenantAndPhone } as any,
      { findByConversationId } as any,
    );

    const result = await router.route(input());

    expect(result.handled).toBe(false);
    expect(findByTenantAndPhone).not.toHaveBeenCalled();
    expect(findByConversationId).not.toHaveBeenCalled();
  });

  it('tampoco consulta con el piloto apagado', async () => {
    const findByTenantAndPhone = jest.fn().mockResolvedValue(null);
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
      { findByTenantAndPhone } as any,
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
    expect(findByTenantAndPhone).not.toHaveBeenCalled();
  });
});
