// ── Validación semántica de publicación ──────────────────────────
// Pura: recibe el grafo + referencias ya cargadas y devuelve errores
// (bloquean) y warnings (no bloquean).

import type { FlowGraph, FlowNode } from '../../../../domain/entities/flow.entity.js';
import {
  NODE_TYPES,
  durationToMs,
  isSessionSend,
  isTrigger,
  isWaitNode,
  outputHandles,
  phoneScopeOf,
  adScopeOf,
  MAX_WAIT_MS,
} from './flow-node-types.js';
import { WHATSAPP_COMPONENT_LIMITS as LIMITS } from './whatsapp-component-limits.js';

/**
 * "Solo estos números" sin ninguno tildado no dispara nunca. Antes se publicaba
 * sin chistar porque la lista vacía se leía como "todos", así que el flujo
 * hacía lo contrario de lo que decía la pantalla.
 */
function lintPhoneScope(
  data: Record<string, any>,
  id: string,
  err: (code: string, message: string, nodeId?: string) => void,
): void {
  const ids = Array.isArray(data.phoneNumberIds) ? data.phoneNumberIds : [];
  if (phoneScopeOf(data) === 'specific' && ids.length === 0) {
    err('no_phone_selected', 'Elegí al menos un número, o cambiá el disparador a "Todos los números".', id);
  }
}

function lintAdScope(
  data: Record<string, any>,
  id: string,
  err: (code: string, message: string, nodeId?: string) => void,
): void {
  const ids = Array.isArray(data.adSourceIds) ? data.adSourceIds : [];
  if (adScopeOf(data) === 'specific' && ids.length === 0) {
    err('no_ad_selected', 'Agregá al menos un ID de anuncio, o cambiá el disparador a "Cualquier origen".', id);
  }
}

export interface FlowGraphIssue {
  nodeId?: string;
  code: string;
  message: string;
}

export interface FlowGraphRefs {
  /** id de plantilla → aprobada y en qué línea vive */
  templates: Map<string, { approved: boolean; phoneNumberId: string }>;
  labelIds: Set<string>;
  /** agentes humanos */
  agentIds: Set<string>;
  connectionIds: Set<string>;
  /** ids de las líneas del tenant */
  phones: Set<string>;
}

export interface FlowGraphValidation {
  errors: FlowGraphIssue[];
  warnings: FlowGraphIssue[];
}

const MAX_NODES = LIMITS.graph.maxNodes;
const MAX_EDGES = LIMITS.graph.maxEdges;

