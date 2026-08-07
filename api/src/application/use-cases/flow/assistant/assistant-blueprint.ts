// ── Plantilla del asistente generado ─────────────────────────────
//
// El grafo se arma acá de forma DETERMINÍSTICA. La IA, si está disponible,
// solo redacta los textos: si generara la estructura, el primer bot que ve un
// usuario nuevo podría salir mal armado, y ese es justo el momento en que lo
// perdemos.
//
// Cada tema elegido se resuelve por el camino que mejor lo responde:
//   - lo que el negocio ya nos contó (horarios, dirección) → respuesta fija,
//     siempre correcta
//   - lo que depende del catálogo (precios, stock, pedidos) → al asistente IA,
//     que tiene el perfil y sabe derivar si no puede
//   - hablar con alguien → derivación directa

import type { FlowGraph, FlowNode, FlowEdge } from '../../../../domain/entities/flow.entity.js';

export type AssistantTopic =
  | 'horarios'
  | 'ubicacion'
  | 'precios'
  | 'turno'
  | 'pedido'
  | 'stock'
  | 'humano';

export type AssistantFallback = 'ai' | 'human' | 'message';

export interface AssistantAnswers {
  businessName: string;
  vertical: 'beauty' | 'food' | 'retail' | 'generic';
  description?: string;
  address?: string;
  topics: AssistantTopic[];
  fallback: AssistantFallback;
  schedule: { days: number[]; from: string; to: string; timezone: string };
  /** Líneas donde va a atender. Vacío = todas, elegido explícitamente. */
  phoneNumberIds?: string[];
}

/** Textos que la IA puede reescribir; si no está disponible, se usan estos. */
export interface AssistantCopy {
  greeting: string;
  menuFooter: string;
  answers: Partial<Record<AssistantTopic, string>>;
  fallbackMessage: string;
}

export interface TopicDef {
  id: AssistantTopic;
  /** Texto del botón/fila que ve el cliente */
  label: string;
  /** Cómo se responde */
  resolution: 'answer' | 'assistant' | 'human';
}

const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** Los temas que ofrecemos, por rubro. `humano` se agrega siempre al final. */
export const TOPICS_BY_VERTICAL: Record<AssistantAnswers['vertical'], TopicDef[]> = {
  beauty: [
    { id: 'turno', label: 'Sacar un turno', resolution: 'assistant' },
    { id: 'precios', label: 'Precios', resolution: 'assistant' },
    { id: 'horarios', label: 'Horarios', resolution: 'answer' },
    { id: 'ubicacion', label: 'Dónde estamos', resolution: 'answer' },
  ],
  food: [
    { id: 'pedido', label: 'Hacer un pedido', resolution: 'assistant' },
    { id: 'precios', label: 'Ver la carta', resolution: 'assistant' },
    { id: 'horarios', label: 'Horarios', resolution: 'answer' },
    { id: 'ubicacion', label: 'Dónde estamos', resolution: 'answer' },
  ],
  retail: [
    { id: 'stock', label: 'Consultar stock', resolution: 'assistant' },
    { id: 'precios', label: 'Precios', resolution: 'assistant' },
    { id: 'horarios', label: 'Horarios', resolution: 'answer' },
    { id: 'ubicacion', label: 'Dónde estamos', resolution: 'answer' },
  ],
  generic: [
    { id: 'precios', label: 'Precios', resolution: 'assistant' },
    { id: 'horarios', label: 'Horarios', resolution: 'answer' },
    { id: 'ubicacion', label: 'Dónde estamos', resolution: 'answer' },
  ],
};

export const HUMAN_TOPIC: TopicDef = { id: 'humano', label: 'Hablar con alguien', resolution: 'human' };

export function topicsFor(vertical: AssistantAnswers['vertical']): TopicDef[] {
  return [...TOPICS_BY_VERTICAL[vertical], HUMAN_TOPIC];
}

/** "lunes a viernes de 9:00 a 18:00" — legible, sin jerga */
export function describeSchedule(schedule: AssistantAnswers['schedule']): string {
  const days = [...schedule.days].sort((a, b) => a - b);
  if (days.length === 0) return `de ${schedule.from} a ${schedule.to}`;

  const consecutive = days.every((d, i) => i === 0 || d === days[i - 1] + 1);
  const label =
    days.length === 7
      ? 'todos los días'
      : consecutive && days.length > 1
        ? `${DAY_NAMES[days[0]]} a ${DAY_NAMES[days[days.length - 1]]}`
        : days.map((d) => DAY_NAMES[d]).join(', ');

  return `${label} de ${schedule.from} a ${schedule.to}`;
}

export function defaultCopy(answers: AssistantAnswers): AssistantCopy {
  const name = answers.businessName.trim() || 'nuestro negocio';
  return {
    greeting: `¡Hola! 👋 Bienvenido a ${name}. ¿En qué te puedo ayudar?`,
    menuFooter: '',
    answers: {
      horarios: `Nuestro horario de atención es ${describeSchedule(answers.schedule)}.`,
      ubicacion: answers.address?.trim()
        ? `Estamos en ${answers.address.trim()}. ¡Te esperamos!`
        : 'En un momento te paso la dirección.',
    },
    fallbackMessage:
      answers.fallback === 'message'
        ? 'Gracias por escribir. Ya le avisamos al equipo y te responden a la brevedad.'
        : 'Dejame que te ayude con eso.',
  };
}

