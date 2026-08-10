// ── Catálogo de nodos del builder ────────────────────────────────
// Espeja flow-node-types.ts del backend (tipos y handles deben coincidir).
// Copy del dominio en español latino (igual que el área de agentes IA).

import type { FlowNode } from "@/types";
import type { LucideIcon } from "lucide-react";
import {
  MessageSquareText, SquareMousePointer, List, LayoutTemplate, MessageCircleQuestion,
  Sparkles, Split, Bot, Users, UserPlus, Tag, ContactRound, StickyNote,
  GitBranch, Clock, Globe, Zap, Webhook, Megaphone, Paperclip, Variable, CalendarClock, Radio,
  MapPin, ExternalLink, Share2,
} from "lucide-react";

export type NodeCategory = "trigger" | "message" | "ai" | "team" | "logic" | "integration";

export interface NodeTypeDef {
  type: string;
  label: string;
  description: string;
  category: NodeCategory;
  icon: LucideIcon;
  defaultData: Record<string, unknown>;
}

export const CATEGORY_LABELS: Record<NodeCategory, string> = {
  trigger: "Disparadores",
  message: "Mensajes",
  ai: "Inteligencia artificial",
  team: "Equipo y CRM",
  logic: "Lógica",
  integration: "Integraciones",
};

/** Colores por familia sobre los tokens del tema (dark mode gratis) */
export const CATEGORY_STYLES: Record<NodeCategory, { border: string; iconBg: string; icon: string }> = {
  trigger: { border: "border-l-[var(--accent)]", iconBg: "bg-orange-100 dark:bg-orange-950", icon: "text-orange-600 dark:text-orange-400" },
  message: { border: "border-l-[var(--primary)]", iconBg: "bg-teal-100 dark:bg-teal-950", icon: "text-teal-600 dark:text-teal-400" },
  ai: { border: "border-l-violet-500", iconBg: "bg-violet-100 dark:bg-violet-950", icon: "text-violet-600 dark:text-violet-400" },
  team: { border: "border-l-sky-500", iconBg: "bg-sky-100 dark:bg-sky-950", icon: "text-sky-600 dark:text-sky-400" },
  logic: { border: "border-l-muted-foreground", iconBg: "bg-muted", icon: "text-muted-foreground" },
  integration: { border: "border-l-emerald-500", iconBg: "bg-emerald-100 dark:bg-emerald-950", icon: "text-emerald-600 dark:text-emerald-400" },
};