export function validateFlowGraph(graph: FlowGraph, refs: FlowGraphRefs): FlowGraphValidation {
  const errors: FlowGraphIssue[] = [];
  const warnings: FlowGraphIssue[] = [];
  const err = (code: string, message: string, nodeId?: string) => errors.push({ code, message, nodeId });
  const warn = (code: string, message: string, nodeId?: string) => warnings.push({ code, message, nodeId });

  const nodes = graph.nodes ?? [];
  const edges = graph.edges ?? [];

  // ── Estructura básica ──────────────────────────────────────────
  if (nodes.length === 0) {
    err('empty_graph', 'El flujo no tiene nodos.');
    return { errors, warnings };
  }
  if (nodes.length > MAX_NODES) err('too_many_nodes', `El flujo supera los ${MAX_NODES} nodos.`);
  if (edges.length > MAX_EDGES) err('too_many_edges', `El flujo supera las ${MAX_EDGES} conexiones.`);

  const nodeById = new Map<string, FlowNode>();
  for (const node of nodes) {
    if (nodeById.has(node.id)) err('duplicate_node_id', `Id de nodo duplicado: ${node.id}`, node.id);
    nodeById.set(node.id, node);
    if (!NODE_TYPES.includes(node.type as any)) {
      err('unknown_node_type', `Tipo de nodo desconocido: ${node.type}`, node.id);
    }
  }

  const triggers = nodes.filter((n) => isTrigger(n.type));
  if (triggers.length === 0) err('no_trigger', 'El flujo necesita un disparador.');
  if (triggers.length > 1) err('multiple_triggers', 'El flujo solo puede tener un disparador.');
  const trigger = triggers[0];

  // ── Edges ──────────────────────────────────────────────────────
  const seenSourceHandles = new Set<string>();
  for (const edge of edges) {
    const source = nodeById.get(edge.source);
    if (!source) {
      err('edge_bad_source', `Una conexión sale de un nodo inexistente (${edge.source}).`);
      continue;
    }
    if (!nodeById.has(edge.target)) {
      err('edge_bad_target', `Una conexión apunta a un nodo inexistente (${edge.target}).`, edge.source);
      continue;
    }
    const handles = outputHandles(source);
    if (!handles.includes(edge.sourceHandle)) {
      err('edge_bad_handle', `Salida inválida "${edge.sourceHandle}" en el nodo.`, edge.source);
    }
    const key = `${edge.source}::${edge.sourceHandle}`;
    if (seenSourceHandles.has(key)) {
      err('duplicate_edge', 'Cada salida puede tener una sola conexión.', edge.source);
    }
    seenSourceHandles.add(key);
  }

  // ── Config por tipo ────────────────────────────────────────────
  for (const node of nodes) validateNodeConfig(node, refs, err, warn);

  // La rama de "no se pudo clasificar" es obligatoria: sin ella una respuesta
  // que la IA no reconoce termina la ejecución en silencio, sin contestar ni
  // derivar. Va acá porque validateNodeConfig no ve las edges.
  for (const node of nodes) {
    if (node.type !== 'logic.ai_route') continue;
    if (!seenSourceHandles.has(`${node.id}::fallback`)) {
      err('ai_route_fallback', 'Conectá la salida "No se pudo clasificar": si la IA no reconoce la intención, el flujo se corta sin respuesta.', node.id);
    }
  }

  // ── Alcanzabilidad desde el trigger ────────────────────────────
  if (trigger) {
    const reachable = new Set<string>([trigger.id]);
    const queue = [trigger.id];
    while (queue.length) {
      const current = queue.shift()!;
      for (const edge of edges) {
        if (edge.source === current && !reachable.has(edge.target)) {
          reachable.add(edge.target);
          queue.push(edge.target);
        }
      }
    }
    for (const node of nodes) {
      if (!reachable.has(node.id)) {
        warn('unreachable_node', 'Este nodo no está conectado al flujo y nunca se va a ejecutar.', node.id);
      }
    }
  }

  // ── Plantillas × líneas del disparador ─────────────────────────
  lintTemplatePhones(nodes, trigger, refs, err);

  // ── Ciclos sin espera ──────────────────────────────────────────
  // Se remueven los nodos de espera; si el resto tiene un ciclo, el flujo
  // podría ametrallar mensajes sin frenar.
  detectCycleWithoutWait(nodes, edges, err);

  // ── Ventana de 24 h ────────────────────────────────────────────
  lintWindow(nodes, edges, trigger, warn);

  // ── saveAs duplicados ──────────────────────────────────────────
  const saveAsSeen = new Map<string, string>();
  for (const node of nodes) {
    const saveAs = (node.data as any)?.saveAs;
    if (typeof saveAs === 'string' && saveAs) {
      if (saveAsSeen.has(saveAs) && saveAsSeen.get(saveAs) !== node.id) {
        warn('duplicate_save_as', `La variable "${saveAs}" se guarda en más de un nodo; la última escritura gana.`, node.id);
      }
      saveAsSeen.set(saveAs, node.id);
    }
  }

  return { errors, warnings };
}

// ─────────────────────────────────────────────────────────────────

