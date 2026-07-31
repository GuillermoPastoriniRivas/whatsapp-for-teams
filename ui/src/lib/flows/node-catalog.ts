// ── Catálogo de nodos del builder ────────────────────────────────
// Espeja flow-node-types.ts del backend (tipos y handles deben coincidir).
// Copy del dominio en español latino (igual que el área de agentes IA).

import type { FlowNode } from "@/types";
import type { LucideIcon } from "lucide-react";
import {
  MessageSquareText, SquareMousePointer, List, LayoutTemplate, MessageCircleQuestion,
  Sparkles, Split, Bot, Users, UserPlus, Tag, ContactRound, StickyNote,
  GitBranch, Clock, Globe, Zap, Webhook,
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
    defaultData: { phoneNumberIds: [], match: "any", keywords: [], keywordMode: "contains", onlyNewConversations: false, ignoreIfAssignedToHuman: true },
  },
  {
    type: "trigger.webhook",
    label: "Webhook entrante",
    description: "Un sistema externo (CRM, tienda, formulario) inicia el flujo",
    category: "trigger",
    icon: Webhook,
    defaultData: { phoneNumberId: "", contactPhoneField: "phone", contactNameField: "" },
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
    description: "Tu asistente responde una vez y el flujo sigue",
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
    description: "El bot toma la conversación (fin del flujo)",
    category: "ai",
    icon: Bot,
    defaultData: { aiAgentId: "" },
  },
  {
    type: "action.handoff_human",
    label: "Pasar a un humano",
    description: "Asigna al equipo con contexto (fin del flujo)",
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
    description: "Pausa el flujo un tiempo",
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
      return [{ id: "out", label: "", kind: "normal" }];
    case "action.send_text":
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
    case "action.assign_agent":
      return [
        { id: "out", label: "Asignado", kind: "normal" },
        { id: "unassigned", label: "Nadie disponible", kind: "alt" },
      ];
    case "action.label":
    case "action.update_contact":
    case "action.internal_note":
      return [{ id: "out", label: "", kind: "normal" }];
    case "logic.condition":
      return [
        { id: "yes", label: "Sí", kind: "normal" },
        { id: "no", label: "No", kind: "alt" },
      ];
    case "logic.delay":
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
