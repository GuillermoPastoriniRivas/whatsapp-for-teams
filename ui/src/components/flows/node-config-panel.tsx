"use client";

// Panel derecho de configuración del nodo seleccionado. Un formulario por
// tipo, con preview de burbuja de WhatsApp y variables disponibles.

import { useEffect, useMemo, useState } from "react";
import { FileText, FolderOpen, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { SimpleSelect } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { MediaPickerDialog } from "@/components/media/media-picker-dialog";
import { InlineNotice } from "@/components/shared/inline-notice";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import { NODE_BY_TYPE, CATEGORY_STYLES, MEDIA_TYPES_WITHOUT_CAPTION } from "@/lib/flows/node-catalog";
import { useTranslations } from "@/lib/i18n/use-translations";
import type { FlowNode, FlowEdge, Label, Agent, PhoneNumber, MessageTemplate, MediaKind } from "@/types";

export interface BuilderRefs {
  labels: Label[];
  agents: Agent[];
  phones: PhoneNumber[];
  templates: MessageTemplate[];
  connections: Array<{ id: string; name: string; headerName: string }>;
  campaigns: Array<{ id: string; name: string }>;
}

interface PanelProps {
  node: FlowNode;
  refs: BuilderRefs;
  allNodes: FlowNode[];
  edges: FlowEdge[];
  onChange: (config: Record<string, unknown>) => void;
  onChangeTriggerType: (newType: string) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function NodeConfigPanel(props: PanelProps) {
  const { node, refs } = props;
  const { t } = useTranslations();
  const def = NODE_BY_TYPE.get(node.type);
  const data = node.data as Record<string, any>;
  const set = (patch: Record<string, unknown>) => props.onChange({ ...data, ...patch });

  const availableVariables = useMemo(
    () => collectVariables(node.id, props.allNodes, props.edges),
    [node.id, props.allNodes, props.edges],
  );

  const styles = CATEGORY_STYLES[def?.category ?? "logic"];
  const Icon = def?.icon;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 border-b px-3 py-2.5">
        {Icon && (
          <span className={cn("rounded-md p-1.5", styles.iconBg)}>
            <Icon className={cn("size-4", styles.icon)} />
          </span>
        )}
        <span className="font-medium text-sm flex-1 truncate">{def?.label}</span>
        {!node.type.startsWith("trigger.") && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-destructive"
            aria-label={t.flows.deleteNode}
            title={t.flows.deleteNode}
            onClick={props.onDelete}
          >
            <Trash2 className="size-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground"
          aria-label={t.flows.closePanel}
          title={t.flows.closePanel}
          onClick={props.onClose}
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4 text-sm">
        {renderForm(node.type, data, set, refs, props.onChangeTriggerType)}

        {availableVariables.length > 0 && usesVariables(node.type) && (
          <div>
            <FieldLabel>{t.flows.availableVariables}</FieldLabel>
            <div className="flex flex-wrap gap-1">
              {availableVariables.map((variable) => (
                <button
                  key={variable}
                  className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs hover:bg-primary/10"
                  title={t.flows.copyVariable}
                  onClick={() => {
                    void navigator.clipboard.writeText(`{{${variable}}}`);
                    toast.success(t.flows.copied);
                  }}
                >
                  {`{{${variable}}}`}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{t.flows.copyVariableHint}</p>
          </div>
        )}

        {hasPreview(node.type) && <WhatsAppPreview node={node} />}
      </div>
    </div>
  );
}

// ── Formularios por tipo ─────────────────────────────────────────

function renderForm(
  type: string,
  data: Record<string, any>,
  set: (patch: Record<string, unknown>) => void,
  refs: BuilderRefs,
  onChangeTriggerType: (newType: string) => void,
) {
  switch (type) {
    case "trigger.inbound_message":
      return <TriggerMessageForm data={data} set={set} refs={refs} onChangeTriggerType={onChangeTriggerType} />;
    case "trigger.webhook":
      return <TriggerWebhookForm data={data} set={set} refs={refs} onChangeTriggerType={onChangeTriggerType} />;
    case "trigger.campaign_reply":
      return <TriggerCampaignReplyForm data={data} set={set} refs={refs} onChangeTriggerType={onChangeTriggerType} />;
    case "action.send_media":
      return <SendMediaForm data={data} set={set} />;
    case "action.send_location":
      return <SendLocationForm data={data} set={set} />;
    case "action.send_cta_url":
      return <SendCtaUrlForm data={data} set={set} />;
    case "action.set_variable":
      return <SetVariableForm data={data} set={set} />;
    case "action.emit_event":
      return <EmitEventForm data={data} set={set} />;
    case "logic.wait_business_hours":
      return <ScheduleEditor rule={data} onChange={(patch) => set(patch)} />;
    case "action.send_text":
      return (
        <>
          <BodyField data={data} set={set} label="Mensaje" />
          <QuoteLastInboundField data={data} set={set} />
          <WindowPolicyField data={data} set={set} />
        </>
      );
    case "action.send_buttons":
      return <ButtonsForm data={data} set={set} />;
    case "action.send_list":
      return <ListForm data={data} set={set} />;
    case "action.send_template":
      return <TemplateForm data={data} set={set} refs={refs} />;
    case "action.ask":
      return <AskForm data={data} set={set} />;
    case "action.send_contact":
      return <SendContactForm data={data} set={set} />;
    case "action.request_location":
      return <RequestLocationForm data={data} set={set} />;
    case "action.send_flow":
      return <SendFlowForm data={data} set={set} />;
    case "action.react":
      return <ReactForm data={data} set={set} />;
    case "action.typing":
      return <TypingForm data={data} set={set} />;
    case "action.ai_reply":
      return <AiPersonaFields data={data} set={set} persistent={false} />;
    case "logic.ai_route":
      return <AiRouteForm data={data} set={set} />;
    case "action.handoff_ai":
      return <AiPersonaFields data={data} set={set} persistent />;
    case "action.handoff_human":
      return (
        <div>
          <FieldLabel>Nota para el equipo (opcional)</FieldLabel>
          <Textarea rows={3} value={data.note ?? ""} placeholder="Ej: Pidió {{vars.interes}}" onChange={(e) => set({ note: e.target.value })} />
        </div>
      );
    case "action.assign_agent":
      return <AssignForm data={data} set={set} refs={refs} />;
    case "action.label":
      return <LabelForm data={data} set={set} refs={refs} />;
    case "action.update_contact":
      return <UpdateContactForm data={data} set={set} />;
    case "action.internal_note":
      return <BodyField data={data} set={set} label="Nota (el cliente no la ve)" />;
    case "logic.condition":
      return <ConditionForm data={data} set={set} />;
    case "logic.delay":
      return <DurationField data={data} set={set} field="duration" label="Esperar" />;
    case "action.http":
      return <HttpForm data={data} set={set} refs={refs} />;
    default:
      return null;
  }
}

// ── Campos compartidos ───────────────────────────────────────────

/** Encabezado de un grupo de controles (no de un control único: para eso va `Field`). */
function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-1.5 text-sm font-medium">{children}</p>;
}

/** Quitar una fila de una lista (botones, opciones, headers…). */
function RemoveButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslations();
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="shrink-0 text-muted-foreground"
      aria-label={t.flows.removeItem}
      title={t.flows.removeItem}
      onClick={onClick}
    >
      <Trash2 className="size-3.5" />
    </Button>
  );
}

function BodyField({
  data,
  set,
  label,
  max = 4096,
}: {
  data: Record<string, any>;
  set: (p: Record<string, unknown>) => void;
  label: string;
  /** El validador acota el body de los botones a 1024 (límite de WhatsApp). */
  max?: number;
}) {
  const body = String(data.body ?? "");
  const over = body.length > max;
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <Textarea rows={4} value={body} onChange={(e) => set({ body: e.target.value })} />
      <p className={cn("mt-0.5 text-right text-xs", over ? "text-destructive" : "text-muted-foreground")}>
        {body.length}/{max}
      </p>
    </div>
  );
}

function SelectField(props: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  /** Además del texto en vacío, agrega la opción que vuelve al valor sin elegir. */
  placeholder?: string;
}) {
  const options =
    props.placeholder !== undefined ? [{ value: "", label: props.placeholder }, ...props.options] : props.options;
  return (
    <Field label={props.label}>
      <SimpleSelect
        value={props.value}
        onChange={props.onChange}
        options={options}
        placeholder={props.placeholder}
      />
    </Field>
  );
}