function validateNodeConfig(
  node: FlowNode,
  refs: FlowGraphRefs,
  err: (code: string, message: string, nodeId?: string) => void,
  warn: (code: string, message: string, nodeId?: string) => void,
): void {
  const data = (node.data ?? {}) as Record<string, any>;
  const id = node.id;

  const requireText = (field: string, label: string, max = 4096) => {
    const value = data[field];
    if (typeof value !== 'string' || !value.trim()) {
      err('missing_field', `Falta "${label}".`, id);
    } else if (value.length > max) {
      err('field_too_long', `"${label}" supera los ${max} caracteres.`, id);
    }
  };

  switch (node.type) {
    case 'trigger.inbound_message': {
      lintPhoneScope(data, id, err);
      lintAdScope(data, id, err);
      if (data.match === 'keywords') {
        const keywords: unknown[] = Array.isArray(data.keywords) ? data.keywords : [];
        if (keywords.length === 0) err('missing_keywords', 'Agregá al menos una palabra clave.', id);
        if (keywords.length > LIMITS.triggerKeywordsMaxCount) {
          err('too_many_keywords', `Máximo ${LIMITS.triggerKeywordsMaxCount} palabras clave.`, id);
        }
      }
      break;
    }
    case 'trigger.webhook': {
      if (typeof data.phoneNumberId !== 'string' || !data.phoneNumberId) {
        err('missing_phone', 'Elegí desde qué número envía este flujo.', id);
      } else if (!refs.phones.has(data.phoneNumberId)) {
        err('bad_phone', 'El número elegido ya no existe.', id);
      }
      break;
    }
    case 'action.send_text':
      requireText('body', 'el mensaje');
      break;
    case 'action.send_location': {
      // Meta rechaza una ubicación a medias y se pierde el mensaje entero, así
      // que las coordenadas se exigen en publicación y no en runtime.
      for (const [field, label, limit] of [
        ['latitude', 'la latitud', 90],
        ['longitude', 'la longitud', 180],
      ] as const) {
        const raw = String(data[field] ?? '').trim();
        if (!raw) {
          err('missing_field', `Falta ${label}.`, id);
        } else if (!raw.includes('{{')) {
          // Con una variable no se puede validar acá: se resuelve al enviar.
          const value = Number(raw);
          if (!Number.isFinite(value) || Math.abs(value) > limit) {
            err('bad_coordinates', `${label} tiene que estar entre -${limit} y ${limit}.`, id);
          }
        }
      }
      break;
    }
    case 'action.send_cta_url': {
      requireText('body', 'el mensaje', LIMITS.ctaUrl.bodyMaxLength);
      const url = String(data.url ?? '').trim();
      if (!/^https?:\/\//i.test(url) && !url.includes('{{')) {
        err('bad_cta_url', 'El botón necesita un link que empiece con https://', id);
      }
      if (String(data.buttonText ?? '').length > LIMITS.ctaUrl.buttonTextMaxLength) {
        err('field_too_long', `El texto del botón supera los ${LIMITS.ctaUrl.buttonTextMaxLength} caracteres.`, id);
      }
      break;
    }
    case 'action.send_contact': {
      if (!String(data.contactName ?? '').trim()) {
        err('missing_contact_name', 'La tarjeta de contacto necesita un nombre.', id);
      }
      if (!String(data.contactPhone ?? '').trim() && !String(data.contactEmail ?? '').trim()) {
        err('missing_contact_data', 'Poné al menos un teléfono o un email: una tarjeta sin nada no sirve de nada.', id);
      }
      break;
    }
    case 'action.send_flow': {
      requireText('body', 'el mensaje que acompaña al formulario', LIMITS.form.bodyMaxLength);
      if (!String(data.flowId ?? '').trim()) {
        err('missing_flow', 'Elegí qué formulario se abre.', id);
      }
      if (!String(data.cta ?? '').trim()) {
        err('missing_flow_cta', 'Poné el texto del botón que abre el formulario.', id);
      } else if (String(data.cta).length > LIMITS.form.ctaMaxLength) {
        err('field_too_long', `El botón del formulario no puede pasar de ${LIMITS.form.ctaMaxLength} caracteres.`, id);
      }
      if (typeof data.saveAs !== 'string' || !/^[a-z0-9_]+$/.test(data.saveAs)) {
        err('missing_save_as', 'Definí dónde guardar lo que complete (letras minúsculas, números y _).', id);
      }
      if (data.mode === 'draft') {
        warn('flow_draft_mode', 'Este formulario se manda en modo borrador: solo lo ven los administradores del número.', id);
      }
      validateTimeout(data.timeout, id, err);
      break;
    }
    case 'action.request_location': {
      requireText('body', 'el mensaje que acompaña al pedido', LIMITS.requestLocation.bodyMaxLength);
      if (typeof data.saveAs !== 'string' || !/^[a-z0-9_]+$/.test(data.saveAs)) {
        err('missing_save_as', 'Definí dónde guardar la ubicación (letras minúsculas, números y _).', id);
      }
      validateTimeout(data.timeout, id, err);
      break;
    }
    case 'action.react': {
      const emoji = String(data.emoji ?? '').trim();
      if (!emoji) err('missing_emoji', 'Elegí con qué emoji reaccionar.', id);
      else if ([...emoji].length > LIMITS.reaction.maxEmojis) {
        err('bad_emoji', 'WhatsApp acepta un solo emoji por reacción.', id);
      }
      break;
    }
    case 'action.typing': {
      const seconds = parseInt(String(data.seconds ?? 3), 10);
      if (!Number.isFinite(seconds) || seconds < LIMITS.typing.minSeconds || seconds > LIMITS.typing.maxSeconds) {
        err(
          'bad_typing_seconds',
          `El "escribiendo…" va entre ${LIMITS.typing.minSeconds} y ${LIMITS.typing.maxSeconds} segundos: Meta lo baja solo a los ${LIMITS.typing.maxSeconds}.`,
          id,
        );
      }
      break;
    }
    case 'action.send_media': {
      const url = String(data.mediaUrl ?? '');
      // Con un archivo de la biblioteca no hace falta URL: lo subimos nosotros.
      if (!data.mediaAssetId && !/^https:\/\//i.test(url) && !url.includes('{{')) {
        err('bad_media_url', 'Elegí un archivo de la biblioteca o pegá una URL https://', id);
      }
      if (data.mediaType === 'document' && data.filename && String(data.filename).length > LIMITS.media.documentFilenameMaxLength) {
        err('filename_too_long', 'El nombre del archivo es demasiado largo.', id);
      }
      break;
    }
    case 'action.set_variable': {
      if (typeof data.saveAs !== 'string' || !/^[a-z0-9_]+$/.test(data.saveAs)) {
        err('missing_save_as', 'Definí el nombre de la variable (letras minúsculas, números y _).', id);
      }
      const mode = String(data.mode ?? 'text');
      if (!['text', 'number', 'increment', 'random_code'].includes(mode)) {
        err('bad_mode', 'Tipo de valor inválido.', id);
      }
      if (mode !== 'random_code' && mode !== 'increment' && !String(data.value ?? '').trim()) {
        err('missing_value', 'Definí el valor a guardar.', id);
      }
      break;
    }
    case 'action.emit_event': {
      const name = String(data.eventName ?? '').trim();
      if (!name) err('missing_event_name', 'Definí el nombre del evento.', id);
      else if (name.length > LIMITS.eventNameMaxLength) {
        err('event_name_too_long', `El nombre del evento supera los ${LIMITS.eventNameMaxLength} caracteres.`, id);
      }
      break;
    }
    case 'logic.wait_business_hours': {
      const schedule = data.schedule;
      if (!schedule || !Array.isArray(schedule.days) || schedule.days.length === 0) {
        err('missing_days', 'Elegí al menos un día hábil.', id);
      }
      if (!/^\d{2}:\d{2}$/.test(String(schedule?.from ?? '')) || !/^\d{2}:\d{2}$/.test(String(schedule?.to ?? ''))) {
        err('bad_schedule', 'Definí el horario de apertura y cierre.', id);
      }
      break;
    }
    case 'trigger.campaign_reply': {
      lintPhoneScope(data, id, err);
      // Sin campañas elegidas dispara con cualquiera: es válido y es el default.
      if (data.campaignIds !== undefined && !Array.isArray(data.campaignIds)) {
        err('bad_campaigns', 'Selección de campañas inválida.', id);
      }
      break;
    }
    case 'action.send_buttons': {
      requireText('body', 'el mensaje', LIMITS.buttons.bodyMaxLength);
      const buttons: Array<{ title?: string }> = Array.isArray(data.buttons) ? data.buttons : [];
      if (buttons.length < LIMITS.buttons.minButtons || buttons.length > LIMITS.buttons.maxButtons) {
        err(
          'buttons_count',
          `Los botones deben ser entre ${LIMITS.buttons.minButtons} y ${LIMITS.buttons.maxButtons} (límite de WhatsApp).`,
          id,
        );
      }
      for (const button of buttons) {
        if (!button?.title?.trim()) err('button_title', 'Todos los botones necesitan un texto.', id);
        else if (button.title.length > LIMITS.buttons.titleMaxLength) {
          err(
            'button_title_long',
            `El botón "${button.title.slice(0, LIMITS.buttons.titleMaxLength)}…" supera los ${LIMITS.buttons.titleMaxLength} caracteres.`,
            id,
          );
        }
      }
      validateTimeout(data.timeout, id, err);
      break;
    }
    case 'action.send_list': {
      requireText('body', 'el mensaje', LIMITS.list.bodyMaxLength);
      const rows: Array<{ title?: string; description?: string }> = Array.isArray(data.rows) ? data.rows : [];
      if (rows.length < LIMITS.list.minRows || rows.length > LIMITS.list.maxRows) {
        err(
          'rows_count',
          `La lista debe tener entre ${LIMITS.list.minRows} y ${LIMITS.list.maxRows} opciones (límite de WhatsApp).`,
          id,
        );
      }
      for (const row of rows) {
        if (!row?.title?.trim()) err('row_title', 'Todas las opciones necesitan un título.', id);
        else if (row.title.length > LIMITS.list.rowTitleMaxLength) {
          err(
            'row_title_long',
            `La opción "${row.title.slice(0, LIMITS.list.rowTitleMaxLength)}…" supera los ${LIMITS.list.rowTitleMaxLength} caracteres.`,
            id,
          );
        }
        if (row?.description && row.description.length > LIMITS.list.rowDescriptionMaxLength) {
          err('row_desc_long', `Las descripciones superan los ${LIMITS.list.rowDescriptionMaxLength} caracteres.`, id);
        }
      }
      if (typeof data.buttonText === 'string' && data.buttonText.length > LIMITS.list.buttonTextMaxLength) {
        err('list_button_long', `El texto del botón de la lista supera los ${LIMITS.list.buttonTextMaxLength} caracteres.`, id);
      }
      validateTimeout(data.timeout, id, err);
      break;
    }
    case 'action.send_template': {
      if (typeof data.templateId !== 'string' || !data.templateId) {
        err('missing_template', 'Elegí una plantilla.', id);
      } else {
        const template = refs.templates.get(data.templateId);
        if (!template) err('bad_template', 'La plantilla elegida ya no existe.', id);
        else if (!template.approved) err('template_not_approved', 'La plantilla no está aprobada por Meta.', id);
      }
      break;
    }
    case 'action.ask': {
      requireText('body', 'la pregunta', LIMITS.ask.bodyMaxLength);
      if (typeof data.saveAs !== 'string' || !/^[a-z0-9_]+$/.test(data.saveAs)) {
        err('missing_save_as', 'Definí el nombre de la variable donde guardar la respuesta (letras minúsculas, números y _).', id);
      }
      validateTimeout(data.timeout, id, err);
      break;
    }
    case 'action.ai_reply':
    case 'action.handoff_ai': {
      // La config del asistente vive en el propio nodo desde ago-2026: ya no
      // hay un bot al que apuntar, así que no hay referencia que validar. Lo
      // único que se pide es que tenga nombre, porque es lo que ve el cliente
      // en la nota de derivación y en el historial del chat.
      const name = String(data.name ?? '').trim();
      if (name.length > LIMITS.assistantNameMaxLength) {
        err('ai_name_too_long', `El nombre del asistente supera los ${LIMITS.assistantNameMaxLength} caracteres.`, id);
      }
      break;
    }
    case 'logic.ai_route': {
      const options: Array<{ key?: string; label?: string }> = Array.isArray(data.options) ? data.options : [];
      if (options.length < LIMITS.aiRoute.minOptions || options.length > LIMITS.aiRoute.maxOptions) {
        err(
          'ai_route_options',
          `Definí entre ${LIMITS.aiRoute.minOptions} y ${LIMITS.aiRoute.maxOptions} opciones de clasificación.`,
          id,
        );
      }
      const keys = new Set<string>();
      for (const option of options) {
        if (!option?.key || !/^[a-z0-9_]+$/.test(option.key)) err('ai_route_key', 'Cada opción necesita una clave (minúsculas/números/_).', id);
        else if (keys.has(option.key)) err('ai_route_dup', `Clave repetida: ${option.key}`, id);
        else keys.add(option.key);
        if (!option?.label?.trim()) err('ai_route_label', 'Cada opción necesita una descripción.', id);
      }
      break;
    }
    case 'action.assign_agent': {
      if (data.mode === 'specific' && (typeof data.agentId !== 'string' || !refs.agentIds.has(data.agentId))) {
        err('bad_agent', 'Elegí un agente del equipo.', id);
      }
      break;
    }
    case 'action.label': {
      if (typeof data.labelId !== 'string' || !refs.labelIds.has(data.labelId)) {
        err('bad_label', 'Elegí una etiqueta existente.', id);
      }
      break;
    }
    case 'action.update_contact': {
      const fields: Array<{ field?: string; value?: string }> = Array.isArray(data.fields) ? data.fields : [];
      if (fields.length === 0) err('missing_fields', 'Definí al menos un campo a actualizar.', id);
      for (const field of fields) {
        const name = field?.field ?? '';
        if (!['name', 'email', 'company', 'notes'].includes(name) && !name.startsWith('custom.')) {
          err('bad_contact_field', `Campo de contacto inválido: ${name}`, id);
        }
      }
      break;
    }
    case 'action.internal_note':
      requireText('body', 'la nota');
      break;
    case 'logic.condition': {
      const rules: Array<{ left?: string; op?: string }> = Array.isArray(data.rules) ? data.rules : [];
      if (rules.length === 0) err('missing_rules', 'Definí al menos una condición.', id);
      break;
    }
    case 'logic.delay': {
      const ms = durationToMs(data.duration);
      if (ms === null) err('bad_duration', 'Definí cuánto esperar.', id);
      else if (ms > MAX_WAIT_MS) err('duration_too_long', 'La espera máxima es de 7 días.', id);
      break;
    }
    case 'action.http': {
      const url = data.url;
      if (typeof url !== 'string' || !/^https:\/\//i.test(url)) {
        err('bad_url', 'La URL debe empezar con https://', id);
      }
      if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(data.method)) {
        err('bad_method', 'Método HTTP inválido.', id);
      }
      if (data.connectionId && !refs.connectionIds.has(data.connectionId)) {
        err('bad_connection', 'La conexión elegida ya no existe.', id);
      }
      const headers: Array<{ name?: string; value?: string }> = Array.isArray(data.headers) ? data.headers : [];
      for (const header of headers) {
        if (/^authorization$/i.test(header?.name ?? '') && header?.value) {
          warn('secret_in_graph', 'Evitá pegar tokens en los headers: creá una Conexión y elegila acá.', id);
        }
      }
      break;
    }
  }
}

