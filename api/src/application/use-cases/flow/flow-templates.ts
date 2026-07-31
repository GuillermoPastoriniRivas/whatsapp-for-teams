// Galería de plantillas de flujos: grafos estáticos que se clonan como
// borrador. Sin referencias duras a labels/bots/conexiones del tenant — los
// pickers vacíos guían la configuración vía errores de publicación.

import type { FlowGraph } from '../../../domain/entities/flow.entity.js';

export interface FlowTemplateDef {
  id: string;
  name: string;
  description: string;
  graph: FlowGraph;
}

const bienvenidaMenu: FlowGraph = {
  nodes: [
    {
      id: 'trigger',
      type: 'trigger.inbound_message',
      position: { x: 60, y: 260 },
      data: { phoneNumberIds: [], match: 'any', keywords: [], keywordMode: 'contains', onlyNewConversations: true, ignoreIfAssignedToHuman: true },
    },
    {
      id: 'menu',
      type: 'action.send_buttons',
      position: { x: 380, y: 260 },
      data: {
        body: '¡Hola {{contact.name}}! 👋 Gracias por escribirnos. ¿En qué te podemos ayudar?',
        buttons: [{ title: 'Ver información' }, { title: 'Hablar con alguien' }],
        timeout: { amount: 1, unit: 'days' },
        saveAs: 'opcion',
        windowPolicy: 'error',
      },
    },
    {
      id: 'info',
      type: 'action.send_text',
      position: { x: 740, y: 120 },
      data: { body: 'Somos [tu negocio] 🙌\n\n📍 Dirección: …\n🕘 Horarios: …\n💳 Medios de pago: …\n\nSi necesitás algo más, escribinos y te contesta el equipo.', windowPolicy: 'error' },
    },
    {
      id: 'humano',
      type: 'action.handoff_human',
      position: { x: 740, y: 320 },
      data: { note: 'El cliente eligió "{{vars.opcion}}" en el menú de bienvenida.' },
    },
  ],
  edges: [
    { id: 'e1', source: 'trigger', sourceHandle: 'out', target: 'menu' },
    { id: 'e2', source: 'menu', sourceHandle: 'btn:0', target: 'info' },
    { id: 'e3', source: 'menu', sourceHandle: 'btn:1', target: 'humano' },
    { id: 'e4', source: 'menu', sourceHandle: 'other', target: 'humano' },
  ],
};

const fueraDeHorario: FlowGraph = {
  nodes: [
    {
      id: 'trigger',
      type: 'trigger.inbound_message',
      position: { x: 60, y: 240 },
      data: { phoneNumberIds: [], match: 'any', keywords: [], keywordMode: 'contains', onlyNewConversations: false, ignoreIfAssignedToHuman: true },
    },
    {
      id: 'horario',
      type: 'logic.condition',
      position: { x: 380, y: 240 },
      data: {
        logic: 'and',
        rules: [{ op: 'in_schedule', schedule: { days: [1, 2, 3, 4, 5], from: '09:00', to: '18:00', timezone: 'America/Montevideo' } }],
      },
    },
    {
      id: 'derivar',
      type: 'action.handoff_human',
      position: { x: 740, y: 140 },
      data: { note: null },
    },
    {
      id: 'cerrado',
      type: 'action.send_text',
      position: { x: 740, y: 340 },
      data: { body: '¡Gracias por escribirnos! 🙌 En este momento estamos cerrados. Te respondemos apenas abramos (lun a vie de 9 a 18).', windowPolicy: 'error' },
    },
  ],
  edges: [
    { id: 'e1', source: 'trigger', sourceHandle: 'out', target: 'horario' },
    { id: 'e2', source: 'horario', sourceHandle: 'yes', target: 'derivar' },
    { id: 'e3', source: 'horario', sourceHandle: 'no', target: 'cerrado' },
  ],
};