/**
 * Sobre qué líneas actúa el disparador.
 *
 * Antes esto era una lista de toggles con la regla "ninguno = todos" escrita
 * entre paréntesis: no se podía distinguir "quiero todos" de "todavía no elegí",
 * y las dos publicaban. Ahora se elige primero el alcance y recién ahí aparecen
 * los números; "solo estos" sin ninguno tildado no publica.
 */
function PhoneScopeField({ data, set, refs }: { data: Record<string, any>; set: (p: Record<string, unknown>) => void; refs: BuilderRefs }) {
  const phoneIds: string[] = Array.isArray(data.phoneNumberIds) ? data.phoneNumberIds : [];
  const scope: "all" | "specific" =
    data.phoneScope === "all" || data.phoneScope === "specific"
      ? data.phoneScope
      : phoneIds.length > 0
        ? "specific"
        : "all";

  return (
    <>
      <SelectField
        label="Números donde aplica"
        value={scope}
        options={[
          { value: "specific", label: "Solo los números que elija" },
          { value: "all", label: "Todos los números de la cuenta" },
        ]}
        onChange={(value) =>
          set({ phoneScope: value, ...(value === "all" ? { phoneNumberIds: [] } : {}) })
        }
      />

      {scope === "specific" && (
        <div>
          <div className="space-y-1">
            {refs.phones.map((phone) => (
              <ToggleField
                key={phone.id}
                label={phone.label || phone.displayPhone || phone.phoneNumberId}
                checked={phoneIds.includes(phone.id)}
                onChange={(checked) =>
                  set({ phoneNumberIds: checked ? [...phoneIds, phone.id] : phoneIds.filter((id) => id !== phone.id) })
                }
              />
            ))}
          </div>
          {phoneIds.length === 0 && (
            <p className="mt-1 text-xs text-destructive">
              Elegí al menos un número: así como está, el disparador no se activa nunca.
            </p>
          )}
        </div>
      )}
    </>
  );
}

const SENDER_TYPES = [
  { value: "nuevo", label: "Alguien nuevo", hint: "Nunca había escrito a este número" },
  { value: "recurrente", label: "Alguien que ya había escrito", hint: "" },
];

/**
 * Quién escribe. Deja tener un flujo de bienvenida y otro para conocidos sobre
 * el mismo número, ordenados por prioridad.
 *
 * Sin nada tildado aplica a cualquiera, que es lo que hacían todos los
 * disparadores antes de que esto existiera.
 */
function SenderFilterField({ data, set, refs }: { data: Record<string, any>; set: (p: Record<string, unknown>) => void; refs: BuilderRefs }) {
  const types: string[] = Array.isArray(data.senderTypes) ? data.senderTypes : [];
  const labelIds: string[] = Array.isArray(data.senderLabelIds) ? data.senderLabelIds : [];

  return (
    <div>
      <FieldLabel>Quién escribe</FieldLabel>
      <div className="space-y-1">
        {SENDER_TYPES.map((t) => (
          <ToggleField
            key={t.value}
            label={t.label}
            checked={types.includes(t.value)}
            onChange={(checked) =>
              set({ senderTypes: checked ? [...types, t.value] : types.filter((v) => v !== t.value) })
            }
          />
        ))}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Sin tildar nada aplica a cualquiera.</p>

      {refs.labels.length > 0 && (
        <div className="mt-3">
          <FieldLabel>Con alguna de estas etiquetas</FieldLabel>
          <div className="max-h-40 space-y-1 overflow-y-auto">
            {refs.labels.map((label) => (
              <ToggleField
                key={label.id}
                label={label.name}
                checked={labelIds.includes(label.id)}
                onChange={(checked) =>
                  set({ senderLabelIds: checked ? [...labelIds, label.id] : labelIds.filter((v) => v !== label.id) })
                }
              />
            ))}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Alcanza con que el chat tenga una de ellas. Sin tildar ninguna, no filtra por etiqueta.
          </p>
        </div>
      )}
    </div>
  );
}

function ToggleField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      className="flex min-h-9 w-full items-center justify-between gap-2 py-1 text-left"
      onClick={() => onChange(!checked)}
      type="button"
      role="switch"
      aria-checked={checked}
    >
      <span className="text-sm">{label}</span>
      <span className={cn("w-8 h-4.5 shrink-0 rounded-full p-0.5 transition-colors", checked ? "bg-primary" : "bg-muted")}>
        <span
          className={cn(
            "block size-3.5 rounded-full bg-background shadow-sm ring-1 ring-foreground/10 transition-transform",
            checked && "translate-x-3.5"
          )}
        />
      </span>
    </button>
  );
}

const DURATION_UNITS = [
  { value: "minutes", label: "minutos" },
  { value: "hours", label: "horas" },
  { value: "days", label: "días (máx 7)" },
];

function DurationField({ data, set, field, label }: { data: Record<string, any>; set: (p: Record<string, unknown>) => void; field: string; label: string }) {
  const duration = data[field] ?? { amount: 1, unit: "days" };
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex gap-2">
        <Input
          type="number"
          min={1}
          className="w-24"
          value={duration.amount ?? 1}
          onChange={(e) => set({ [field]: { ...duration, amount: Number(e.target.value) } })}
        />
        <SimpleSelect
          className="flex-1"
          value={duration.unit ?? "days"}
          options={DURATION_UNITS}
          onChange={(value) => set({ [field]: { ...duration, unit: value } })}
        />
      </div>
    </div>
  );
}

function WindowPolicyField({ data, set }: { data: Record<string, any>; set: (p: Record<string, unknown>) => void }) {
  return (
    <SelectField
      label="Si la ventana de 24 h está cerrada"
      value={data.windowPolicy ?? "error"}
      options={[
        { value: "error", label: "Marcar error (rama Error)" },
        { value: "skip", label: "Omitir el mensaje y seguir" },
      ]}
      onChange={(value) => set({ windowPolicy: value })}
    />
  );
}

function SaveAsField({ data, set, label = "Guardar respuesta como variable" }: { data: Record<string, any>; set: (p: Record<string, unknown>) => void; label?: string }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <Input
        value={data.saveAs ?? ""}
        placeholder="ej: interes"
        onChange={(e) => set({ saveAs: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })}
      />
      {data.saveAs ? <p className="text-xs text-muted-foreground mt-0.5">Usala como {`{{vars.${data.saveAs}}}`}</p> : null}
    </div>
  );
}

/**
 * La conducta del asistente, adentro del nodo.
 *
 * Antes acá se elegía un "agente IA" de una lista y la config vivía en otra
 * pantalla. Ahora no hay bot al que apuntar: lo que define cómo contesta está
 * en este nodo, y los datos del negocio (catálogo, horarios, FAQs) salen del
 * perfil de la cuenta — se cargan una vez en Ajustes, no por flujo.
 */
function AiPersonaFields({
  data,
  set,
  persistent,
}: {
  data: Record<string, any>;
  set: (p: Record<string, unknown>) => void;
  /** El nodo deja al bot atendiendo de corrido: aplican derivación y burbujas. */
  persistent: boolean;
}) {
  const behavior = (data.behavior ?? {}) as Record<string, any>;
  const handoff = (data.handoffRules ?? {}) as Record<string, any>;
  const setBehavior = (patch: Record<string, unknown>) => set({ behavior: { ...behavior, ...patch } });
  const setHandoff = (patch: Record<string, unknown>) => set({ handoffRules: { ...handoff, ...patch } });

  return (
    <>
      <Field label="Nombre del asistente" hint="Aparece en el historial del chat y en las notas de derivación.">
        <Input
          value={data.name ?? ""}
          placeholder="Ej: Sofía"
          onChange={(e) => set({ name: e.target.value })}
        />
      </Field>

      <div>
        <FieldLabel>Objetivo de la conversación</FieldLabel>
        <Textarea
          rows={2}
          value={behavior.goal ?? ""}
          placeholder="Ej: resolver la consulta y, si no podés, pasarlo con una persona"
          onChange={(e) => setBehavior({ goal: e.target.value })}
        />
      </div>

      <SelectField
        label="Tono"
        value={behavior.formality ?? "informal"}
        options={[
          { value: "informal", label: "Cercano (de vos)" },
          { value: "formal", label: "Formal (de usted)" },
        ]}
        onChange={(value) => setBehavior({ formality: value })}
      />

      <ToggleField
        label="Usar emojis"
        checked={behavior.useEmojis !== false}
        onChange={(v) => setBehavior({ useEmojis: v })}
      />

      <div>
        <FieldLabel>Instrucciones extra (opcional)</FieldLabel>
        <Textarea
          rows={3}
          value={behavior.customInstructions ?? ""}
          placeholder="Ej: no des precios de mayorista sin preguntar el volumen"
          onChange={(e) => setBehavior({ customInstructions: e.target.value })}
        />
      </div>

      {persistent && (
        <>
          <div>
            <FieldLabel>Palabras que derivan a una persona</FieldLabel>
            <Input
              value={(handoff.keywords ?? []).join(", ")}
              placeholder="hablar con humano, agente, persona real"
              onChange={(e) =>
                setHandoff({ keywords: e.target.value.split(",").map((k) => k.trim()).filter(Boolean) })
              }
            />
          </div>
          <ToggleField
            label="Derivar si el cliente lo pide"
            checked={handoff.onCustomerRequest !== false}
            onChange={(v) => setHandoff({ onCustomerRequest: v })}
          />
        </>
      )}

      <p className="text-xs text-muted-foreground">
        El catálogo, las FAQs y los horarios salen del perfil del negocio de la cuenta, en Ajustes.
      </p>
    </>
  );
}