function validateTimeout(
  timeout: { amount?: number; unit?: string } | undefined,
  nodeId: string,
  err: (code: string, message: string, nodeId?: string) => void,
): void {
  if (timeout === undefined || timeout === null) return; // default 24 h
  const ms = durationToMs(timeout);
  if (ms === null) err('bad_timeout', 'El tiempo de espera no es válido.', nodeId);
  else if (ms > MAX_WAIT_MS) err('timeout_too_long', 'El tiempo de espera máximo es de 7 días.', nodeId);
}

/**
 * Las líneas donde puede correr el flujo × las plantillas que manda.
 * Una plantilla vive en una línea concreta: enviarla por otra la rechaza Meta.
 */
function lintTemplatePhones(
  nodes: FlowNode[],
  trigger: FlowNode | undefined,
  refs: FlowGraphRefs,
  err: (code: string, message: string, nodeId?: string) => void,
): void {
  if (!trigger) return;

  const data = trigger.data as Record<string, any>;
  const configured: string[] = Array.isArray(data.phoneNumberIds)
    ? data.phoneNumberIds.map(String)
    : data.phoneNumberId
      ? [String(data.phoneNumberId)]
      : [];
  // Vacío = todas las líneas del tenant.
  const targetIds = configured.length > 0 ? configured : [...refs.phones];
  if (targetIds.length === 0) return;

  for (const node of nodes) {
    if (node.type !== 'action.send_template') continue;

    const templateId = (node.data as Record<string, any>)?.templateId;
    const template = typeof templateId === 'string' ? refs.templates.get(templateId) : undefined;
    // Debe coincidir con TODAS las líneas donde puede correr: con el
    // disparador en "todos los números" (el default), alcanza con que una no
    // sea la de la plantilla para que el envío falle en runtime.
    if (template && targetIds.some((id) => id !== template.phoneNumberId)) {
      err(
        'template_wrong_phone',
        'La plantilla es de otro número. Restringí el disparador al número de la plantilla o elegí otra plantilla.',
        node.id,
      );
    }
  }
}