/**
 * Arma el grafo. Siempre válido por construcción: un disparador, el menú
 * dentro de los límites de WhatsApp (3 botones o hasta 10 filas), y cada
 * salida conectada a algo.
 */
export function buildAssistantGraph(
  answers: AssistantAnswers,
  copy: AssistantCopy,
  /** Config del asistente, embebida en los nodos de IA (ya no hay bot aparte). */
  aiConfig: Record<string, unknown>,
): FlowGraph {
  const chosen = topicsFor(answers.vertical).filter(
    (topic) => answers.topics.includes(topic.id) || topic.id === 'humano',
  );
  // Siempre queda al menos "hablar con alguien"; el menú nunca sale vacío.
  const topics = chosen.length > 0 ? chosen : [HUMAN_TOPIC];

  // Hasta 3 opciones entran como botones (un toque); más, como lista.
  const useButtons = topics.length <= 3;
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];

  nodes.push({
    id: 'inicio',
    type: 'trigger.inbound_message',
    position: { x: 40, y: 220 },
    data: {
      phoneScope: (answers.phoneNumberIds ?? []).length > 0 ? 'specific' : 'all',
      phoneNumberIds: answers.phoneNumberIds ?? [],
      match: 'any',
      keywords: [],
      keywordMode: 'contains',
      onlyNewConversations: false,
    },
  });

  const menuData: Record<string, unknown> = {
    body: copy.greeting,
    footer: copy.menuFooter || undefined,
    timeout: { amount: 1, unit: 'days' },
    saveAs: 'eleccion',
    windowPolicy: 'error',
  };
  if (useButtons) {
    menuData.buttons = topics.map((topic) => ({ title: topic.label.substring(0, 20) }));
  } else {
    menuData.buttonText = 'Ver opciones';
    menuData.rows = topics.map((topic) => ({ title: topic.label.substring(0, 24), description: '' }));
  }

  nodes.push({
    id: 'menu',
    type: useButtons ? 'action.send_buttons' : 'action.send_list',
    position: { x: 340, y: 200 },
    data: menuData,
  });
  edges.push({ id: 'e-inicio', source: 'inicio', sourceHandle: 'out', target: 'menu' });

  const handlePrefix = useButtons ? 'btn' : 'row';
  topics.forEach((topic, index) => {
    const nodeId = `tema-${topic.id}`;
    const y = 60 + index * 150;

    if (topic.resolution === 'answer') {
      nodes.push({
        id: nodeId,
        type: 'action.send_text',
        position: { x: 700, y },
        data: { body: copy.answers[topic.id] ?? '', windowPolicy: 'error' },
      });
      // Después de responder vuelve al menú: el cliente puede seguir sin
      // escribir de nuevo. El ciclo es válido porque pasa por una espera.
      edges.push({ id: `e-${topic.id}-vuelve`, source: nodeId, sourceHandle: 'out', target: 'menu' });
    } else if (topic.resolution === 'human') {
      nodes.push({
        id: nodeId,
        type: 'action.handoff_human',
        position: { x: 700, y },
        data: { note: `El cliente eligió "${topic.label}" en el menú.` },
      });
    } else {
      nodes.push({
        id: nodeId,
        type: 'action.handoff_ai',
        position: { x: 700, y },
        data: { ...aiConfig },
      });
    }

    edges.push({
      id: `e-menu-${topic.id}`,
      source: 'menu',
      sourceHandle: `${handlePrefix}:${index}`,
      target: nodeId,
    });
  });

  // Rama "escribió otra cosa" y "no respondió".
  const fallbackId = 'sin-opcion';
  const fallbackY = 60 + topics.length * 150;
  if (answers.fallback === 'human') {
    nodes.push({
      id: fallbackId,
      type: 'action.handoff_human',
      position: { x: 700, y: fallbackY },
      data: { note: 'El cliente escribió algo que no estaba en el menú.' },
    });
  } else if (answers.fallback === 'message') {
    nodes.push({
      id: fallbackId,
      type: 'action.send_text',
      position: { x: 700, y: fallbackY },
      data: { body: copy.fallbackMessage, windowPolicy: 'error' },
    });
    nodes.push({
      id: 'aviso-equipo',
      type: 'action.internal_note',
      position: { x: 1020, y: fallbackY },
      data: { body: 'Consulta sin resolver por el menú: {{message.body}}' },
    });
    edges.push({ id: 'e-fallback-nota', source: fallbackId, sourceHandle: 'out', target: 'aviso-equipo' });
  } else {
    nodes.push({
      id: fallbackId,
      type: 'action.handoff_ai',
      position: { x: 700, y: fallbackY },
      data: { ...aiConfig },
    });
  }

  edges.push({ id: 'e-menu-other', source: 'menu', sourceHandle: 'other', target: fallbackId });
  edges.push({ id: 'e-menu-timeout', source: 'menu', sourceHandle: 'timeout', target: fallbackId });

  return { nodes, edges };
}