/**
 * De dónde viene el chat. Un anuncio de "presupuesto" puede disparar una
 * automatización distinta que uno de "catálogo".
 *
 * El alcance es explícito y no se deduce de la lista vacía: "solo estos
 * anuncios" sin ninguno cargado no publica, igual que el alcance de líneas.
 */
function AdScopeField({ data, set }: { data: Record<string, any>; set: (p: Record<string, unknown>) => void }) {
  const sourceIds: string[] = Array.isArray(data.adSourceIds) ? data.adSourceIds : [];
  const scope: "any" | "from_ads" | "specific" =
    data.adScope === "from_ads" || data.adScope === "specific" ? data.adScope : "any";

  return (
    <>
      <SelectField
        label="Origen del chat"
        value={scope}
        options={[
          { value: "any", label: "Cualquier origen" },
          { value: "from_ads", label: "Solo si vino de un anuncio o posteo" },
          { value: "specific", label: "Solo estos anuncios" },
        ]}
        onChange={(value) => set({ adScope: value, ...(value === "specific" ? {} : { adSourceIds: [] }) })}
      />

      {scope === "specific" && (
        <div>
          <FieldLabel>IDs de anuncio (separados por coma)</FieldLabel>
          <Input
            value={sourceIds.join(", ")}
            placeholder="120210000000000000"
            onChange={(e) =>
              set({ adSourceIds: e.target.value.split(",").map((id) => id.trim()).filter(Boolean) })
            }
          />
          <p className="mt-1 text-xs text-muted-foreground">
            El ID sale de Analytics → Anuncios, o del administrador de anuncios de Meta.
          </p>
        </div>
      )}
    </>
  );
}

// ── Triggers ─────────────────────────────────────────────────────

function TriggerTypeSwitch({ current, onChangeTriggerType }: { current: string; onChangeTriggerType: (t: string) => void }) {
  return (
    <SelectField
      label="Tipo de disparador"
      value={current}
      options={[
        { value: "trigger.inbound_message", label: "Mensaje recibido en WhatsApp" },
        { value: "trigger.campaign_reply", label: "Respuesta a una campaña" },
        { value: "trigger.webhook", label: "Webhook externo (CRM, tienda…)" },
      ]}
      onChange={(value) => value !== current && onChangeTriggerType(value)}
    />
  );
}

function TriggerMessageForm({ data, set, refs, onChangeTriggerType }: { data: Record<string, any>; set: (p: Record<string, unknown>) => void; refs: BuilderRefs; onChangeTriggerType: (t: string) => void }) {
  return (
    <>
      <TriggerTypeSwitch current="trigger.inbound_message" onChangeTriggerType={onChangeTriggerType} />
      <PhoneScopeField data={data} set={set} refs={refs} />
      <SenderFilterField data={data} set={set} refs={refs} />
      <AdScopeField data={data} set={set} />
      <SelectField
        label="Cuándo dispara"
        value={data.match ?? "any"}
        options={[
          { value: "any", label: "Con cualquier mensaje" },
          { value: "keywords", label: "Solo con palabras clave" },
        ]}
        onChange={(value) => set({ match: value })}
      />
      {data.match === "keywords" && (
        <>
          <div>
            <FieldLabel>Palabras clave (separadas por coma)</FieldLabel>
            <Input
              value={Array.isArray(data.keywords) ? data.keywords.join(", ") : ""}
              placeholder="menu, precios, turno"
              onChange={(e) => set({ keywords: e.target.value.split(",").map((k) => k.trim()).filter(Boolean) })}
            />
          </div>
          <SelectField
            label="Modo"
            value={data.keywordMode ?? "contains"}
            options={[
              { value: "contains", label: "El mensaje la contiene" },
              { value: "exact", label: "El mensaje es exactamente" },
            ]}
            onChange={(value) => set({ keywordMode: value })}
          />
        </>
      )}
      <ToggleField label="Solo conversaciones nuevas" checked={data.onlyNewConversations === true} onChange={(v) => set({ onlyNewConversations: v })} />
    </>
  );
}

function TriggerWebhookForm({ data, set, refs, onChangeTriggerType }: { data: Record<string, any>; set: (p: Record<string, unknown>) => void; refs: BuilderRefs; onChangeTriggerType: (t: string) => void }) {
  return (
    <>
      <TriggerTypeSwitch current="trigger.webhook" onChangeTriggerType={onChangeTriggerType} />
      <SelectField
        label="Número desde el que envía"
        value={data.phoneNumberId ?? ""}
        placeholder="Elegí un número…"
        options={refs.phones.map((p) => ({ value: p.id, label: p.label || p.displayPhone || p.phoneNumberId }))}
        onChange={(value) => set({ phoneNumberId: value })}
      />
      <div>
        <FieldLabel>Campo del teléfono en el JSON</FieldLabel>
        <Input value={data.contactPhoneField ?? "phone"} placeholder="phone o data.customer.phone" onChange={(e) => set({ contactPhoneField: e.target.value })} />
      </div>
      <div>
        <FieldLabel>Campo del nombre (opcional)</FieldLabel>
        <Input value={data.contactNameField ?? ""} placeholder="name" onChange={(e) => set({ contactNameField: e.target.value })} />
      </div>
      <p className="text-xs text-muted-foreground">
        La URL del webhook aparece arriba después de publicar. El payload queda disponible como {"{{webhook.*}}"}.
        Como suele llegar fuera de la ventana de 24 h, empezá con una plantilla.
      </p>
    </>
  );
}

function TriggerCampaignReplyForm({ data, set, refs, onChangeTriggerType }: { data: Record<string, any>; set: (p: Record<string, unknown>) => void; refs: BuilderRefs; onChangeTriggerType: (t: string) => void }) {
  const campaignIds: string[] = Array.isArray(data.campaignIds) ? data.campaignIds : [];
  return (
    <>
      <TriggerTypeSwitch current="trigger.campaign_reply" onChangeTriggerType={onChangeTriggerType} />
      <PhoneScopeField data={data} set={set} refs={refs} />
      <div>
        <FieldLabel>Campañas (ninguna = todas)</FieldLabel>
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {refs.campaigns.length === 0 && (
            <p className="text-xs text-muted-foreground">Todavía no tenés campañas.</p>
          )}
          {refs.campaigns.map((campaign) => (
            <ToggleField
              key={campaign.id}
              label={campaign.name}
              checked={campaignIds.includes(campaign.id)}
              onChange={(checked) =>
                set({ campaignIds: checked ? [...campaignIds, campaign.id] : campaignIds.filter((id) => id !== campaign.id) })
              }
            />
          ))}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Dispara con la <strong>primera</strong> respuesta del contacto a una campaña. La ventana de 24 h
        queda abierta por esa respuesta, así que podés seguir con mensajes normales.
      </p>
    </>
  );
}