export const NODE_CATALOG: NodeTypeDef[] = [
  {
    type: "trigger.inbound_message",
    label: "Mensaje recibido",
    description: "Se activa cuando un cliente escribe",
    category: "trigger",
    icon: Zap,
    defaultData: { phoneScope: "all", phoneNumberIds: [], match: "any", keywords: [], keywordMode: "contains", onlyNewConversations: false, senderTypes: [], senderLabelIds: [] },
  },
  {
    type: "trigger.webhook",
    label: "Webhook entrante",
    description: "Un sistema externo (CRM, tienda, formulario) inicia la automatización",
    category: "trigger",
    icon: Webhook,
    defaultData: { phoneNumberId: "", contactPhoneField: "phone", contactNameField: "" },
  },
  {
    type: "trigger.campaign_reply",
    label: "Respuesta de campaña",
    description: "Se activa cuando alguien responde una campaña",
    category: "trigger",
    icon: Megaphone,
    defaultData: { phoneScope: "all", phoneNumberIds: [], campaignIds: [] },
  },
  {
    type: "action.send_text",
    label: "Enviar mensaje",
    description: "Texto simple con variables",
    category: "message",
    icon: MessageSquareText,
    defaultData: { body: "", windowPolicy: "error" },
  },
  {
    type: "action.send_media",
    label: "Enviar archivo",
    description: "Imagen o PDF (catálogo, carta, comprobante)",
    category: "message",
    icon: Paperclip,
    defaultData: { mediaType: "image", mediaAssetId: "", mediaAssetName: "", mediaUrl: "", caption: "", filename: "", windowPolicy: "error" },
  },
  {
    type: "action.send_location",
    label: "Enviar ubicación",
    description: "El pin del local, el punto de retiro, la sucursal",
    category: "message",
    icon: MapPin,
    defaultData: { latitude: "", longitude: "", name: "", address: "", windowPolicy: "error" },
  },
  {
    type: "action.send_cta_url",
    label: "Botón con link",
    description: "Un botón que abre una URL, sin necesidad de plantilla",
    category: "message",
    icon: ExternalLink,
    defaultData: { body: "", footer: "", buttonText: "Abrir", url: "", windowPolicy: "error" },
  },
  {
    type: "action.send_buttons",
    label: "Botones",
    description: "Hasta 3 botones; cada uno abre una rama",
    category: "message",
    icon: SquareMousePointer,
    defaultData: { body: "¿En qué te puedo ayudar?", footer: "", buttons: [{ title: "Opción 1" }, { title: "Opción 2" }], timeout: { amount: 1, unit: "days" }, saveAs: "", invalidMessage: "", windowPolicy: "error" },
  },
  {
    type: "action.send_list",
    label: "Lista",
    description: "Hasta 10 opciones desplegables",
    category: "message",
    icon: List,
    defaultData: { body: "Elegí una opción 👇", footer: "", buttonText: "Ver opciones", rows: [{ title: "Opción 1", description: "" }], timeout: { amount: 1, unit: "days" }, saveAs: "", invalidMessage: "", windowPolicy: "error" },
  },
  {
    type: "action.send_template",
    label: "Plantilla",
    description: "Mensaje aprobado por Meta; reabre la ventana de 24 h",
    category: "message",
    icon: LayoutTemplate,
    defaultData: { templateId: "", variables: {} },
  },
  {
    type: "action.ask",
    label: "Hacer una pregunta",
    description: "Espera la respuesta y la guarda en una variable",
    category: "message",
    icon: MessageCircleQuestion,
    defaultData: { body: "", saveAs: "", validation: "texto", invalidMessage: "", saveToContact: "", timeout: { amount: 1, unit: "days" }, windowPolicy: "error" },
  },
  {
    type: "action.ai_reply",
    label: "Respuesta IA",
    description: "Tu asistente responde una vez y la automatización sigue",
    category: "ai",
    icon: Sparkles,
    defaultData: { aiAgentId: "", instructions: "" },
  },
  {
    type: "logic.ai_route",
    label: "Clasificar con IA",
    description: "La IA elige una rama según la intención",
    category: "ai",
    icon: Split,
    defaultData: { aiAgentId: "", question: "", options: [{ key: "ventas", label: "Quiere comprar" }, { key: "soporte", label: "Necesita ayuda" }] },
  },
  {
    type: "action.handoff_ai",
    label: "Entregar al asistente IA",
    description: "El bot toma la conversación (fin de la automatización)",
    category: "ai",
    icon: Bot,
    defaultData: { aiAgentId: "" },
  },
  {
    type: "action.handoff_provider",
    label: "Pasar el dato a un proveedor",
    description: "Le manda los datos del cliente al WhatsApp de un tercero (el carpintero)",
    category: "team",
    icon: Share2,
    defaultData: {
      service: "{{vars.opcion}}",
      templateId: "",
      providerBody: [
        "Nuevo pedido de {{provider.service}}.",
        "",
        "Cliente: {{contact.name}}",
        "Teléfono: +{{contact.phone}}",
        "",
        "Escribile: https://wa.me/{{contact.phone}}",
      ].join("\n"),
      variables: {},
      notifyCustomer: true,
      customerBody:
        "Listo, le pasé tus datos a {{provider.name}}. Te va a escribir en breve — si querés, escribile vos:",
      customerButtonText: "Escribirle",
    },
  },
  {
    type: "action.handoff_human",
    label: "Pasar a un humano",
    description: "Asigna al equipo con contexto (fin de la automatización)",
    category: "team",
    icon: Users,
    defaultData: { note: "" },
  },
  {
    type: "action.assign_agent",
    label: "Asignar agente",
    description: "Asigna a alguien específico o al menos ocupado",
    category: "team",
    icon: UserPlus,
    defaultData: { mode: "auto", agentId: "" },
  },
  {
    type: "action.label",
    label: "Etiquetar",
    description: "Agrega o quita una etiqueta",
    category: "team",
    icon: Tag,
    defaultData: { action: "add", labelId: "" },
  },
  {
    type: "action.update_contact",
    label: "Actualizar contacto",
    description: "Guarda datos en la ficha del contacto",
    category: "team",
    icon: ContactRound,
    defaultData: { fields: [{ field: "name", value: "" }] },
  },
  {
    type: "action.internal_note",
    label: "Nota interna",
    description: "Deja contexto para el equipo (el cliente no la ve)",
    category: "team",
    icon: StickyNote,
    defaultData: { body: "" },
  },
  {
    type: "action.set_variable",
    label: "Guardar valor",
    description: "Texto, número, contador o código de verificación",
    category: "logic",
    icon: Variable,
    defaultData: { saveAs: "", mode: "text", value: "", length: 6 },
  },
  {
    type: "logic.wait_business_hours",
    label: "Esperar a horario hábil",
    description: "Sigue recién cuando abrís (evita mensajes de madrugada)",
    category: "logic",
    icon: CalendarClock,
    defaultData: {
      schedule: { days: [1, 2, 3, 4, 5], from: "09:00", to: "18:00", timezone: "America/Montevideo" },
    },
  },
  {
    type: "action.emit_event",
    label: "Avisar a mis sistemas",
    description: "Dispara un evento a tus webhooks de desarrollador",
    category: "integration",
    icon: Radio,
    defaultData: { eventName: "", fields: [] },
  },
  {
    type: "logic.condition",
    label: "Condición",
    description: "Ramifica por variables, contacto u horario",
    category: "logic",
    icon: GitBranch,
    defaultData: { logic: "and", rules: [{ left: "message.body", op: "contains", value: "" }] },
  },
  {
    type: "logic.delay",
    label: "Esperar",
    description: "Pausa la automatización un tiempo",
    category: "logic",
    icon: Clock,
    defaultData: { duration: { amount: 30, unit: "minutes" } },
  },
  {
    type: "action.http",
    label: "Solicitud HTTP",
    description: "Llamá a cualquier API: CRM, pagos, lo que sea",
    category: "integration",
    icon: Globe,
    defaultData: { method: "POST", url: "", headers: [], connectionId: "", bodyMode: "json", body: "", saveAs: "", retryOnFailure: false },
  },
];

