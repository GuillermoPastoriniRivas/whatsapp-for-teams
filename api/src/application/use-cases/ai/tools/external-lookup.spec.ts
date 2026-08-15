import {
  createExternalLookupTools,
  externalLookupsOf,
  externalLookupToolName,
  EXTERNAL_LOOKUP_QUERY_PARAM,
  MAX_EXTERNAL_LOOKUPS,
  MAX_EXTERNAL_RESPONSE_CHARS,
} from './external-lookup.tools.js';

const ctx = {
  conversationId: 'c1', contactId: 'ct1', phoneNumberId: 'p1', tenantId: 't1', agentId: null, agentName: 'Sofía',
};

describe('externalLookupsOf', () => {
  it('descarta las consultas a medio configurar', () => {
    const lookups = externalLookupsOf({
      lookups: [
        { label: 'el stock', url: 'https://x/y?q={{consulta}}' },
        { label: 'sin url' },
        { url: 'https://sin-label' },
      ],
    });
    expect(lookups).toHaveLength(1);
    expect(lookups[0].label).toBe('el stock');
  });
});

describe('externalLookupToolName', () => {
  it('arma un nombre usable a partir de lo que escribió el negocio', () => {
    expect(externalLookupToolName('el stock de un producto', 0)).toBe('consultar_el_stock_de_un_producto');
    expect(externalLookupToolName('Estado del envío', 0)).toBe('consultar_estado_del_envio');
  });

  it('nunca devuelve un nombre vacío', () => {
    expect(externalLookupToolName('¿¿??', 1)).toBe('consultar_externo_2');
  });
});

describe('createExternalLookupTools', () => {
  const lookup = { label: 'el stock', url: 'https://api/stock?q={{consulta}}', connectionId: null };

  it('expone UNA sola pregunta, que es lo que evita hablar de parámetros', () => {
    const [tool] = createExternalLookupTools([lookup], async () => ({ ok: true, body: 'ok' }));
    const schema = tool.definition.parameters as { properties: Record<string, unknown>; required: string[] };
    expect(Object.keys(schema.properties)).toEqual([EXTERNAL_LOOKUP_QUERY_PARAM]);
    expect(schema.required).toEqual([EXTERNAL_LOOKUP_QUERY_PARAM]);
  });

  it('devuelve lo que respondió el sistema del negocio', async () => {
    const [tool] = createExternalLookupTools([lookup], async (_l, query) => ({ ok: true, body: `stock de ${query}: 4` }));
    expect(await tool.handler({ consulta: 'remera negra' }, ctx)).toBe('stock de remera negra: 4');
  });

  it('ante un error le dice al agente que NO invente', async () => {
    const [tool] = createExternalLookupTools([lookup], async () => ({ ok: false, body: '500' }));
    expect(await tool.handler({ consulta: 'x' }, ctx)).toContain('No inventes');
  });

  it('si el sistema se cae, tampoco tira la conversación abajo', async () => {
    const [tool] = createExternalLookupTools([lookup], async () => { throw new Error('timeout'); });
    const out = await tool.handler({ consulta: 'x' }, ctx);
    expect(out).toContain('timeout');
    expect(out).toContain('No inventes');
  });

  it('recorta una respuesta enorme para no comerse el contexto', async () => {
    const [tool] = createExternalLookupTools([lookup], async () => ({ ok: true, body: 'a'.repeat(9000) }));
    const out = await tool.handler({ consulta: 'x' }, ctx);
    expect(out.length).toBeLessThanOrEqual(MAX_EXTERNAL_RESPONSE_CHARS + 1);
  });

  it('no registra más consultas que el tope', () => {
    const muchas = Array.from({ length: 10 }, (_, i) => ({ ...lookup, label: `dato ${i}` }));
    expect(createExternalLookupTools(muchas, async () => ({ ok: true, body: '' }))).toHaveLength(MAX_EXTERNAL_LOOKUPS);
  });
});
