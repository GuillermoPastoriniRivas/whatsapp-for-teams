import { renderTemplate, renderJsonTemplate, resolvePath, normalizeText } from './flow-variable.resolver.js';
import { matchReply, validateAnswer } from './flow-reply.matcher.js';
import { validateFlowGraph, FlowGraphRefs } from './flow-graph.validator.js';
import type { FlowGraph } from '../../../../domain/entities/flow.entity.js';
import type { FlowWaitState } from '../../../../domain/entities/flow-execution.entity.js';

describe('flow-variable.resolver', () => {
  const ctx = {
    contact: { name: 'Ana', customFields: { ciudad: 'Montevideo' } },
    vars: { pago: { status: 201, body: { init_point: 'https://mp.com/x' } }, monto: '1500' },
    message: { body: 'hola' },
  };

  it('renderiza paths anidados y capturas', () => {
    const { text, missing } = renderTemplate(
      'Hola {{contact.name}} de {{contact.customFields.ciudad}}: {{vars.pago.body.init_point}}',
      ctx,
    );
    expect(text).toBe('Hola Ana de Montevideo: https://mp.com/x');
    expect(missing).toEqual([]);
  });

  it('path inexistente ⇒ vacío + missing', () => {
    const { text, missing } = renderTemplate('Hola {{vars.nada}}', ctx);
    expect(text).toBe('Hola ');
    expect(missing).toEqual(['vars.nada']);
  });

  it('renderJsonTemplate escapa valores dentro de comillas', () => {
    const withQuotes = { vars: { nota: 'dijo "hola"\nchau' } };
    const { text } = renderJsonTemplate('{"nota":"{{vars.nota}}"}', withQuotes);
    expect(() => JSON.parse(text)).not.toThrow();
    expect(JSON.parse(text).nota).toBe('dijo "hola"\nchau');
  });

  it('renderJsonTemplate emite literales JSON en posición de valor', () => {
    const { text } = renderJsonTemplate('{"unit_price":{{vars.monto}}}', { vars: { monto: 1500 } });
    expect(JSON.parse(text).unit_price).toBe(1500);
  });

  it('renderJsonTemplate no deja inyectar estructura desde texto del cliente', () => {
    // Monto no numérico (p. ej. si el nodo ask no validó): debe salir como
    // string escapado, nunca como JSON crudo que reescriba el body.
    const hostile = { vars: { monto: '1, "admin": true' } };
    const { text } = renderJsonTemplate('{"unit_price":{{vars.monto}}}', hostile);
    const parsed = JSON.parse(text);
    expect(parsed.admin).toBeUndefined();
    expect(parsed.unit_price).toBe('1, "admin": true');
  });

  it('renderJsonTemplate usa null para paths faltantes en posición de valor', () => {
    const { text } = renderJsonTemplate('{"x":{{vars.nada}}}', { vars: {} });
    expect(JSON.parse(text).x).toBeNull();
  });

  it('resolvePath con índices de array', () => {
    expect(resolvePath({ items: [{ price: 10 }] }, 'items.0.price')).toBe(10);
  });

  it('normalizeText quita tildes y case', () => {
    expect(normalizeText('  Catálogo Té ')).toBe('catalogo te');
  });
});

describe('flow-reply.matcher', () => {
  const waitState: FlowWaitState = {
    nodeId: 'menu',
    kind: 'reply',
    timeoutAt: new Date(),
    waitingSince: new Date(),
    saveAs: null,
    optionMap: { 'fl:menu:0': 'btn:0', 'fl:menu:1': 'btn:1' },
    textMap: { 'ver catalogo': 'btn:0', 'hablar con alguien': 'btn:1' },
    attempts: 0,
    validation: null,
  };

  it('matchea por tap (interactiveReplyId)', () => {
    expect(matchReply(waitState, 'fl:menu:1', null)?.handle).toBe('btn:1');
  });

  it('tap de un mensaje viejo de otro nodo ⇒ null', () => {
    expect(matchReply(waitState, 'fl:otroNodo:0', 'x')).toBeNull();
  });

  it('matchea por texto normalizado', () => {
    expect(matchReply(waitState, null, 'VER CATÁLOGO')?.handle).toBe('btn:0');
  });

  it('matchea por ordinal', () => {
    expect(matchReply(waitState, null, '2')?.handle).toBe('btn:1');
    expect(matchReply(waitState, null, '1.')?.handle).toBe('btn:0');
  });

  it('ordinal fuera de rango ⇒ null', () => {
    expect(matchReply(waitState, null, '9')).toBeNull();
  });

  it('valida numero/email/telefono', () => {
    expect(validateAnswer('numero', '$ 1.500')).toBe(true); // formato LATAM de miles
    expect(validateAnswer('numero', 'mil quinientos')).toBe(false);
    expect(validateAnswer('numero', '1500')).toBe(true);
    expect(validateAnswer('numero', '1500,50')).toBe(true);
    expect(validateAnswer('email', 'ana@mail.com')).toBe(true);
    expect(validateAnswer('email', 'nope')).toBe(false);
    expect(validateAnswer('telefono', '+598 99 123 456')).toBe(true);
    expect(validateAnswer('texto', 'lo que sea')).toBe(true);
    expect(validateAnswer('texto', '   ')).toBe(false);
  });
});