export const NODE_BY_TYPE = new Map(NODE_CATALOG.map((n) => [n.type, n]));

export function isTriggerType(type: string): boolean {
  return type.startsWith("trigger.");
}

/** Handles de salida con label humano (espeja outputHandles del backend) */
export function nodeHandles(node: FlowNode): Array<{ id: string; label: string; kind: "normal" | "alt" | "error" }> {
  const data = node.data as Record<string, any>;
  switch (node.type) {
    case "trigger.inbound_message":
    case "trigger.webhook":
    case "trigger.campaign_reply":
      return [{ id: "out", label: "", kind: "normal" }];
    case "action.send_text":
    case "action.send_media":
    case "action.send_location":
    // El botón con link abre el navegador: no vuelve como respuesta, así que
    // no abre ramas.
    case "action.send_cta_url":
      return [
        { id: "out", label: "", kind: "normal" },
        { id: "error", label: "Error", kind: "error" },
      ];
    case "action.send_buttons": {
      const buttons: Array<{ title?: string }> = Array.isArray(data.buttons) ? data.buttons : [];
      return [
        ...buttons.map((b, i) => ({ id: `btn:${i}`, label: b?.title || `Botón ${i + 1}`, kind: "normal" as const })),
        { id: "other", label: "Otra respuesta", kind: "alt" },
        { id: "timeout", label: "Sin respuesta", kind: "alt" },
        { id: "error", label: "Error", kind: "error" },
      ];
    }
    case "action.send_list": {
      const rows: Array<{ title?: string }> = Array.isArray(data.rows) ? data.rows : [];
      return [
        ...rows.map((r, i) => ({ id: `row:${i}`, label: r?.title || `Opción ${i + 1}`, kind: "normal" as const })),
        { id: "other", label: "Otra respuesta", kind: "alt" },
        { id: "timeout", label: "Sin respuesta", kind: "alt" },
        { id: "error", label: "Error", kind: "error" },
      ];
    }
    case "action.send_template":
      return [
        { id: "out", label: "", kind: "normal" },
        { id: "error", label: "Error", kind: "error" },
      ];
    case "action.ask":
      return [
        { id: "reply", label: "Respuesta", kind: "normal" },
        { id: "invalid", label: "No válida", kind: "alt" },
        { id: "timeout", label: "Sin respuesta", kind: "alt" },
        { id: "error", label: "Error", kind: "error" },
      ];
    case "action.ai_reply":
      return [
        { id: "out", label: "", kind: "normal" },
        { id: "handoff", label: "Pide humano", kind: "alt" },
        { id: "error", label: "Error", kind: "error" },
      ];
    case "logic.ai_route": {
      const options: Array<{ key?: string; label?: string }> = Array.isArray(data.options) ? data.options : [];
      return [
        ...options.map((o) => ({ id: `opt:${o.key ?? ""}`, label: o?.label || o?.key || "?", kind: "normal" as const })),
        { id: "fallback", label: "No se pudo clasificar", kind: "alt" },
      ];
    }
    case "action.handoff_ai":
    case "action.handoff_human":
      return [];
    case "action.handoff_provider":
      return [
        { id: "out", label: "Dato pasado", kind: "normal" as const },
        { id: "no_provider", label: "Sin proveedor", kind: "alt" as const },
        { id: "error", label: "Error", kind: "error" as const },
      ];
    case "action.assign_agent":
      return [
        { id: "out", label: "Asignado", kind: "normal" },
        { id: "unassigned", label: "Nadie disponible", kind: "alt" },
      ];
    case "action.label":
    case "action.update_contact":
    case "action.internal_note":
    case "action.set_variable":
    case "action.emit_event":
      return [{ id: "out", label: "", kind: "normal" }];
    case "logic.condition":
      return [
        { id: "yes", label: "Sí", kind: "normal" },
        { id: "no", label: "No", kind: "alt" },
      ];
    case "logic.delay":
    case "logic.wait_business_hours":
      return [{ id: "out", label: "", kind: "normal" }];
    case "action.http":
      return [
        { id: "success", label: "OK", kind: "normal" },
        { id: "error", label: "Error", kind: "error" },
      ];
    default:
      return [];
  }
}