function SendMediaForm({ data, set }: { data: Record<string, any>; set: (p: Record<string, unknown>) => void }) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <>
      <SelectField
        label="Tipo de archivo"
        value={data.mediaType ?? "image"}
        options={[
          { value: "image", label: "Imagen (JPG/PNG)" },
          { value: "video", label: "Video (MP4)" },
          { value: "audio", label: "Audio (MP3/OGG)" },
          { value: "document", label: "Documento (PDF u otro)" },
          { value: "sticker", label: "Sticker (WebP)" },
        ]}
        onChange={(value) => set({ mediaType: value, mediaAssetId: "", mediaAssetName: "" })}
      />

      <div>
        <FieldLabel>Archivo</FieldLabel>
        {data.mediaAssetName ? (
          <div className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-2">
            <FileText className="size-4 shrink-0 text-primary" />
            <span className="min-w-0 flex-1 truncate text-sm">{data.mediaAssetName}</span>
            <Button variant="ghost" size="sm" onClick={() => set({ mediaAssetId: "", mediaAssetName: "" })}>
              Quitar
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="w-full" onClick={() => setPickerOpen(true)}>
            <FolderOpen className="size-4" />
            Elegir de la biblioteca
          </Button>
        )}
        <p className="mt-0.5 text-xs text-muted-foreground">
          Lo subimos a WhatsApp por vos: no hace falta que el archivo sea público.
        </p>
      </div>

      {!data.mediaAssetId && (
        <div>
          <FieldLabel>…o pegá una URL pública (https)</FieldLabel>
          <Input value={data.mediaUrl ?? ""} placeholder="https://…/catalogo.pdf" onChange={(e) => set({ mediaUrl: e.target.value })} />
          <p className="text-xs text-muted-foreground mt-0.5">
            Tiene que ser accesible públicamente: WhatsApp la descarga desde sus servidores.
          </p>
        </div>
      )}

      <MediaPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        kinds={[String(data.mediaType ?? "image") as MediaKind]}
        onSelect={(asset) =>
          set({
            mediaAssetId: asset.id,
            mediaAssetName: asset.title ?? asset.filename ?? "Archivo",
            mediaUrl: "",
            ...(asset.filename ? { filename: asset.filename } : {}),
          })
        }
      />

      {data.mediaType === "document" && (
        <div>
          <FieldLabel>Nombre con el que se descarga</FieldLabel>
          <Input value={data.filename ?? ""} placeholder="catalogo-2026.pdf" onChange={(e) => set({ filename: e.target.value })} />
        </div>
      )}
      {MEDIA_TYPES_WITHOUT_CAPTION.has(String(data.mediaType ?? "image")) ? (
        <p className="text-xs text-muted-foreground">
          El audio y los stickers viajan solos: WhatsApp no les admite texto acompañante.
        </p>
      ) : (
        <div>
          <FieldLabel>Texto que acompaña (opcional)</FieldLabel>
          <Textarea rows={2} value={data.caption ?? ""} onChange={(e) => set({ caption: e.target.value })} />
        </div>
      )}
      <QuoteLastInboundField data={data} set={set} />
      <WindowPolicyField data={data} set={set} />
    </>
  );
}

/** Tarjeta de contacto: el cliente la guarda de un toque. */
function SendContactForm({ data, set }: { data: Record<string, any>; set: (p: Record<string, unknown>) => void }) {
  return (
    <>
      <div>
        <FieldLabel>Nombre</FieldLabel>
        <Input value={data.contactName ?? ""} placeholder="Ej: Martín, técnico de zona" onChange={(e) => set({ contactName: e.target.value })} />
      </div>
      <div>
        <FieldLabel>Teléfono</FieldLabel>
        <Input value={data.contactPhone ?? ""} placeholder="59899123456" onChange={(e) => set({ contactPhone: e.target.value })} />
      </div>
      <div>
        <FieldLabel>Email (opcional)</FieldLabel>
        <Input value={data.contactEmail ?? ""} onChange={(e) => set({ contactEmail: e.target.value })} />
      </div>
      <div>
        <FieldLabel>Empresa (opcional)</FieldLabel>
        <Input value={data.contactCompany ?? ""} onChange={(e) => set({ contactCompany: e.target.value })} />
      </div>
      <QuoteLastInboundField data={data} set={set} />
      <WindowPolicyField data={data} set={set} />
    </>
  );
}

/** Pedir la ubicación con el botón nativo: llegan coordenadas, no texto. */
function RequestLocationForm({ data, set }: { data: Record<string, any>; set: (p: Record<string, unknown>) => void }) {
  return (
    <>
      <BodyField data={data} set={set} label="Qué le decís al pedirla" />
      <div>
        <FieldLabel>Dónde guardo la ubicación</FieldLabel>
        <Input value={data.saveAs ?? ""} placeholder="ubicacion" onChange={(e) => set({ saveAs: e.target.value })} />
        <p className="mt-0.5 text-xs text-muted-foreground">
          Después la usás como {"{{vars.ubicacion.latitude}}"} y {"{{vars.ubicacion.longitude}}"}.
        </p>
      </div>
      <div>
        <FieldLabel>Si manda otra cosa (opcional)</FieldLabel>
        <Input value={data.invalidMessage ?? ""} placeholder="Necesito que toques el botón 📍" onChange={(e) => set({ invalidMessage: e.target.value })} />
      </div>
      <DurationField data={data} set={set} field="timeout" label="Cuánto espera" />
      <WindowPolicyField data={data} set={set} />
    </>
  );
}

interface WhatsAppFlowOption {
  id: string;
  name: string;
  status: string;
  categories: string[];
  hasEndpoint: boolean;
  screens: string[];
  phoneNumberId: string;
  phoneLabel: string;
}

/**
 * Los formularios se arman en WhatsApp Manager, así que la lista se pide en
 * vivo cuando se abre el nodo: si acá guardáramos una copia, un formulario
 * recién publicado no aparecería hasta vaya a saber cuándo.
 */
