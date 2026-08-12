export interface FlowNodeField {
  name: string;
  type: string;
  required?: boolean;
  note?: string;
}

export const SAVES_A_VARIABLE =
  'Guarda lo que el cliente eligió o respondió en una variable del flujo. Sin esto, cualquier {{vars.<nombre>}} que lo lea sale vacío.';

const TIMEOUT: FlowNodeField = {
  name: 'timeout',
  type: '{ amount: number, unit: "minutes" | "hours" | "days" }',
  note: 'Cuánto esperar la respuesta antes de salir por "timeout". Máximo 7 días, por defecto 24 horas.',
};

const PHONE_SCOPE: FlowNodeField[] = [
  { name: 'phoneScope', type: '"all" | "specific"', required: true, note: 'Sobre qué líneas actúa.' },
  { name: 'phoneNumberIds', type: 'string[]', note: 'Ids de list_phone_numbers. Obligatorio y no vacío si phoneScope es "specific".' },
];

export const FLOW_NODE_DATA_SCHEMA: Record<string, FlowNodeField[]> = {
  'trigger.inbound_message': [
    ...PHONE_SCOPE,
    { name: 'match', type: '"any" | "keywords"', required: true },
    { name: 'keywords', type: 'string[]', note: 'Obligatorio y no vacío si match es "keywords". Máximo 20.' },
    { name: 'keywordMode', type: '"contains" | "exact"' },
    { name: 'onlyNewConversations', type: 'boolean', note: 'Solo el primer mensaje de una conversación nueva.' },
    { name: 'adScope', type: '"any" | "from_ads" | "specific"', note: 'Filtra por click-to-WhatsApp.' },
    { name: 'adSourceIds', type: 'string[]' },
  ],
  'trigger.webhook': [
    { name: 'phoneNumberId', type: 'string', required: true, note: 'Desde qué número envía. Id de list_phone_numbers.' },
  ],
  'trigger.campaign_reply': [
    ...PHONE_SCOPE,
    { name: 'campaignIds', type: 'string[]', note: 'Vacío dispara con cualquier campaña.' },
  ],

  'action.send_text': [
    { name: 'body', type: 'string', required: true, note: 'Hasta 4096 caracteres.' },
    { name: 'quoteLast', type: 'boolean', note: 'Cita el último mensaje del cliente.' },
  ],
  'action.send_media': [
    { name: 'mediaType', type: '"image" | "document" | "video" | "audio" | "sticker"', required: true },
    { name: 'mediaAssetId', type: 'string', note: 'Archivo de la biblioteca. Alternativa a mediaUrl.' },
    { name: 'mediaUrl', type: 'string', note: 'URL https. Obligatoria si no hay mediaAssetId.' },
    { name: 'caption', type: 'string', note: 'Meta rechaza el pie de foto en audio y sticker.' },
    { name: 'filename', type: 'string', note: 'Solo documentos. Hasta 240 caracteres.' },
    { name: 'quoteLast', type: 'boolean' },
  ],
  'action.send_location': [
    { name: 'latitude', type: 'string', required: true, note: 'Entre -90 y 90. Se valida al publicar salvo que sea una variable.' },
    { name: 'longitude', type: 'string', required: true, note: 'Entre -180 y 180.' },
    { name: 'name', type: 'string' },
    { name: 'address', type: 'string' },
  ],
  'action.send_contact': [
    { name: 'contactName', type: 'string', required: true },
    { name: 'contactPhone', type: 'string', note: 'Se exige teléfono o email, al menos uno.' },
    { name: 'contactEmail', type: 'string' },
  ],
  'action.send_buttons': [
    { name: 'body', type: 'string', required: true, note: 'Hasta 1024 caracteres: menos que un mensaje de texto suelto.' },
    { name: 'buttons', type: '[{ title: string }]', required: true, note: 'Entre 1 y 3, título de hasta 20 caracteres. Cada uno abre la salida btn:<índice>.' },
    { name: 'saveAs', type: 'string', note: SAVES_A_VARIABLE },
    TIMEOUT,
  ],
  'action.send_list': [
    { name: 'body', type: 'string', required: true, note: 'Hasta 4096 caracteres.' },
    { name: 'buttonText', type: 'string', note: 'Texto del botón que abre la lista. Hasta 20 caracteres.' },
    { name: 'rows', type: '[{ title: string, description?: string }]', required: true, note: 'Entre 1 y 10. Título hasta 24, descripción hasta 72. Cada una abre la salida row:<índice>.' },
    { name: 'saveAs', type: 'string', note: SAVES_A_VARIABLE },
    TIMEOUT,
  ],
  'action.send_cta_url': [
    { name: 'body', type: 'string', required: true, note: 'Hasta 1024 caracteres.' },
    { name: 'url', type: 'string', required: true, note: 'Tiene que empezar con https:// salvo que la arme una variable.' },
    { name: 'buttonText', type: 'string', note: 'Hasta 20 caracteres.' },
  ],
  'action.send_template': [
    { name: 'templateId', type: 'string', required: true, note: 'Id de list_message_templates. Tiene que estar aprobada por Meta.' },
    { name: 'variables', type: 'Record<string, string>' },
  ],
  'action.ask': [
    { name: 'body', type: 'string', required: true, note: 'La pregunta. Hasta 4096 caracteres.' },
    { name: 'saveAs', type: 'string', required: true, note: 'Minúsculas, números y _. ' + SAVES_A_VARIABLE },
    { name: 'validation', type: '"numero" | null', note: 'Con "numero" la respuesta se guarda como número y lo que no lo sea sale por "invalid".' },
    TIMEOUT,
  ],
  'action.send_flow': [
    { name: 'body', type: 'string', required: true, note: 'Hasta 1024 caracteres.' },
    { name: 'flowId', type: 'string', required: true, note: 'Formulario de WhatsApp publicado en la cuenta de Meta.' },
    { name: 'cta', type: 'string', required: true, note: 'Texto del botón que abre el formulario. Hasta 30 caracteres.' },
    { name: 'saveAs', type: 'string', required: true, note: 'Guarda los campos completados como objeto.' },
    { name: 'mode', type: '"published" | "draft"' },
    TIMEOUT,
  ],
  'action.request_location': [
    { name: 'body', type: 'string', required: true, note: 'Hasta 1024 caracteres.' },
    { name: 'saveAs', type: 'string', required: true, note: 'Guarda { latitude, longitude, name, address }.' },
    TIMEOUT,
  ],
  'action.react': [
    { name: 'emoji', type: 'string', required: true, note: 'Un solo emoji, sobre el último mensaje del cliente.' },
  ],
  'action.typing': [
    { name: 'seconds', type: 'number', note: 'Entre 1 y 25. El nodo espera ese rato: sin la espera el indicador no se ve.' },
  ],

  'action.ai_reply': [
    { name: 'name', type: 'string', note: 'Nombre del asistente, hasta 60 caracteres. Es lo que ve el cliente.' },
    { name: 'instructions', type: 'string', note: 'Qué tiene que hacer. El perfil del negocio (catálogo, FAQs, horarios) se inyecta solo.' },
  ],
  'action.handoff_ai': [
    { name: 'name', type: 'string', note: 'Igual que ai_reply, pero el asistente se queda con la conversación: el flujo termina acá.' },
    { name: 'instructions', type: 'string' },
  ],
  'logic.ai_route': [
    { name: 'options', type: '[{ key: string, label: string }]', required: true, note: 'Entre 2 y 6. key en minúsculas/números/_ y abre la salida opt:<key>; label describe cuándo elegirla.' },
  ],

  'action.handoff_human': [
    { name: 'note', type: 'string', note: 'Nota interna al derivar. El flujo termina acá.' },
  ],
  'action.assign_agent': [
    { name: 'mode', type: '"any" | "specific"', required: true },
    { name: 'agentId', type: 'string', note: 'Obligatorio si mode es "specific". Id de list_team_agents.' },
  ],
  'action.label': [
    { name: 'labelId', type: 'string', required: true, note: 'Id de list_labels. Tiene que existir en la cuenta.' },
  ],
  'action.update_contact': [
    { name: 'fields', type: '[{ field: string, value: string }]', required: true, note: 'field es "name", "email", "company", "notes" o "custom.<lo_que_quieras>". Al menos uno.' },
  ],
  'action.internal_note': [
    { name: 'body', type: 'string', required: true, note: 'Solo la ve el equipo, no el cliente.' },
  ],
  'action.set_variable': [
    { name: 'saveAs', type: 'string', required: true, note: 'Minúsculas, números y _.' },
    { name: 'mode', type: '"text" | "number" | "increment" | "random_code"', required: true },
    { name: 'value', type: 'string', note: 'Obligatorio salvo en "increment" y "random_code".' },
    { name: 'length', type: 'number', note: 'Solo en "random_code". Entre 4 y 10.' },
  ],
  'action.emit_event': [
    { name: 'eventName', type: 'string', required: true, note: 'Hasta 60 caracteres. Sale por los webhooks de la cuenta.' },
    { name: 'fields', type: '[{ key: string, value: string }]' },
  ],

  'logic.condition': [
    { name: 'rules', type: '[{ left: string, op: string, value?: string, schedule?: object }]', required: true, note: 'Al menos una. left es un path como "contact.customFields.ciudad" o "vars.monto". Con op "in_schedule" se evalúa schedule en vez de value.' },
  ],
  'logic.delay': [
    { name: 'duration', type: '{ amount: number, unit: "minutes" | "hours" | "days" }', required: true, note: 'Máximo 7 días. Ojo: después de 24 horas la ventana de WhatsApp puede estar cerrada.' },
  ],
  'logic.wait_business_hours': [
    { name: 'schedule', type: '{ days: number[], from: "HH:MM", to: "HH:MM", timezone: string }', required: true, note: 'days va de 0 (domingo) a 6. Espera hasta que abra.' },
  ],
  'action.http': [
    { name: 'method', type: '"GET" | "POST" | "PUT" | "PATCH" | "DELETE"', required: true },
    { name: 'url', type: 'string', required: true, note: 'Tiene que empezar con https://.' },
    { name: 'headers', type: 'Record<string, string>' },
    { name: 'bodyMode', type: '"json" | null' },
    { name: 'body', type: 'string', note: 'Con bodyMode "json", se interpola escapando los valores.' },
    { name: 'connectionId', type: 'string', note: 'Conexión guardada que aporta el header secreto. Id de list_http_connections.' },
    { name: 'saveAs', type: 'string', note: 'Guarda { status, body } de la respuesta.' },
  ],
};

export const FLOW_NODE_DATA_SCHEMA_NOTES = [
  'Todo campo de texto admite interpolación con {{...}}: vars.<lo que guardaste>, contact.name, contact.customFields.<clave>, message.body, webhook.<campo del payload>, sender.type, ad.titulo y flow.name.',
  'Una referencia a vars.<nombre> que ningún paso guarda con saveAs es un error de publicación: siempre saldría vacía.',
  'Los límites de largo se miden sobre la parte fija del texto, no sobre el template.',
] as const;
