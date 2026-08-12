import { FlowInboundRouterUseCase } from './flow-inbound-router.use-case.js';

// Rutear por el anuncio que trajo el lead: el de "presupuesto" tiene que caer en
// una automatización distinta que el de "catálogo".
//
// El alcance es explícito y no se deduce de la lista vacía: "solo estos
// anuncios" sin ninguno cargado no matchea nada, en vez de matchear todo.

const FLOW_ANUNCIO = { id: 'f-ad', publishedVersionId: 'v-ad', priority: 10, defaultForPhoneNumberId: null };
const FLOW_GENERAL = { id: 'f-gen', publishedVersionId: 'v-gen', priority: 20, defaultForPhoneNumberId: null };

function version(id: string, adScope: string, adSourceIds: string[] = []) {
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
      senderTypes: [],
      senderLabelIds: [],
      adScope,
      adSourceIds,
      contactPhoneField: null,
      contactNameField: null,
      campaignIds: [],
    },
  };
}

function buildRouter(opts: { flows: any[]; versions: any[]; onStart: jest.Mock }) {
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
    { findByConversationId: async () => [] } as any,
  );
}

const PROMO = {
  sourceType: 'ad',
  sourceId: 'ad-promo',
  sourceUrl: 'https://fb.me/promo',
  headline: 'Camperas 30% off',
  body: null,
  mediaType: null,
  imageUrl: null,
  videoUrl: null,
  thumbnailUrl: null,
  ctwaClid: 'clid-1',
  waMessageId: 'wamid.1',
  capturedAt: new Date('2026-08-10T12:00:00Z'),
};

function input(attribution: Record<string, unknown> | null) {
  return {
    tenantId: 't1',
    phoneId: 'linea-1',
    conversation: {
      id: 'c1',
      agentId: null,
      autopilot: { enabled: true, pausedReason: null, pausedAt: null, aiNode: null },
      attribution,
    },
    contact: { id: 'ct1', phone: '59899123456' },
    message: { id: 'm1', messageType: 'text', body: 'hola' },
    created: true,
    promotedFromCampaign: false,
  } as any;
}

describe('ruteo por anuncio de origen', () => {
  it('un chat del anuncio elegido entra a su automatización', async () => {
    const onStart = jest.fn();
    const router = buildRouter({
      flows: [FLOW_ANUNCIO, FLOW_GENERAL],
      versions: [version('v-ad', 'specific', ['ad-promo']), version('v-gen', 'any')],
      onStart,
    });

    await router.route(input(PROMO));

    expect(onStart.mock.calls[0][0].flowId).toBe('f-ad');
  });

  it('un chat de otro anuncio cae en la automatización general', async () => {
    const onStart = jest.fn();
    const router = buildRouter({
      flows: [FLOW_ANUNCIO, FLOW_GENERAL],
      versions: [version('v-ad', 'specific', ['ad-promo']), version('v-gen', 'any')],
      onStart,
    });

    await router.route(input({ ...PROMO, sourceId: 'ad-catalogo' }));

    expect(onStart.mock.calls[0][0].flowId).toBe('f-gen');
  });

  it('un chat sin anuncio no entra a un disparador de anuncios', async () => {
    const onStart = jest.fn();
    const router = buildRouter({
      flows: [FLOW_ANUNCIO, FLOW_GENERAL],
      versions: [version('v-ad', 'from_ads'), version('v-gen', 'any')],
      onStart,
    });

    await router.route(input(null));

    expect(onStart.mock.calls[0][0].flowId).toBe('f-gen');
  });

  it('"vino de un anuncio" matchea cualquier anuncio, también un posteo', async () => {
    const onStart = jest.fn();
    const router = buildRouter({
      flows: [FLOW_ANUNCIO, FLOW_GENERAL],
      versions: [version('v-ad', 'from_ads'), version('v-gen', 'any')],
      onStart,
    });

    await router.route(input({ ...PROMO, sourceType: 'post', sourceId: 'post-9' }));

    expect(onStart.mock.calls[0][0].flowId).toBe('f-ad');
  });

  it('"solo estos anuncios" sin ninguno cargado no matchea nada', async () => {
    const onStart = jest.fn();
    const router = buildRouter({
      flows: [FLOW_ANUNCIO, FLOW_GENERAL],
      versions: [version('v-ad', 'specific', []), version('v-gen', 'any')],
      onStart,
    });

    await router.route(input(PROMO));

    expect(onStart.mock.calls[0][0].flowId).toBe('f-gen');
  });

  it('un disparador viejo, sin alcance de anuncio, sigue matcheando todo', async () => {
    const onStart = jest.fn();
    const legacy = version('v-gen', 'any');
    delete (legacy.trigger as Record<string, unknown>).adScope;
    delete (legacy.trigger as Record<string, unknown>).adSourceIds;

    const router = buildRouter({ flows: [FLOW_GENERAL], versions: [legacy], onStart });

    await router.route(input(PROMO));

    expect(onStart.mock.calls[0][0].flowId).toBe('f-gen');
  });

  it('deja el anuncio disponible como variable del flujo', async () => {
    const onStart = jest.fn();
    const router = buildRouter({ flows: [FLOW_GENERAL], versions: [version('v-gen', 'any')], onStart });

    await router.route(input(PROMO));

    expect(onStart.mock.calls[0][0].variables.ad).toMatchObject({
      sourceId: 'ad-promo',
      headline: 'Camperas 30% off',
      label: 'Camperas 30% off',
      clickId: 'clid-1',
    });
  });

  it('sin anuncio, la variable queda en null y no inventa nada', async () => {
    const onStart = jest.fn();
    const router = buildRouter({ flows: [FLOW_GENERAL], versions: [version('v-gen', 'any')], onStart });

    await router.route(input(null));

    expect(onStart.mock.calls[0][0].variables.ad).toBeNull();
  });
});