describe('flow-graph.validator', () => {
  const refs: FlowGraphRefs = {
    templates: new Map(),
    labelIds: new Set(),
    agentIds: new Set(),
    aiAgentIds: new Set(['bot1']),
    connectionIds: new Set(),
    phones: new Set(['p1']),
  };

  const trigger = {
    id: 't',
    type: 'trigger.inbound_message',
    position: { x: 0, y: 0 },
    data: { phoneNumberIds: [], match: 'any', keywords: [], keywordMode: 'contains', onlyNewConversations: false, ignoreIfAssignedToHuman: true },
  };

  it('acepta un flujo mínimo válido', () => {
    const graph: FlowGraph = {
      nodes: [
        trigger,
        { id: 'txt', type: 'action.send_text', position: { x: 1, y: 0 }, data: { body: 'hola' } },
      ],
      edges: [{ id: 'e1', source: 't', sourceHandle: 'out', target: 'txt' }],
    };
    const { errors } = validateFlowGraph(graph, refs);
    expect(errors).toEqual([]);
  });

  it('exige exactamente un trigger', () => {
    const graph: FlowGraph = { nodes: [{ id: 'a', type: 'action.send_text', position: { x: 0, y: 0 }, data: { body: 'x' } }], edges: [] };
    const { errors } = validateFlowGraph(graph, refs);
    expect(errors.some((e) => e.code === 'no_trigger')).toBe(true);
  });

  it('rechaza botones fuera de límites de WhatsApp', () => {
    const graph: FlowGraph = {
      nodes: [
        trigger,
        {
          id: 'b',
          type: 'action.send_buttons',
          position: { x: 1, y: 0 },
          data: { body: 'elegí', buttons: [{ title: 'Este título supera con seguridad los veinte caracteres' }] },
        },
      ],
      edges: [{ id: 'e1', source: 't', sourceHandle: 'out', target: 'b' }],
    };
    const { errors } = validateFlowGraph(graph, refs);
    expect(errors.some((e) => e.code === 'button_title_long')).toBe(true);
  });

  it('detecta ciclos sin nodo de espera', () => {
    const graph: FlowGraph = {
      nodes: [
        trigger,
        { id: 'a', type: 'action.send_text', position: { x: 1, y: 0 }, data: { body: 'a' } },
        { id: 'b', type: 'action.internal_note', position: { x: 2, y: 0 }, data: { body: 'b' } },
      ],
      edges: [
        { id: 'e1', source: 't', sourceHandle: 'out', target: 'a' },
        { id: 'e2', source: 'a', sourceHandle: 'out', target: 'b' },
        { id: 'e3', source: 'b', sourceHandle: 'out', target: 'a' },
      ],
    };
    const { errors } = validateFlowGraph(graph, refs);
    expect(errors.some((e) => e.code === 'cycle_without_wait')).toBe(true);
  });

  it('permite ciclos que pasan por una espera', () => {
    const graph: FlowGraph = {
      nodes: [
        trigger,
        {
          id: 'menu',
          type: 'action.send_buttons',
          position: { x: 1, y: 0 },
          data: { body: 'menú', buttons: [{ title: 'Volver' }] },
        },
        { id: 'info', type: 'action.send_text', position: { x: 2, y: 0 }, data: { body: 'info' } },
      ],
      edges: [
        { id: 'e1', source: 't', sourceHandle: 'out', target: 'menu' },
        { id: 'e2', source: 'menu', sourceHandle: 'btn:0', target: 'info' },
        { id: 'e3', source: 'info', sourceHandle: 'out', target: 'menu' },
      ],
    };
    const { errors } = validateFlowGraph(graph, refs);
    expect(errors).toEqual([]);
  });

  it('exige fallback conectado en ai_route y valida referencias', () => {
    const graph: FlowGraph = {
      nodes: [
        trigger,
        {
          id: 'r',
          type: 'logic.ai_route',
          position: { x: 1, y: 0 },
          data: { aiAgentId: 'inexistente', options: [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }] },
        },
      ],
      edges: [{ id: 'e1', source: 't', sourceHandle: 'out', target: 'r' }],
    };
    const { errors } = validateFlowGraph(graph, refs);
    expect(errors.some((e) => e.code === 'bad_ai_agent')).toBe(true);
  });

  it('bloquea una plantilla que pertenece a otro número', () => {
    const twoLineRefs: FlowGraphRefs = {
      ...refs,
      templates: new Map([['tpl1', { approved: true, phoneNumberId: 'lineaA' }]]),
      phones: new Set(['lineaA', 'lineaB']),
    };
    const graph: FlowGraph = {
      nodes: [
        { ...trigger, data: { ...trigger.data, phoneNumberIds: ['lineaB'] } },
        { id: 'tpl', type: 'action.send_template', position: { x: 1, y: 0 }, data: { templateId: 'tpl1', variables: {} } },
      ],
      edges: [{ id: 'e1', source: 't', sourceHandle: 'out', target: 'tpl' }],
    };
    const { errors } = validateFlowGraph(graph, twoLineRefs);
    expect(errors.some((e) => e.code === 'template_wrong_phone')).toBe(true);
  });

  it('exige nombre de variable y valor en Guardar valor', () => {
    const graph: FlowGraph = {
      nodes: [
        trigger,
        { id: 'v', type: 'action.set_variable', position: { x: 1, y: 0 }, data: { saveAs: 'Mi Var', mode: 'text', value: '' } },
      ],
      edges: [{ id: 'e1', source: 't', sourceHandle: 'out', target: 'v' }],
    };
    const { errors } = validateFlowGraph(graph, refs);
    expect(errors.some((e) => e.code === 'missing_save_as')).toBe(true);
    expect(errors.some((e) => e.code === 'missing_value')).toBe(true);
  });

  it('acepta Guardar valor con código aleatorio sin exigir valor', () => {
    const graph: FlowGraph = {
      nodes: [
        trigger,
        { id: 'v', type: 'action.set_variable', position: { x: 1, y: 0 }, data: { saveAs: 'codigo', mode: 'random_code', length: 6 } },
      ],
      edges: [{ id: 'e1', source: 't', sourceHandle: 'out', target: 'v' }],
    };
    expect(validateFlowGraph(graph, refs).errors).toEqual([]);
  });

  it('exige https en el nodo Enviar archivo', () => {
    const graph: FlowGraph = {
      nodes: [
        trigger,
        { id: 'm', type: 'action.send_media', position: { x: 1, y: 0 }, data: { mediaType: 'image', mediaUrl: 'http://x/y.png' } },
      ],
      edges: [{ id: 'e1', source: 't', sourceHandle: 'out', target: 'm' }],
    };
    expect(validateFlowGraph(graph, refs).errors.some((e) => e.code === 'bad_media_url')).toBe(true);
  });

  it('acepta una URL de archivo construida con variables', () => {
    const graph: FlowGraph = {
      nodes: [
        trigger,
        { id: 'm', type: 'action.send_media', position: { x: 1, y: 0 }, data: { mediaType: 'document', mediaUrl: '{{vars.link}}' } },
      ],
      edges: [{ id: 'e1', source: 't', sourceHandle: 'out', target: 'm' }],
    };
    expect(validateFlowGraph(graph, refs).errors).toEqual([]);
  });

  it('exige nombre en el nodo Avisar a mis sistemas', () => {
    const graph: FlowGraph = {
      nodes: [
        trigger,
        { id: 'e', type: 'action.emit_event', position: { x: 1, y: 0 }, data: { eventName: '', fields: [] } },
      ],
      edges: [{ id: 'e1', source: 't', sourceHandle: 'out', target: 'e' }],
    };
    expect(validateFlowGraph(graph, refs).errors.some((x) => x.code === 'missing_event_name')).toBe(true);
  });

  it('la espera a horario hábil corta ciclos como cualquier espera', () => {
    const graph: FlowGraph = {
      nodes: [
        trigger,
        { id: 'w', type: 'logic.wait_business_hours', position: { x: 1, y: 0 }, data: { schedule: { days: [1], from: '09:00', to: '18:00', timezone: 'America/Montevideo' } } },
        { id: 'n', type: 'action.internal_note', position: { x: 2, y: 0 }, data: { body: 'x' } },
      ],
      edges: [
        { id: 'e1', source: 't', sourceHandle: 'out', target: 'w' },
        { id: 'e2', source: 'w', sourceHandle: 'out', target: 'n' },
        { id: 'e3', source: 'n', sourceHandle: 'out', target: 'w' },
      ],
    };
    expect(validateFlowGraph(graph, refs).errors).toEqual([]);
  });

  it('warning de sesión tras delay largo', () => {
    const graph: FlowGraph = {
      nodes: [
        trigger,
        { id: 'd', type: 'logic.delay', position: { x: 1, y: 0 }, data: { duration: { amount: 2, unit: 'days' } } },
        { id: 'txt', type: 'action.send_text', position: { x: 2, y: 0 }, data: { body: 'hola de nuevo' } },
      ],
      edges: [
        { id: 'e1', source: 't', sourceHandle: 'out', target: 'd' },
        { id: 'e2', source: 'd', sourceHandle: 'out', target: 'txt' },
      ],
    };
    const { errors, warnings } = validateFlowGraph(graph, refs);
    expect(errors).toEqual([]);
    expect(warnings.some((w) => w.code === 'window_after_delay')).toBe(true);
  });
});