/** Resumen de config para mostrar dentro del nodo en el canvas */
export function nodeSummary(node: FlowNode): string {
  const data = node.data as Record<string, any>;
  switch (node.type) {
    case "trigger.inbound_message":
      return data.match === "keywords" && Array.isArray(data.keywords) && data.keywords.length
        ? `Palabras: ${data.keywords.slice(0, 3).join(", ")}${data.keywords.length > 3 ? "…" : ""}`
        : data.onlyNewConversations
          ? "Solo conversaciones nuevas"
          : "Cualquier mensaje";
    case "trigger.webhook":
      return "Sistemas externos → WhatsApp";
    case "trigger.campaign_reply":
      return Array.isArray(data.campaignIds) && data.campaignIds.length > 0
        ? `${data.campaignIds.length} campaña(s)`
        : "Cualquier campaña";
    case "action.send_media":
      return `${data.mediaType === "document" ? "PDF/archivo" : "Imagen"}${data.caption ? ` · ${truncate(String(data.caption), 30)}` : ""}`;
    case "action.send_location":
      return String(data.name || data.address || "").trim() ||
        (data.latitude && data.longitude ? `${data.latitude}, ${data.longitude}` : "Sin coordenadas");
    case "action.send_cta_url":
      return data.url ? `${data.buttonText || "Abrir"} → ${truncate(String(data.url), 30)}` : "Sin link";
    case "action.set_variable": {
      const modes: Record<string, string> = {
        text: "texto", number: "número", increment: "contador", random_code: "código aleatorio",
      };
      return `${data.saveAs ? `{{vars.${data.saveAs}}}` : "sin variable"} · ${modes[String(data.mode ?? "text")] ?? ""}`;
    }
    case "logic.wait_business_hours":
      return `${data.schedule?.from ?? "09:00"}–${data.schedule?.to ?? "18:00"}`;
    case "action.emit_event":
      return data.eventName ? String(data.eventName) : "Sin nombre de evento";
    case "action.send_text":
    case "action.ask":
    case "action.internal_note":
      return truncate(String(data.body ?? ""), 60) || "Sin mensaje";
    case "action.send_buttons":
      return truncate(String(data.body ?? ""), 40) || "Sin mensaje";
    case "action.send_list":
      return `${Array.isArray(data.rows) ? data.rows.length : 0} opciones`;
    case "action.send_template":
      return data.templateId ? "Plantilla seleccionada" : "Elegí una plantilla";
    case "action.ai_reply":
      return truncate(String(data.instructions ?? ""), 50) || "Responde con el perfil del asistente";
    case "logic.ai_route":
      return `${Array.isArray(data.options) ? data.options.length : 0} intenciones`;
    case "action.handoff_ai":
      return "El bot sigue la conversación";
    case "action.handoff_human":
      return "Asigna al menos ocupado";
    case "action.assign_agent":
      return data.mode === "specific" ? "Agente específico" : "Automático (menos ocupado)";
    case "action.label":
      return data.action === "remove" ? "Quitar etiqueta" : "Agregar etiqueta";
    case "action.update_contact":
      return `${Array.isArray(data.fields) ? data.fields.length : 0} campos`;
    case "logic.condition":
      return `${Array.isArray(data.rules) ? data.rules.length : 0} reglas (${data.logic === "or" ? "alguna" : "todas"})`;
    case "logic.delay":
      return `${data.duration?.amount ?? "?"} ${unitLabel(data.duration?.unit)}`;
    case "action.http":
      return `${data.method ?? "GET"} ${truncate(String(data.url ?? ""), 36)}`;
    default:
      return "";
  }
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function unitLabel(unit?: string): string {
  switch (unit) {
    case "minutes": return "min";
    case "hours": return "h";
    case "days": return "días";
    default: return "";
  }
}