/** Ciclo que no pasa por ningún nodo de espera ⇒ error */
function detectCycleWithoutWait(
  nodes: FlowNode[],
  edges: Array<{ source: string; target: string }>,
  err: (code: string, message: string, nodeId?: string) => void,
): void {
  const nonWaitIds = new Set(nodes.filter((n) => !isWaitNode(n.type)).map((n) => n.id));
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    if (!nonWaitIds.has(edge.source) || !nonWaitIds.has(edge.target)) continue;
    const list = adjacency.get(edge.source) ?? [];
    list.push(edge.target);
    adjacency.set(edge.source, list);
  }

  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  for (const id of nonWaitIds) color.set(id, WHITE);

  const visit = (id: string): string | null => {
    color.set(id, GRAY);
    for (const next of adjacency.get(id) ?? []) {
      if (color.get(next) === GRAY) return next;
      if (color.get(next) === WHITE) {
        const found = visit(next);
        if (found) return found;
      }
    }
    color.set(id, BLACK);
    return null;
  };

  for (const id of nonWaitIds) {
    if (color.get(id) === WHITE) {
      const cycleNode = visit(id);
      if (cycleNode) {
        err(
          'cycle_without_wait',
          'Hay un ciclo sin ningún nodo de espera (pregunta, botones, lista o espera de tiempo): el flujo enviaría mensajes sin parar.',
          cycleNode,
        );
        return;
      }
    }
  }
}

