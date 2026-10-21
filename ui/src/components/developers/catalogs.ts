import type { Translations } from "@/lib/i18n/translations";

/** Eventos suscribibles, con sus textos de la sección developers del i18n */
export const EVENT_CATALOG: {
  value: string;
  labelKey: keyof Translations["developers"];
  descKey: keyof Translations["developers"];
}[] = [
  { value: "message.received", labelKey: "eventMessageReceived", descKey: "eventMessageReceivedDesc" },
  { value: "message.sent", labelKey: "eventMessageSent", descKey: "eventMessageSentDesc" },
  { value: "message.status.updated", labelKey: "eventMessageStatus", descKey: "eventMessageStatusDesc" },
  { value: "conversation.created", labelKey: "eventConvCreated", descKey: "eventConvCreatedDesc" },
  { value: "conversation.assigned", labelKey: "eventConvAssigned", descKey: "eventConvAssignedDesc" },
  { value: "flow.started", labelKey: "eventFlowStarted", descKey: "eventFlowStartedDesc" },
  { value: "flow.completed", labelKey: "eventFlowCompleted", descKey: "eventFlowCompletedDesc" },
  { value: "flow.failed", labelKey: "eventFlowFailed", descKey: "eventFlowFailedDesc" },
  { value: "flow.custom", labelKey: "eventFlowCustom", descKey: "eventFlowCustomDesc" },
  {
    value: "notification.scheduled",
    labelKey: "eventNotificationScheduled",
    descKey: "eventNotificationScheduledDesc",
  },
  {
    value: "notification.sent",
    labelKey: "eventNotificationSent",
    descKey: "eventNotificationSentDesc",
  },
  {
    value: "notification.delivered",
    labelKey: "eventNotificationDelivered",
    descKey: "eventNotificationDeliveredDesc",
  },
  {
    value: "notification.read",
    labelKey: "eventNotificationRead",
    descKey: "eventNotificationReadDesc",
  },
  {
    value: "notification.failed",
    labelKey: "eventNotificationFailed",
    descKey: "eventNotificationFailedDesc",
  },
  {
    value: "notification.canceled",
    labelKey: "eventNotificationCanceled",
    descKey: "eventNotificationCanceledDesc",
  },
];

export interface CatalogQueryParam {
  name: string;
  placeholder?: string;
}

export interface CatalogEndpoint {
  id: string;
  method: "GET" | "POST";
  /** Ruta con placeholders {param} */
  path: string;
  summary: { es: string; en: string };
  pathParams?: string[];
  queryParams?: CatalogQueryParam[];
  bodyExample?: Record<string, unknown>;
}

/** Catálogo del playground: los endpoints de /v1 con ejemplos listos para tocar */
export const ENDPOINT_CATALOG: CatalogEndpoint[] = [
  {
    id: "me",
    method: "GET",
    path: "/v1/me",
    summary: { es: "Cuenta autenticada (prueba de conexión)", en: "Authenticated account (connectivity check)" },
  },
  {
    id: "phone-numbers",
    method: "GET",
    path: "/v1/phone-numbers",
    summary: { es: "Números de WhatsApp de la cuenta", en: "Account WhatsApp numbers" },
  },
  {
    id: "templates",
    method: "GET",
    path: "/v1/templates",
    summary: { es: "Plantillas aprobadas", en: "Approved templates" },
    queryParams: [{ name: "page" }, { name: "limit" }],
  },
  {
    id: "send-message",
    method: "POST",
    path: "/v1/messages",
    summary: { es: "Enviar mensaje a un número", en: "Send a message to a phone number" },
    bodyExample: {
      to: "+59891234567",
      body: "Hola desde la API de asis.chat 👋",
    },
  },
  {
    id: "send-template",
    method: "POST",
    path: "/v1/messages",
    summary: { es: "Enviar plantilla (fuera de ventana de 24 hs)", en: "Send a template (outside the 24h window)" },
    bodyExample: {
      to: "+59891234567",
      templateId: "TEMPLATE_ID",
      variables: { "body.1": "Guille" },
    },
  },
  {
    id: "notifications",
    method: "GET",
    path: "/v1/notifications",
    summary: {
      es: "Historial de notificaciones (estado y timeline)",
      en: "Notification history (status and timeline)",
    },
    queryParams: [
      { name: "status", placeholder: "scheduled | sent | delivered | read | failed | canceled" },
      { name: "templateId" },
      { name: "from" },
      { name: "to" },
      { name: "page" },
      { name: "limit" },
    ],
  },
  {
    id: "notification",
    method: "GET",
    path: "/v1/notifications/{id}",
    summary: { es: "Detalle de una notificación", en: "Notification detail" },
    pathParams: ["id"],
  },
  {
    id: "notification-cancel",
    method: "POST",
    path: "/v1/notifications/{id}/cancel",
    summary: {
      es: "Cancelar una notificación programada",
      en: "Cancel a scheduled notification",
    },
    pathParams: ["id"],
  },
  {
    id: "conversations",
    method: "GET",
    path: "/v1/conversations",
    summary: { es: "Listar conversaciones", en: "List conversations" },
    queryParams: [
      { name: "status", placeholder: "unassigned | active" },
      { name: "phoneNumberId" },
      { name: "page" },
      { name: "limit" },
    ],
  },
  {
    id: "conversation",
    method: "GET",
    path: "/v1/conversations/{id}",
    summary: { es: "Detalle de una conversación", en: "Conversation detail" },
    pathParams: ["id"],
  },
  {
    id: "conversation-messages",
    method: "GET",
    path: "/v1/conversations/{id}/messages",
    summary: { es: "Mensajes de una conversación", en: "Messages of a conversation" },
    pathParams: ["id"],
    queryParams: [{ name: "page" }, { name: "limit" }],
  },
  {
    id: "reply",
    method: "POST",
    path: "/v1/conversations/{id}/messages",
    summary: { es: "Responder en una conversación", en: "Reply in a conversation" },
    pathParams: ["id"],
    bodyExample: { body: "¡Gracias por escribirnos!" },
  },
  {
    id: "contacts",
    method: "GET",
    path: "/v1/contacts",
    summary: { es: "Listar contactos", en: "List contacts" },
    queryParams: [{ name: "search" }, { name: "page" }, { name: "limit" }],
  },
  {
    id: "create-contact",
    method: "POST",
    path: "/v1/contacts",
    summary: { es: "Crear contacto", en: "Create contact" },
    bodyExample: { phone: "+59891234567", name: "Cliente API" },
  },
];