function SendFlowForm({ data, set }: { data: Record<string, any>; set: (p: Record<string, unknown>) => void }) {
  const [flows, setFlows] = useState<WhatsAppFlowOption[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await api.get<{ data: WhatsAppFlowOption[] }>("/flows/whatsapp-flows");
        if (!cancelled) setFlows(response.data ?? []);
      } catch {
        if (!cancelled) {
          setFlows([]);
          setError(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = flows?.find((f) => f.id === data.flowId);
  const sinPublicar = selected && selected.status !== "PUBLISHED";

  return (
    <>
      {flows === null ? (
        <p className="text-xs text-muted-foreground">Buscando tus formularios en WhatsApp…</p>
      ) : error ? (
        <InlineNotice variant="warning">
          No pudimos leer los formularios de tu cuenta de WhatsApp. Revisá la conexión del número.
        </InlineNotice>
      ) : flows.length === 0 ? (
        <InlineNotice variant="info">
          Todavía no tenés formularios. Se crean en WhatsApp Manager (Cuenta → Flujos) y después aparecen acá.
        </InlineNotice>
      ) : (
        <SelectField
          label="Formulario"
          value={data.flowId ?? ""}
          placeholder="Elegí un formulario…"
          options={flows.map((f) => ({
            value: f.id,
            label: f.status === "PUBLISHED" ? f.name : `${f.name} (${FLOW_STATUS_LABELS[f.status] ?? f.status})`,
          }))}
          onChange={(value) => {
            const flow = flows.find((f) => f.id === value);
            // La pantalla de entrada arranca en la primera del formulario:
            // Meta pide una cuando el mensaje abre el Flow directamente.
            set({ flowId: value, flowName: flow?.name ?? "", screen: flow?.screens[0] ?? "" });
          }}
        />
      )}
      {sinPublicar && (
        <InlineNotice variant="warning">
          Este formulario no está publicado: solo lo pueden abrir los administradores del número. Publicalo en WhatsApp
          Manager antes de usarlo con clientes.
        </InlineNotice>
      )}
      {selected?.hasEndpoint && (
        <InlineNotice variant="info">
          Este formulario se conecta a un servidor propio para ir trayendo datos. Desde acá se abre igual, pero esa
          conexión la maneja quien lo armó.
        </InlineNotice>
      )}
      <BodyField data={data} set={set} label="Mensaje que acompaña" />
      <div>
        <FieldLabel>Pie de página (opcional)</FieldLabel>
        <Input value={data.footer ?? ""} maxLength={60} onChange={(e) => set({ footer: e.target.value })} />
      </div>
      <div>
        <FieldLabel>Texto del botón</FieldLabel>
        <Input
          value={data.cta ?? ""}
          maxLength={30}
          placeholder="Completar"
          onChange={(e) => set({ cta: e.target.value })}
        />
      </div>
      {selected && selected.screens.length > 1 && (
        <SelectField
          label="Pantalla por la que entra"
          value={data.screen ?? ""}
          options={selected.screens.map((s) => ({ value: s, label: s }))}
          onChange={(value) => set({ screen: value })}
        />
      )}
      <SaveAsField data={data} set={set} label="Guardar las respuestas como variable" />
      <p className="-mt-1 text-xs text-muted-foreground">
        Cada campo del formulario queda en {"{{vars.formulario.nombre_del_campo}}"}.
      </p>
      <SelectField
        label="Versión que se manda"
        value={data.mode ?? "published"}
        options={[
          { value: "published", label: "Publicada (la que ven los clientes)" },
          { value: "draft", label: "Borrador (solo administradores del número)" },
        ]}
        onChange={(value) => set({ mode: value })}
      />
      <DurationField data={data} set={set} field="timeout" label="Cuánto espera a que lo complete" />
      <WindowPolicyField data={data} set={set} />
    </>
  );
}

const FLOW_STATUS_LABELS: Record<string, string> = {
  DRAFT: "borrador",
  PUBLISHED: "publicado",
  DEPRECATED: "dado de baja",
  BLOCKED: "bloqueado",
  THROTTLED: "limitado",
};

const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🎉", "✅"];

function ReactForm({ data, set }: { data: Record<string, any>; set: (p: Record<string, unknown>) => void }) {
  return (
    <>
      <div>
        <FieldLabel>Con qué reacciona</FieldLabel>
        <div className="flex flex-wrap gap-1.5">
          {REACTION_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => set({ emoji })}
              className={
                data.emoji === emoji
                  ? "rounded-lg border border-primary bg-primary/10 px-2.5 py-1 text-base"
                  : "rounded-lg border border-border px-2.5 py-1 text-base hover:bg-muted"
              }
            >
              {emoji}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Reacciona al último mensaje del cliente. WhatsApp no deja reaccionar a los propios.
        </p>
      </div>
    </>
  );
}

function TypingForm({ data, set }: { data: Record<string, any>; set: (p: Record<string, unknown>) => void }) {
  return (
    <div>
      <FieldLabel>Cuántos segundos</FieldLabel>
      <Input
        type="number"
        min={1}
        max={25}
        value={data.seconds ?? 3}
        onChange={(e) => set({ seconds: Number(e.target.value) || 3 })}
      />
      <p className="mt-0.5 text-xs text-muted-foreground">
        Además le pone el tilde azul al último mensaje del cliente. Meta baja el indicador solo a los 25 segundos.
      </p>
    </div>
  );
}

/** Citar el último mensaje del cliente, como cuando respondés apuntando a una burbuja. */
function QuoteLastInboundField({ data, set }: { data: Record<string, any>; set: (p: Record<string, unknown>) => void }) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <Checkbox
        className="mt-0.5"
        checked={!!data.quoteLastInbound}
        onCheckedChange={(checked) => set({ quoteLastInbound: !!checked })}
      />
      <span>
        Responder citando el último mensaje del cliente
        <span className="mt-0.5 block text-xs text-muted-foreground">
          Si todavía no escribió nada, el mensaje sale igual pero sin la cita.
        </span>
      </span>
    </label>
  );
}

/**
 * Ubicación fija: el local, el punto de retiro, la sucursal. Las coordenadas
 * aceptan variables, así que un flujo puede mandar la sucursal que eligió el
 * cliente en un paso anterior.
 */
function SendLocationForm({ data, set }: { data: Record<string, any>; set: (p: Record<string, unknown>) => void }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <FieldLabel>Latitud</FieldLabel>
          <Input
            value={String(data.latitude ?? "")}
            placeholder="-34.6037"
            onChange={(e) => set({ latitude: e.target.value })}
          />
        </div>
        <div>
          <FieldLabel>Longitud</FieldLabel>
          <Input
            value={String(data.longitude ?? "")}
            placeholder="-58.3816"
            onChange={(e) => set({ longitude: e.target.value })}
          />
        </div>
      </div>
      <div>
        <FieldLabel>Nombre del lugar</FieldLabel>
        <Input
          value={String(data.name ?? "")}
          placeholder="Aloe Village"
          onChange={(e) => set({ name: e.target.value })}
        />
      </div>
      <div>
        <FieldLabel>Dirección</FieldLabel>
        <Input
          value={String(data.address ?? "")}
          placeholder="La Paloma, Rocha"
          onChange={(e) => set({ address: e.target.value })}
        />
      </div>
      <WindowPolicyField data={data} set={set} />
    </>
  );
}

/**
 * Botón con link sin plantilla. Sólo funciona dentro de la ventana de 24 h,
 * que es justamente donde una plantilla sería un desperdicio.
 */
function SendCtaUrlForm({ data, set }: { data: Record<string, any>; set: (p: Record<string, unknown>) => void }) {
  return (
    <>
      <BodyField data={data} set={set} label="Mensaje" max={1024} />
      <div>
        <FieldLabel>Texto del botón</FieldLabel>
        <Input
          value={String(data.buttonText ?? "")}
          maxLength={20}
          placeholder="Abrir"
          onChange={(e) => set({ buttonText: e.target.value })}
        />
      </div>
      <div>
        <FieldLabel>Link</FieldLabel>
        <Input
          value={String(data.url ?? "")}
          placeholder="https://..."
          onChange={(e) => set({ url: e.target.value })}
        />
      </div>
      <div>
        <FieldLabel>Pie (opcional)</FieldLabel>
        <Input
          value={String(data.footer ?? "")}
          maxLength={60}
          onChange={(e) => set({ footer: e.target.value })}
        />
      </div>
      <WindowPolicyField data={data} set={set} />
    </>
  );
}

function SetVariableForm({ data, set }: { data: Record<string, any>; set: (p: Record<string, unknown>) => void }) {
  const mode = String(data.mode ?? "text");
  return (
    <>
      <div>
        <FieldLabel>Nombre de la variable</FieldLabel>
        <Input
          value={data.saveAs ?? ""}
          placeholder="ej: codigo"
          onChange={(e) => set({ saveAs: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })}
        />
        {data.saveAs ? <p className="text-xs text-muted-foreground mt-0.5">La usás como {`{{vars.${data.saveAs}}}`}</p> : null}
      </div>
      <SelectField
        label="Qué guardar"
        value={mode}
        options={[
          { value: "text", label: "Texto (podés combinar variables)" },
          { value: "number", label: "Número" },
          { value: "increment", label: "Contador (sumar)" },
          { value: "random_code", label: "Código de verificación" },
        ]}
        onChange={(value) => set({ mode: value })}
      />
      {mode === "random_code" ? (
        <div>
          <FieldLabel>Cantidad de dígitos</FieldLabel>
          <Input
            type="number"
            min={4}
            max={10}
            value={data.length ?? 6}
            onChange={(e) => set({ length: Number(e.target.value) })}
          />
          <p className="text-xs text-muted-foreground mt-0.5">
            Se genera con aleatoriedad criptográfica. Para enviarlo por WhatsApp como código de acceso,
            Meta exige una plantilla de categoría <strong>autenticación</strong>.
          </p>
        </div>
      ) : mode === "increment" ? (
        <div>
          <FieldLabel>Cuánto sumar</FieldLabel>
          <Input value={data.value ?? ""} placeholder="1" onChange={(e) => set({ value: e.target.value })} />
        </div>
      ) : (
        <div>
          <FieldLabel>Valor</FieldLabel>
          <Textarea
            rows={2}
            value={data.value ?? ""}
            placeholder={mode === "number" ? "{{vars.monto}}" : "Hola {{contact.name}}"}
            onChange={(e) => set({ value: e.target.value })}
          />
        </div>
      )}
    </>
  );
}

function EmitEventForm({ data, set }: { data: Record<string, any>; set: (p: Record<string, unknown>) => void }) {
  const fields: Array<{ key: string; value: string }> = Array.isArray(data.fields) ? data.fields : [];
  return (
    <>
      <div>
        <FieldLabel>Nombre del evento</FieldLabel>
        <Input value={data.eventName ?? ""} placeholder="lead_calificado" onChange={(e) => set({ eventName: e.target.value })} />
      </div>
      <div>
        <FieldLabel>Datos a enviar</FieldLabel>
        <div className="space-y-1.5">
          {fields.map((field, index) => (
            <div key={index} className="flex gap-1.5">
              <Input className="w-28" value={field.key} placeholder="clave" onChange={(e) => set({ fields: fields.map((f, i) => (i === index ? { ...f, key: e.target.value } : f)) })} />
              <Input className="flex-1" value={field.value} placeholder="{{vars.x}}" onChange={(e) => set({ fields: fields.map((f, i) => (i === index ? { ...f, value: e.target.value } : f)) })} />
              <RemoveButton onClick={() => set({ fields: fields.filter((_, i) => i !== index) })} />
            </div>
          ))}
          <Button variant="outline" size="sm" className="w-full" onClick={() => set({ fields: [...fields, { key: "", value: "" }] })}>
            <Plus className="size-3.5 mr-1" /> Agregar dato
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Llega como evento <code>flow.custom</code> a los webhooks configurados en Desarrolladores.
        </p>
      </div>
    </>
  );
}