/** Warnings de la ventana de 24 h */
function lintWindow(
  nodes: FlowNode[],
  edges: Array<{ source: string; sourceHandle: string; target: string }>,
  trigger: FlowNode | undefined,
  warn: (code: string, message: string, nodeId?: string) => void,
): void {
  if (!trigger) return;

  // Envío de sesión aguas abajo de un delay ≥ 24 h.
  const longDelays = nodes.filter(
    (n) => n.type === 'logic.delay' && (durationToMs((n.data as any)?.duration) ?? 0) >= 24 * 3_600_000,
  );
  for (const delay of longDelays) {
    const downstream = collectDownstream(delay.id, edges);
    for (const id of downstream) {
      const node = nodes.find((n) => n.id === id);
      if (node && isSessionSend(node.type)) {
        warn(
          'window_after_delay',
          'Después de esperar 24 h o más, este mensaje puede quedar fuera de la ventana de WhatsApp. Considerá usar una plantilla.',
          node.id,
        );
        break;
      }
    }
  }

  // Trigger webhook: el primer envío debería ser plantilla.
  if (trigger.type === 'trigger.webhook') {
    const downstream = collectDownstreamOrdered(trigger.id, edges);
    for (const id of downstream) {
      const node = nodes.find((n) => n.id === id);
      if (!node) continue;
      if (node.type === 'action.send_template') break;
      if (isSessionSend(node.type)) {
        warn(
          'webhook_session_send',
          'Los flujos disparados por webhook suelen llegar fuera de la ventana de 24 h: el primer envío debería ser una plantilla.',
          node.id,
        );
        break;
      }
    }
  }
}

function collectDownstream(start: string, edges: Array<{ source: string; target: string }>): Set<string> {
  const seen = new Set<string>();
  const queue = [start];
  while (queue.length) {
    const current = queue.shift()!;
    for (const edge of edges) {
      if (edge.source === current && !seen.has(edge.target)) {
        seen.add(edge.target);
        queue.push(edge.target);
      }
    }
  }
  return seen;
}

function collectDownstreamOrdered(start: string, edges: Array<{ source: string; target: string }>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  const queue = [start];
  while (queue.length) {
    const current = queue.shift()!;
    for (const edge of edges) {
      if (edge.source === current && !seen.has(edge.target)) {
        seen.add(edge.target);
        result.push(edge.target);
        queue.push(edge.target);
      }
    }
  }
  return result;
}