const calificarLeads: FlowGraph = {
  nodes: [
    {
      id: 'trigger',
      type: 'trigger.inbound_message',
      position: { x: 60, y: 240 },
      data: { phoneNumberIds: [], match: 'any', keywords: [], keywordMode: 'contains', onlyNewConversations: true, ignoreIfAssignedToHuman: true },
    },
    {
      id: 'nombre',
      type: 'action.ask',
      position: { x: 360, y: 240 },
      data: {
        body: '¡Hola! 👋 Para ayudarte mejor, ¿me decís tu nombre?',
        saveAs: 'nombre',
        validation: 'texto',
        saveToContact: 'name',
        timeout: { amount: 1, unit: 'days' },
        windowPolicy: 'error',
      },
    },
    {
      id: 'interes',
      type: 'action.send_list',
      position: { x: 660, y: 240 },
      data: {
        body: 'Genial, {{vars.nombre}} 🙌 ¿Qué estás buscando?',
        buttonText: 'Ver opciones',
        rows: [
          { title: 'Quiero comprar', description: 'Precios y disponibilidad' },
          { title: 'Tengo una consulta', description: 'Información general' },
          { title: 'Soporte', description: 'Ya soy cliente' },
        ],
        saveAs: 'interes',
        timeout: { amount: 1, unit: 'days' },
        windowPolicy: 'error',
      },
    },
    {
      id: 'nota',
      type: 'action.internal_note',
      position: { x: 980, y: 240 },
      data: { body: 'Lead calificado por el flujo:\n• Nombre: {{vars.nombre}}\n• Interés: {{vars.interes}}' },
    },
    {
      id: 'derivar',
      type: 'action.handoff_human',
      position: { x: 1280, y: 240 },
      data: { note: null },
    },
  ],
  edges: [
    { id: 'e1', source: 'trigger', sourceHandle: 'out', target: 'nombre' },
    { id: 'e2', source: 'nombre', sourceHandle: 'reply', target: 'interes' },
    { id: 'e3', source: 'interes', sourceHandle: 'row:0', target: 'nota' },
    { id: 'e4', source: 'interes', sourceHandle: 'row:1', target: 'nota' },
    { id: 'e5', source: 'interes', sourceHandle: 'row:2', target: 'nota' },
    { id: 'e6', source: 'interes', sourceHandle: 'other', target: 'nota' },
    { id: 'e7', source: 'nota', sourceHandle: 'out', target: 'derivar' },
  ],
};

const cobrarMercadoPago: FlowGraph = {
  nodes: [
    {
      id: 'trigger',
      type: 'trigger.inbound_message',
      position: { x: 60, y: 240 },
      data: { phoneNumberIds: [], match: 'keywords', keywords: ['pagar', 'pago', 'link de pago'], keywordMode: 'contains', onlyNewConversations: false, ignoreIfAssignedToHuman: true },
    },
    {
      id: 'monto',
      type: 'action.ask',
      position: { x: 360, y: 240 },
      data: {
        body: '¡Dale! 💳 ¿Por qué monto te genero el link de pago? (solo el número)',
        saveAs: 'monto',
        validation: 'numero',
        invalidMessage: 'Necesito solo el número, por ejemplo: 1500',
        timeout: { amount: 12, unit: 'hours' },
        windowPolicy: 'error',
      },
    },
    {
      id: 'mp',
      type: 'action.http',
      position: { x: 660, y: 240 },
      data: {
        method: 'POST',
        url: 'https://api.mercadopago.com/checkout/preferences',
        headers: [],
        connectionId: '',
        bodyMode: 'json',
        body: '{"items":[{"title":"Pago por WhatsApp","quantity":1,"currency_id":"UYU","unit_price":{{vars.monto}}}]}',
        saveAs: 'pago',
        retryOnFailure: false,
        windowPolicy: 'error',
      },
    },
    {
      id: 'link',
      type: 'action.send_text',
      position: { x: 980, y: 140 },
      data: { body: 'Listo ✅ Acá tenés tu link de pago seguro:\n{{vars.pago.body.init_point}}\n\nAvisanos cuando lo completes.', windowPolicy: 'error' },
    },
    {
      id: 'fallo',
      type: 'action.handoff_human',
      position: { x: 980, y: 360 },
      data: { note: 'El link de pago no se pudo generar (HTTP {{vars.pago.status}}). Atender manualmente.' },
    },
  ],
  edges: [
    { id: 'e1', source: 'trigger', sourceHandle: 'out', target: 'monto' },
    { id: 'e2', source: 'monto', sourceHandle: 'reply', target: 'mp' },
    { id: 'e3', source: 'mp', sourceHandle: 'success', target: 'link' },
    { id: 'e4', source: 'mp', sourceHandle: 'error', target: 'fallo' },
  ],
};

export const FLOW_TEMPLATES: FlowTemplateDef[] = [
  {
    id: 'bienvenida-menu',
    name: 'Menú de bienvenida',
    description: 'Saluda a los clientes nuevos con botones y deriva a tu equipo en menos mensajes.',
    graph: bienvenidaMenu,
  },
  {
    id: 'fuera-de-horario',
    name: 'Fuera de horario',
    description: 'Dentro del horario deriva a tu equipo; fuera, avisa cuándo volvés.',
    graph: fueraDeHorario,
  },
  {
    id: 'calificar-leads',
    name: 'Calificar leads',
    description: 'Pregunta nombre e interés, guarda la ficha del contacto y deriva con contexto.',
    graph: calificarLeads,
  },
  {
    id: 'cobrar-mercadopago',
    name: 'Cobrar con MercadoPago',
    description: 'Genera un link de pago con tu cuenta de MercadoPago y lo envía por WhatsApp.',
    graph: cobrarMercadoPago,
  },
];

export function getFlowTemplate(id: string): FlowTemplateDef | null {
  return FLOW_TEMPLATES.find((t) => t.id === id) ?? null;
}