// ── Mensajes ─────────────────────────────────────────────────────

function ButtonsForm({ data, set }: { data: Record<string, any>; set: (p: Record<string, unknown>) => void }) {
  const buttons: Array<{ title: string }> = Array.isArray(data.buttons) ? data.buttons : [];
  return (
    <>
      <BodyField data={data} set={set} label="Mensaje" max={1024} />
      <div>
        <FieldLabel>Botones (máx 3, 20 caracteres)</FieldLabel>
        <div className="space-y-1.5">
          {buttons.map((button, index) => (
            <div key={index} className="flex gap-1.5">
              <Input
                value={button.title}
                maxLength={20}
                onChange={(e) => set({ buttons: buttons.map((b, i) => (i === index ? { title: e.target.value } : b)) })}
              />
              <RemoveButton onClick={() => set({ buttons: buttons.filter((_, i) => i !== index) })} />
            </div>
          ))}
          {buttons.length < 3 && (
            <Button variant="outline" size="sm" className="w-full" onClick={() => set({ buttons: [...buttons, { title: "" }] })}>
              <Plus className="size-3.5 mr-1" /> Agregar botón
            </Button>
          )}
        </div>
      </div>
      <DurationField data={data} set={set} field="timeout" label="Esperar respuesta hasta" />
      <SaveAsField data={data} set={set} label="Guardar la elección como variable (opcional)" />
      <WindowPolicyField data={data} set={set} />
    </>
  );
}

function ListForm({ data, set }: { data: Record<string, any>; set: (p: Record<string, unknown>) => void }) {
  const rows: Array<{ title: string; description?: string }> = Array.isArray(data.rows) ? data.rows : [];
  return (
    <>
      <BodyField data={data} set={set} label="Mensaje" />
      <div>
        <FieldLabel>Texto del botón que abre la lista</FieldLabel>
        <Input value={data.buttonText ?? ""} maxLength={20} onChange={(e) => set({ buttonText: e.target.value })} />
      </div>
      <div>
        <FieldLabel>Opciones (máx 10)</FieldLabel>
        <div className="space-y-2">
          {rows.map((row, index) => (
            <div key={index} className="rounded-xl border p-2 space-y-1">
              <div className="flex gap-1.5">
                <Input
                  value={row.title}
                  maxLength={24}
                  placeholder="Título (24)"
                  onChange={(e) => set({ rows: rows.map((r, i) => (i === index ? { ...r, title: e.target.value } : r)) })}
                />
                <RemoveButton onClick={() => set({ rows: rows.filter((_, i) => i !== index) })} />
              </div>
              <Input
                value={row.description ?? ""}
                maxLength={72}
                placeholder="Descripción (opcional)"
                onChange={(e) => set({ rows: rows.map((r, i) => (i === index ? { ...r, description: e.target.value } : r)) })}
              />
            </div>
          ))}
          {rows.length < 10 && (
            <Button variant="outline" size="sm" className="w-full" onClick={() => set({ rows: [...rows, { title: "", description: "" }] })}>
              <Plus className="size-3.5 mr-1" /> Agregar opción
            </Button>
          )}
        </div>
      </div>
      <DurationField data={data} set={set} field="timeout" label="Esperar respuesta hasta" />
      <SaveAsField data={data} set={set} label="Guardar la elección como variable (opcional)" />
      <WindowPolicyField data={data} set={set} />
    </>
  );
}

const TEMPLATE_VARIABLE_SOURCES = [
  { value: "static", label: "Texto fijo" },
  { value: "contact_field", label: "Campo del contacto" },
  { value: "flow_var", label: "Variable de la automatización" },
];

function TemplateForm({ data, set, refs }: { data: Record<string, any>; set: (p: Record<string, unknown>) => void; refs: BuilderRefs }) {
  const approved = refs.templates.filter((t) => t.status === "approved");
  const selected = approved.find((t) => t.id === data.templateId);
  const placeholders = selected ? extractTemplatePlaceholders(selected) : [];
  const variables: Record<string, { source?: string; value?: string }> = data.variables ?? {};

  return (
    <>
      <SelectField
        label="Plantilla aprobada"
        value={data.templateId ?? ""}
        placeholder="Elegí una plantilla…"
        options={approved.map((t) => ({ value: t.id, label: `${t.name} (${t.language})` }))}
        onChange={(value) => set({ templateId: value, variables: {} })}
      />
      {placeholders.map((placeholder) => {
        const entry = variables[placeholder] ?? { source: "static", value: "" };
        return (
          <div key={placeholder} className="rounded-xl border p-2 space-y-1">
            <FieldLabel>{placeholder}</FieldLabel>
            <div className="flex gap-1.5">
              <SimpleSelect
                className="w-36"
                value={entry.source ?? "static"}
                options={TEMPLATE_VARIABLE_SOURCES}
                onChange={(value) => set({ variables: { ...variables, [placeholder]: { ...entry, source: value } } })}
              />
              <Input
                className="flex-1"
                value={entry.value ?? ""}
                placeholder={entry.source === "contact_field" ? "name / email / customFields.x" : entry.source === "flow_var" ? "vars.monto" : "Valor"}
                onChange={(e) => set({ variables: { ...variables, [placeholder]: { ...entry, value: e.target.value } } })}
              />
            </div>
          </div>
        );
      })}
      <p className="text-xs text-muted-foreground">Es el único nodo que reabre la ventana de 24 h.</p>
    </>
  );
}

function AskForm({ data, set }: { data: Record<string, any>; set: (p: Record<string, unknown>) => void }) {
  return (
    <>
      <BodyField data={data} set={set} label="Pregunta" />
      <SaveAsField data={data} set={set} label="Guardar respuesta como variable" />
      <SelectField
        label="Validación"
        value={data.validation ?? "texto"}
        options={[
          { value: "texto", label: "Texto libre" },
          { value: "numero", label: "Número" },
          { value: "email", label: "Email" },
          { value: "telefono", label: "Teléfono" },
        ]}
        onChange={(value) => set({ validation: value })}
      />
      {data.validation && data.validation !== "texto" && (
        <div>
          <FieldLabel>Mensaje si la respuesta no es válida</FieldLabel>
          <Input value={data.invalidMessage ?? ""} placeholder="Mmm, eso no parece válido. ¿Me lo repetís?" onChange={(e) => set({ invalidMessage: e.target.value })} />
        </div>
      )}
      <SelectField
        label="Guardar también en la ficha del contacto"
        value={data.saveToContact ?? ""}
        placeholder="No guardar"
        options={[
          { value: "name", label: "Nombre" },
          { value: "email", label: "Email" },
          { value: "company", label: "Empresa" },
        ]}
        onChange={(value) => set({ saveToContact: value })}
      />
      <DurationField data={data} set={set} field="timeout" label="Esperar respuesta hasta" />
      <WindowPolicyField data={data} set={set} />
    </>
  );
}

// ── IA / equipo / lógica / HTTP ──────────────────────────────────