describe('flow-graph.validator — ubicación y botón con link', () => {
  const refs: FlowGraphRefs = {
    templates: new Map(),
    labelIds: new Set(),
    agentIds: new Set(),
    aiAgentIds: new Set(),
    connectionIds: new Set(),
    phones: new Set(['p1']),
  };

  const trigger = {
    id: 't',
    type: 'trigger.inbound_message',
    position: { x: 0, y: 0 },
    data: { phoneNumberIds: [], match: 'any', keywords: [], keywordMode: 'contains', onlyNewConversations: false, ignoreIfAssignedToHuman: true },
  };

  const graphWith = (node: Record<string, unknown>): FlowGraph => ({
    nodes: [trigger, { id: 'n', position: { x: 1, y: 0 }, ...node } as FlowGraph['nodes'][number]],
    edges: [{ id: 'e1', source: 't', sourceHandle: 'out', target: 'n' }],
  });

  it('acepta una ubicación con coordenadas válidas', () => {
    const { errors } = validateFlowGraph(
      graphWith({ type: 'action.send_location', data: { latitude: '-34.9011', longitude: '-56.1645' } }),
      refs,
    );
    expect(errors).toEqual([]);
  });

  /** Media ubicación la rechaza Meta y se pierde el mensaje entero. */
  it('bloquea una ubicación sin longitud', () => {
    const { errors } = validateFlowGraph(
      graphWith({ type: 'action.send_location', data: { latitude: '-34.9011', longitude: '' } }),
      refs,
    );
    expect(errors.some((e) => e.code === 'missing_field')).toBe(true);
  });

  it('bloquea coordenadas fuera de rango', () => {
    const { errors } = validateFlowGraph(
      graphWith({ type: 'action.send_location', data: { latitude: '120', longitude: '0' } }),
      refs,
    );
    expect(errors.some((e) => e.code === 'bad_coordinates')).toBe(true);
  });

  /** Con variable no se puede validar al publicar: se resuelve al enviar. */
  it('deja pasar coordenadas que son variables', () => {
    const { errors } = validateFlowGraph(
      graphWith({ type: 'action.send_location', data: { latitude: '{{vars.lat}}', longitude: '{{vars.lng}}' } }),
      refs,
    );
    expect(errors).toEqual([]);
  });

  it('exige un link en el botón con link', () => {
    const { errors } = validateFlowGraph(
      graphWith({ type: 'action.send_cta_url', data: { body: 'Pagá acá', url: 'no-es-una-url' } }),
      refs,
    );
    expect(errors.some((e) => e.code === 'bad_cta_url')).toBe(true);
  });
});