function AiRouteForm({ data, set }: { data: Record<string, any>; set: (p: Record<string, unknown>) => void }) {
  const options: Array<{ key: string; label: string }> = Array.isArray(data.options) ? data.options : [];
  // Clasificar no habla con el cliente: no necesita nombre ni tono, solo las
  // intenciones a distinguir.
  return (
    <>
      <div>
        <FieldLabel>Qué clasificar (opcional)</FieldLabel>
        <Input value={data.question ?? ""} placeholder="La intención del último mensaje" onChange={(e) => set({ question: e.target.value })} />
      </div>
      <div>
        <FieldLabel>Intenciones (2 a 6)</FieldLabel>
        <div className="space-y-1.5">
          {options.map((option, index) => (
            <div key={index} className="flex gap-1.5">
              <Input
                className="w-24"
                value={option.key}
                placeholder="clave"
                onChange={(e) =>
                  set({ options: options.map((o, i) => (i === index ? { ...o, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") } : o)) })
                }
              />
              <Input
                className="flex-1"
                value={option.label}
                placeholder="Descripción"
                onChange={(e) => set({ options: options.map((o, i) => (i === index ? { ...o, label: e.target.value } : o)) })}
              />
              <RemoveButton onClick={() => set({ options: options.filter((_, i) => i !== index) })} />
            </div>
          ))}
          {options.length < 6 && (
            <Button variant="outline" size="sm" className="w-full" onClick={() => set({ options: [...options, { key: "", label: "" }] })}>
              <Plus className="size-3.5 mr-1" /> Agregar intención
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">Conectá siempre la salida "No se pudo clasificar".</p>
      </div>
    </>
  );
}

function AssignForm({ data, set, refs }: { data: Record<string, any>; set: (p: Record<string, unknown>) => void; refs: BuilderRefs }) {
  return (
    <>
      <SelectField
        label="Cómo asignar"
        value={data.mode ?? "auto"}
        options={[
          { value: "auto", label: "Automático (menos ocupado)" },
          { value: "round_robin", label: "Por turnos (round-robin)" },
          { value: "specific", label: "Agente específico" },
        ]}
        onChange={(value) => set({ mode: value })}
      />
      {data.mode === "round_robin" && (
        <p className="text-xs text-muted-foreground -mt-2">
          Reparte parejo entre los agentes disponibles con acceso al número, en orden rotativo.
          A diferencia de "menos ocupado", no depende de cuántas conversaciones tenga abiertas cada uno.
        </p>
      )}
      {data.mode === "specific" && (
        <SelectField
          label="Agente"
          value={data.agentId ?? ""}
          placeholder="Elegí un agente…"
          options={refs.agents.map((a) => ({ value: a.id, label: a.name }))}
          onChange={(value) => set({ agentId: value })}
        />
      )}
    </>
  );
}

function LabelForm({ data, set, refs }: { data: Record<string, any>; set: (p: Record<string, unknown>) => void; refs: BuilderRefs }) {
  return (
    <>
      <SelectField
        label="Acción"
        value={data.action ?? "add"}
        options={[
          { value: "add", label: "Agregar etiqueta" },
          { value: "remove", label: "Quitar etiqueta" },
        ]}
        onChange={(value) => set({ action: value })}
      />
      <SelectField
        label="Etiqueta"
        value={data.labelId ?? ""}
        placeholder="Elegí una etiqueta…"
        options={refs.labels.map((l) => ({ value: l.id, label: l.name }))}
        onChange={(value) => set({ labelId: value })}
      />
    </>
  );
}

const CONTACT_FIELDS = [
  { value: "name", label: "Nombre" },
  { value: "email", label: "Email" },
  { value: "company", label: "Empresa" },
  { value: "notes", label: "Notas (agrega)" },
  { value: "custom", label: "Personalizado" },
];

function UpdateContactForm({ data, set }: { data: Record<string, any>; set: (p: Record<string, unknown>) => void }) {
  const fields: Array<{ field: string; value: string }> = Array.isArray(data.fields) ? data.fields : [];
  return (
    <div>
      <FieldLabel>Campos a actualizar</FieldLabel>
      <div className="space-y-1.5">
        {fields.map((entry, index) => (
          <div key={index} className="flex gap-1.5">
            <SimpleSelect
              className="w-32"
              value={entry.field?.startsWith("custom.") ? "custom" : entry.field}
              options={CONTACT_FIELDS}
              onChange={(selected) => {
                const value = selected === "custom" ? "custom." : selected;
                set({ fields: fields.map((f, i) => (i === index ? { ...f, field: value } : f)) });
              }}
            />
            {entry.field?.startsWith("custom.") && (
              <Input
                className="w-24"
                value={entry.field.slice(7)}
                placeholder="clave"
                onChange={(e) => set({ fields: fields.map((f, i) => (i === index ? { ...f, field: `custom.${e.target.value}` } : f)) })}
              />
            )}
            <Input
              className="flex-1"
              value={entry.value}
              placeholder="{{vars.x}}"
              onChange={(e) => set({ fields: fields.map((f, i) => (i === index ? { ...f, value: e.target.value } : f)) })}
            />
            <RemoveButton onClick={() => set({ fields: fields.filter((_, i) => i !== index) })} />
          </div>
        ))}
        <Button variant="outline" size="sm" className="w-full" onClick={() => set({ fields: [...fields, { field: "name", value: "" }] })}>
          <Plus className="size-3.5 mr-1" /> Agregar campo
        </Button>
      </div>
    </div>
  );
}

const CONDITION_SOURCES = [
  { value: "message.body", label: "Mensaje del cliente" },
  { value: "contact.name", label: "Nombre del contacto" },
  { value: "contact.email", label: "Email del contacto" },
  { value: "contact.company", label: "Empresa del contacto" },
  { value: "sender.type", label: "Quién escribe" },
  { value: "ad.sourceId", label: "ID del anuncio de origen" },
  { value: "ad.headline", label: "Título del anuncio de origen" },
  { value: "__schedule__", label: "Horario / día" },
  { value: "__custom__", label: "Variable (escribir path)" },
];

const CONDITION_OPERATORS = [
  { value: "equals", label: "es" },
  { value: "not_equals", label: "no es" },
  { value: "contains", label: "contiene" },
  { value: "not_contains", label: "no contiene" },
  { value: "starts_with", label: "empieza con" },
  { value: "gt", label: "mayor que" },
  { value: "lt", label: "menor que" },
  { value: "exists", label: "existe" },
  { value: "not_exists", label: "no existe" },
];

function ConditionForm({ data, set }: { data: Record<string, any>; set: (p: Record<string, unknown>) => void }) {
  const rules: Array<Record<string, any>> = Array.isArray(data.rules) ? data.rules : [];
  const setRule = (index: number, patch: Record<string, unknown>) =>
    set({ rules: rules.map((r, i) => (i === index ? { ...r, ...patch } : r)) });

  return (
    <>
      <SelectField
        label="Se cumple cuando"
        value={data.logic ?? "and"}
        options={[
          { value: "and", label: "Todas las reglas" },
          { value: "or", label: "Alguna regla" },
        ]}
        onChange={(value) => set({ logic: value })}
      />
      <div className="space-y-2">
        {rules.map((rule, index) => {
          const isSchedule = rule.op === "in_schedule";
          const sourceKind = isSchedule ? "__schedule__" : CONDITION_SOURCES.some((s) => s.value === rule.left) ? rule.left : "__custom__";
          return (
            <div key={index} className="rounded-xl border p-2 space-y-1.5">
              <div className="flex gap-1.5">
                <SimpleSelect
                  className="flex-1"
                  value={sourceKind}
                  options={CONDITION_SOURCES}
                  onChange={(value) => {
                    if (value === "__schedule__") {
                      setRule(index, { op: "in_schedule", schedule: rule.schedule ?? { days: [1, 2, 3, 4, 5], from: "09:00", to: "18:00", timezone: "America/Montevideo" } });
                    } else if (value === "__custom__") {
                      setRule(index, { op: rule.op === "in_schedule" ? "equals" : rule.op, left: "vars." });
                    } else {
                      setRule(index, { op: rule.op === "in_schedule" ? "contains" : rule.op, left: value });
                    }
                  }}
                />
                <RemoveButton onClick={() => set({ rules: rules.filter((_, i) => i !== index) })} />
              </div>

              {isSchedule ? (
                <ScheduleEditor rule={rule} onChange={(patch) => setRule(index, patch)} />
              ) : (
                <>
                  {sourceKind === "__custom__" && (
                    <Input value={rule.left ?? ""} placeholder="vars.monto / webhook.total" onChange={(e) => setRule(index, { left: e.target.value })} />
                  )}
                  <div className="flex gap-1.5">
                    <SimpleSelect
                      className="w-32"
                      value={rule.op ?? "equals"}
                      options={CONDITION_OPERATORS}
                      onChange={(value) => setRule(index, { op: value })}
                    />
                    {!["exists", "not_exists"].includes(rule.op) && (
                      <Input className="flex-1" value={rule.value ?? ""} onChange={(e) => setRule(index, { value: e.target.value })} />
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
        <Button variant="outline" size="sm" className="w-full" onClick={() => set({ rules: [...rules, { left: "message.body", op: "contains", value: "" }] })}>
          <Plus className="size-3.5 mr-1" /> Agregar regla
        </Button>
      </div>
    </>
  );
}

const DAY_LABELS = ["D", "L", "M", "X", "J", "V", "S"];

function ScheduleEditor({ rule, onChange }: { rule: Record<string, any>; onChange: (patch: Record<string, unknown>) => void }) {
  const schedule = rule.schedule ?? { days: [1, 2, 3, 4, 5], from: "09:00", to: "18:00", timezone: "America/Montevideo" };
  const days: number[] = Array.isArray(schedule.days) ? schedule.days : [];
  return (
    <div className="space-y-1.5">
      <div className="flex gap-1">
        {DAY_LABELS.map((label, day) => (
          <button
            key={day}
            type="button"
            className={cn(
              "size-8 rounded-md text-xs font-medium md:size-7",
              days.includes(day) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
            )}
            onClick={() =>
              onChange({ schedule: { ...schedule, days: days.includes(day) ? days.filter((d) => d !== day) : [...days, day] } })
            }
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <Input type="time" value={schedule.from} onChange={(e) => onChange({ schedule: { ...schedule, from: e.target.value } })} />
        <span className="text-xs text-muted-foreground">a</span>
        <Input type="time" value={schedule.to} onChange={(e) => onChange({ schedule: { ...schedule, to: e.target.value } })} />
      </div>
      <Input value={schedule.timezone} placeholder="America/Montevideo" onChange={(e) => onChange({ schedule: { ...schedule, timezone: e.target.value } })} />
    </div>
  );
}

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"].map((method) => ({ value: method, label: method }));

function HttpForm({ data, set, refs }: { data: Record<string, any>; set: (p: Record<string, unknown>) => void; refs: BuilderRefs }) {
  const headers: Array<{ name: string; value: string }> = Array.isArray(data.headers) ? data.headers : [];
  return (
    <>
      <div className="flex gap-1.5">
        <SimpleSelect
          className="w-24"
          value={data.method ?? "GET"}
          options={HTTP_METHODS}
          onChange={(value) => set({ method: value })}
        />
        <Input className="flex-1" value={data.url ?? ""} placeholder="https://api…" onChange={(e) => set({ url: e.target.value })} />
      </div>
      <SelectField
        label="Conexión (credencial guardada)"
        value={data.connectionId ?? ""}
        placeholder="Sin conexión"
        options={refs.connections.map((c) => ({ value: c.id, label: `${c.name} (${c.headerName})` }))}
        onChange={(value) => set({ connectionId: value })}
      />
      <div>
        <FieldLabel>Headers</FieldLabel>
        <div className="space-y-1.5">
          {headers.map((header, index) => (
            <div key={index} className="flex gap-1.5">
              <Input className="w-32" value={header.name} placeholder="Header" onChange={(e) => set({ headers: headers.map((h, i) => (i === index ? { ...h, name: e.target.value } : h)) })} />
              <Input className="flex-1" value={header.value} placeholder="Valor" onChange={(e) => set({ headers: headers.map((h, i) => (i === index ? { ...h, value: e.target.value } : h)) })} />
              <RemoveButton onClick={() => set({ headers: headers.filter((_, i) => i !== index) })} />
            </div>
          ))}
          <Button variant="outline" size="sm" className="w-full" onClick={() => set({ headers: [...headers, { name: "", value: "" }] })}>
            <Plus className="size-3.5 mr-1" /> Agregar header
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">No pegues tokens acá: usá una Conexión.</p>
      </div>
      <SelectField
        label="Body"
        value={data.bodyMode ?? "none"}
        options={[
          { value: "none", label: "Sin body" },
          { value: "json", label: "JSON" },
        ]}
        onChange={(value) => set({ bodyMode: value })}
      />
      {data.bodyMode === "json" && (
        <Textarea rows={5} className="font-mono text-xs" value={data.body ?? ""} placeholder='{"total": {{vars.monto}}}' onChange={(e) => set({ body: e.target.value })} />
      )}
      <SaveAsField data={data} set={set} label="Guardar respuesta como variable" />
      {data.saveAs ? (
        <p className="text-xs text-muted-foreground -mt-2">
          Después usá {`{{vars.${data.saveAs}.status}}`} y {`{{vars.${data.saveAs}.body.<campo>}}`}
        </p>
      ) : null}
      <ToggleField label="Reintentar si falla (solo endpoints idempotentes)" checked={data.retryOnFailure === true} onChange={(v) => set({ retryOnFailure: v })} />
    </>
  );
}

// ── Preview de burbuja WhatsApp ──────────────────────────────────

function hasPreview(type: string): boolean {
  return ["action.send_text", "action.send_buttons", "action.send_list", "action.ask"].includes(type);
}

function usesVariables(type: string): boolean {
  return !type.startsWith("trigger.") && type !== "action.label" && type !== "action.assign_agent" && type !== "logic.delay";
}

function WhatsAppPreview({ node }: { node: FlowNode }) {
  const { t } = useTranslations();
  const data = node.data as Record<string, any>;
  const body = String(data.body ?? "");
  const buttons: Array<{ title: string }> =
    node.type === "action.send_buttons" && Array.isArray(data.buttons) ? data.buttons : [];
  const isList = node.type === "action.send_list";

  return (
    <div>
      <FieldLabel>{t.flows.nodePreview}</FieldLabel>
      {/* Reproduce la burbuja del chat: usa los tokens `--asis-*`, la excepción
          de paleta que el sistema reserva para el lenguaje de WhatsApp. */}
      <div className="rounded-xl bg-[var(--asis-surface-panel)] p-3 ring-1 ring-foreground/10">
        <div className="max-w-full rounded-xl bg-[var(--asis-bubble-outbound)] px-3 py-2 text-sm leading-snug text-foreground shadow-sm">
          <p className="whitespace-pre-wrap break-words">
            {body.split(/(\{\{[^}]+\}\})/g).map((part, index) =>
              part.startsWith("{{") ? (
                <span key={index} className="font-medium text-primary">{part}</span>
              ) : (
                <span key={index}>{part}</span>
              ),
            ) || "…"}
          </p>
          {data.footer ? <p className="mt-1 text-xs text-muted-foreground">{String(data.footer)}</p> : null}
        </div>
        {buttons.length > 0 && (
          <div className="mt-1.5 space-y-1">
            {buttons.map((button, index) => (
              <div key={index} className="rounded-xl bg-[var(--asis-bubble-inbound)] py-1.5 text-center text-sm text-primary shadow-sm">
                {button.title || `Botón ${index + 1}`}
              </div>
            ))}
          </div>
        )}
        {isList && (
          <div className="mt-1.5 rounded-xl bg-[var(--asis-bubble-inbound)] py-1.5 text-center text-sm text-primary shadow-sm">
            ≡ {String(data.buttonText || "Ver opciones")}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Variables disponibles aguas arriba ───────────────────────────

function collectVariables(nodeId: string, nodes: FlowNode[], edges: FlowEdge[]): string[] {
  const incoming = new Map<string, string[]>();
  for (const edge of edges) {
    const list = incoming.get(edge.target) ?? [];
    list.push(edge.source);
    incoming.set(edge.target, list);
  }
  const ancestors = new Set<string>();
  const queue = [...(incoming.get(nodeId) ?? [])];
  while (queue.length) {
    const current = queue.shift()!;
    if (ancestors.has(current)) continue;
    ancestors.add(current);
    queue.push(...(incoming.get(current) ?? []));
  }

  const variables = ["contact.name", "contact.phone", "contact.email", "message.body", "flow.name"];
  const hasWebhookTrigger = nodes.some((n) => n.type === "trigger.webhook");
  if (hasWebhookTrigger) variables.push("webhook.<campo>");
  for (const node of nodes) {
    if (!ancestors.has(node.id)) continue;
    const saveAs = (node.data as any)?.saveAs;
    if (typeof saveAs === "string" && saveAs) variables.push(`vars.${saveAs}`);
  }
  return variables;
}

function extractTemplatePlaceholders(template: MessageTemplate): string[] {
  const placeholders: string[] = [];
  for (const component of template.components as Array<{ type: string; format?: string; text?: string }>) {
    if (component.type === "BODY" && component.text) {
      for (const match of component.text.matchAll(/\{\{([a-z0-9_]+)\}\}/gi)) placeholders.push(`body.${match[1]}`);
    } else if (component.type === "HEADER") {
      if (component.format === "TEXT" && component.text) {
        for (const match of component.text.matchAll(/\{\{([a-z0-9_]+)\}\}/gi)) placeholders.push(`header.${match[1]}`);
      } else if (component.format && component.format !== "TEXT") {
        placeholders.push("header.link");
      }
    }
  }
  return [...new Set(placeholders)];
}
