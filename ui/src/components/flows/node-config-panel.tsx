"use client";

// Panel derecho de configuración del nodo seleccionado. Un formulario por
// tipo, con preview de burbuja de WhatsApp y variables disponibles.

import { useMemo, useState } from "react";
import { FileText, FolderOpen, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MediaPickerDialog } from "@/components/media/media-picker-dialog";
import { cn } from "@/lib/utils";
import { NODE_BY_TYPE, CATEGORY_STYLES } from "@/lib/flows/node-catalog";
import { useTranslations } from "@/lib/i18n/use-translations";
import type { FlowNode, FlowEdge, Label, AiAgentWithConfig, Agent, PhoneNumber, MessageTemplate } from "@/types";

export interface BuilderRefs {
  labels: Label[];
  aiAgents: AiAgentWithConfig[];
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
          <button className="text-muted-foreground hover:text-destructive" title={t.flows.deleteNode} onClick={props.onDelete}>
            <Trash2 className="size-4" />
          </button>
        )}
        <button className="text-muted-foreground hover:text-foreground" onClick={props.onClose}>
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4 text-sm">
        {renderForm(node.type, data, set, refs, props.onChangeTriggerType)}

        {availableVariables.length > 0 && usesVariables(node.type) && (
          <div>
            <FieldLabel>Variables disponibles</FieldLabel>
            <div className="flex flex-wrap gap-1">
              {availableVariables.map((variable) => (
                <button
                  key={variable}
                  className="text-[11px] bg-muted rounded px-1.5 py-0.5 font-mono hover:bg-primary/10"
                  title="Copiar"
                  onClick={() => void navigator.clipboard.writeText(`{{${variable}}}`)}
                >
                  {`{{${variable}}}`}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Tocá para copiar y pegala en el texto.</p>
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
    case "action.ai_reply":
      return (
        <>
          <AiAgentField data={data} set={set} refs={refs} />
          <div>
            <FieldLabel>Instrucciones extra (opcional)</FieldLabel>
            <Textarea rows={3} value={data.instructions ?? ""} placeholder="Ej: respondé solo consultas de horarios y precios" onChange={(e) => set({ instructions: e.target.value })} />
          </div>
        </>
      );
    case "logic.ai_route":
      return <AiRouteForm data={data} set={set} refs={refs} />;
    case "action.handoff_ai":
      return <AiAgentField data={data} set={set} refs={refs} />;
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

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-medium text-muted-foreground mb-1">{children}</p>;
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
      <p className={cn("text-[11px] mt-0.5 text-right", over ? "text-destructive" : "text-muted-foreground")}>
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
  placeholder?: string;
}) {
  return (
    <div>
      <FieldLabel>{props.label}</FieldLabel>
      <select
        className="w-full h-9 rounded-md border bg-background px-2 text-sm"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      >
        {props.placeholder !== undefined && <option value="">{props.placeholder}</option>}
        {props.options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </div>
  );
}

function ToggleField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button className="flex items-center justify-between w-full py-1" onClick={() => onChange(!checked)} type="button">
      <span className="text-xs">{label}</span>
      <span className={cn("w-8 h-4.5 rounded-full p-0.5 transition-colors", checked ? "bg-primary" : "bg-muted")}>
        <span className={cn("block size-3.5 rounded-full bg-white transition-transform", checked && "translate-x-3.5")} />
      </span>
    </button>
  );
}

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
        <select
          className="flex-1 h-9 rounded-md border bg-background px-2 text-sm"
          value={duration.unit ?? "days"}
          onChange={(e) => set({ [field]: { ...duration, unit: e.target.value } })}
        >
          <option value="minutes">minutos</option>
          <option value="hours">horas</option>
          <option value="days">días (máx 7)</option>
        </select>
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
      {data.saveAs ? <p className="text-[11px] text-muted-foreground mt-0.5">Usala como {`{{vars.${data.saveAs}}}`}</p> : null}
    </div>
  );
}

function AiAgentField({ data, set, refs }: { data: Record<string, any>; set: (p: Record<string, unknown>) => void; refs: BuilderRefs }) {
  // El validador solo acepta asistentes activos; se conserva el ya elegido
  // aunque esté inactivo para no blanquear la config en silencio.
  const options = refs.aiAgents
    .filter((a) => a.config?.isActive || a.id === data.aiAgentId)
    .map((a) => ({ value: a.id, label: a.config?.isActive ? a.name : `${a.name} (inactivo)` }));
  return (
    <SelectField
      label="Asistente IA"
      value={data.aiAgentId ?? ""}
      placeholder="Elegí un asistente…"
      options={options}
      onChange={(value) => set({ aiAgentId: value })}
    />
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
  const phoneIds: string[] = Array.isArray(data.phoneNumberIds) ? data.phoneNumberIds : [];
  return (
    <>
      <TriggerTypeSwitch current="trigger.inbound_message" onChangeTriggerType={onChangeTriggerType} />
      <div>
        <FieldLabel>Números donde aplica (ninguno = todos)</FieldLabel>
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
      </div>
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
      <ToggleField label="No interrumpir si atiende un humano" checked={data.ignoreIfAssignedToHuman !== false} onChange={(v) => set({ ignoreIfAssignedToHuman: v })} />
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
      <p className="text-[11px] text-muted-foreground">
        La URL del webhook aparece arriba después de publicar. El payload queda disponible como {"{{webhook.*}}"}.
        Como suele llegar fuera de la ventana de 24 h, empezá con una plantilla.
      </p>
    </>
  );
}

function TriggerCampaignReplyForm({ data, set, refs, onChangeTriggerType }: { data: Record<string, any>; set: (p: Record<string, unknown>) => void; refs: BuilderRefs; onChangeTriggerType: (t: string) => void }) {
  const campaignIds: string[] = Array.isArray(data.campaignIds) ? data.campaignIds : [];
  const phoneIds: string[] = Array.isArray(data.phoneNumberIds) ? data.phoneNumberIds : [];
  return (
    <>
      <TriggerTypeSwitch current="trigger.campaign_reply" onChangeTriggerType={onChangeTriggerType} />
      <div>
        <FieldLabel>Números donde aplica (ninguno = todos)</FieldLabel>
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
      </div>
      <div>
        <FieldLabel>Campañas (ninguna = todas)</FieldLabel>
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {refs.campaigns.length === 0 && (
            <p className="text-[11px] text-muted-foreground">Todavía no tenés campañas.</p>
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
      <p className="text-[11px] text-muted-foreground">
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
          { value: "document", label: "Documento (PDF u otro)" },
        ]}
        onChange={(value) => set({ mediaType: value })}
      />

      <div>
        <FieldLabel>Archivo</FieldLabel>
        {data.mediaAssetName ? (
          <div className="flex items-center gap-2 rounded-md border border-border px-2.5 py-2">
            <FileText className="h-4 w-4 shrink-0 text-primary" />
            <span className="min-w-0 flex-1 truncate text-[13px]">{data.mediaAssetName}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[12px]"
              onClick={() => set({ mediaAssetId: "", mediaAssetName: "" })}
            >
              Quitar
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="w-full" onClick={() => setPickerOpen(true)}>
            <FolderOpen className="mr-2 h-4 w-4" />
            Elegir de la biblioteca
          </Button>
        )}
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Lo subimos a WhatsApp por vos: no hace falta que el archivo sea público.
        </p>
      </div>

      {!data.mediaAssetId && (
        <div>
          <FieldLabel>…o pegá una URL pública (https)</FieldLabel>
          <Input value={data.mediaUrl ?? ""} placeholder="https://…/catalogo.pdf" onChange={(e) => set({ mediaUrl: e.target.value })} />
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Tiene que ser accesible públicamente: WhatsApp la descarga desde sus servidores.
          </p>
        </div>
      )}

      <MediaPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        kinds={data.mediaType === "document" ? ["document"] : ["image"]}
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
      <div>
        <FieldLabel>Texto que acompaña (opcional)</FieldLabel>
        <Textarea rows={2} value={data.caption ?? ""} onChange={(e) => set({ caption: e.target.value })} />
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
        {data.saveAs ? <p className="text-[11px] text-muted-foreground mt-0.5">La usás como {`{{vars.${data.saveAs}}}`}</p> : null}
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
          <p className="text-[11px] text-muted-foreground mt-0.5">
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
              <Input className="w-28 text-xs" value={field.key} placeholder="clave" onChange={(e) => set({ fields: fields.map((f, i) => (i === index ? { ...f, key: e.target.value } : f)) })} />
              <Input className="flex-1 text-xs" value={field.value} placeholder="{{vars.x}}" onChange={(e) => set({ fields: fields.map((f, i) => (i === index ? { ...f, value: e.target.value } : f)) })} />
              <Button variant="ghost" size="sm" onClick={() => set({ fields: fields.filter((_, i) => i !== index) })}>
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="w-full" onClick={() => set({ fields: [...fields, { key: "", value: "" }] })}>
            <Plus className="size-3.5 mr-1" /> Agregar dato
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">
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
              <Button variant="ghost" size="sm" onClick={() => set({ buttons: buttons.filter((_, i) => i !== index) })}>
                <Trash2 className="size-3.5" />
              </Button>
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
            <div key={index} className="border rounded-md p-2 space-y-1">
              <div className="flex gap-1.5">
                <Input
                  value={row.title}
                  maxLength={24}
                  placeholder="Título (24)"
                  onChange={(e) => set({ rows: rows.map((r, i) => (i === index ? { ...r, title: e.target.value } : r)) })}
                />
                <Button variant="ghost" size="sm" onClick={() => set({ rows: rows.filter((_, i) => i !== index) })}>
                  <Trash2 className="size-3.5" />
                </Button>
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
          <div key={placeholder} className="border rounded-md p-2 space-y-1">
            <FieldLabel>{placeholder}</FieldLabel>
            <div className="flex gap-1.5">
              <select
                className="h-9 rounded-md border bg-background px-2 text-xs"
                value={entry.source ?? "static"}
                onChange={(e) => set({ variables: { ...variables, [placeholder]: { ...entry, source: e.target.value } } })}
              >
                <option value="static">Texto fijo</option>
                <option value="contact_field">Campo del contacto</option>
                <option value="flow_var">Variable del flujo</option>
              </select>
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
      <p className="text-[11px] text-muted-foreground">Es el único nodo que reabre la ventana de 24 h.</p>
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

function AiRouteForm({ data, set, refs }: { data: Record<string, any>; set: (p: Record<string, unknown>) => void; refs: BuilderRefs }) {
  const options: Array<{ key: string; label: string }> = Array.isArray(data.options) ? data.options : [];
  return (
    <>
      <AiAgentField data={data} set={set} refs={refs} />
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
              <Button variant="ghost" size="sm" onClick={() => set({ options: options.filter((_, i) => i !== index) })}>
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
          {options.length < 6 && (
            <Button variant="outline" size="sm" className="w-full" onClick={() => set({ options: [...options, { key: "", label: "" }] })}>
              <Plus className="size-3.5 mr-1" /> Agregar intención
            </Button>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">Conectá siempre la salida "No se pudo clasificar".</p>
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
        <p className="text-[11px] text-muted-foreground -mt-2">
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

function UpdateContactForm({ data, set }: { data: Record<string, any>; set: (p: Record<string, unknown>) => void }) {
  const fields: Array<{ field: string; value: string }> = Array.isArray(data.fields) ? data.fields : [];
  return (
    <div>
      <FieldLabel>Campos a actualizar</FieldLabel>
      <div className="space-y-1.5">
        {fields.map((entry, index) => (
          <div key={index} className="flex gap-1.5">
            <select
              className="h-9 rounded-md border bg-background px-2 text-xs w-32"
              value={entry.field?.startsWith("custom.") ? "custom" : entry.field}
              onChange={(e) => {
                const value = e.target.value === "custom" ? "custom." : e.target.value;
                set({ fields: fields.map((f, i) => (i === index ? { ...f, field: value } : f)) });
              }}
            >
              <option value="name">Nombre</option>
              <option value="email">Email</option>
              <option value="company">Empresa</option>
              <option value="notes">Notas (agrega)</option>
              <option value="custom">Personalizado</option>
            </select>
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
            <Button variant="ghost" size="sm" onClick={() => set({ fields: fields.filter((_, i) => i !== index) })}>
              <Trash2 className="size-3.5" />
            </Button>
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
  { value: "__schedule__", label: "Horario / día" },
  { value: "__custom__", label: "Variable (escribir path)" },
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
            <div key={index} className="border rounded-md p-2 space-y-1.5">
              <div className="flex gap-1.5">
                <select
                  className="flex-1 h-8 rounded-md border bg-background px-2 text-xs"
                  value={sourceKind}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === "__schedule__") {
                      setRule(index, { op: "in_schedule", schedule: rule.schedule ?? { days: [1, 2, 3, 4, 5], from: "09:00", to: "18:00", timezone: "America/Montevideo" } });
                    } else if (value === "__custom__") {
                      setRule(index, { op: rule.op === "in_schedule" ? "equals" : rule.op, left: "vars." });
                    } else {
                      setRule(index, { op: rule.op === "in_schedule" ? "contains" : rule.op, left: value });
                    }
                  }}
                >
                  {CONDITION_SOURCES.map((source) => (
                    <option key={source.value} value={source.value}>{source.label}</option>
                  ))}
                </select>
                <Button variant="ghost" size="sm" onClick={() => set({ rules: rules.filter((_, i) => i !== index) })}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>

              {isSchedule ? (
                <ScheduleEditor rule={rule} onChange={(patch) => setRule(index, patch)} />
              ) : (
                <>
                  {sourceKind === "__custom__" && (
                    <Input className="h-8 text-xs" value={rule.left ?? ""} placeholder="vars.monto / webhook.total" onChange={(e) => setRule(index, { left: e.target.value })} />
                  )}
                  <div className="flex gap-1.5">
                    <select
                      className="h-8 rounded-md border bg-background px-2 text-xs w-32"
                      value={rule.op ?? "equals"}
                      onChange={(e) => setRule(index, { op: e.target.value })}
                    >
                      <option value="equals">es</option>
                      <option value="not_equals">no es</option>
                      <option value="contains">contiene</option>
                      <option value="not_contains">no contiene</option>
                      <option value="starts_with">empieza con</option>
                      <option value="gt">mayor que</option>
                      <option value="lt">menor que</option>
                      <option value="exists">existe</option>
                      <option value="not_exists">no existe</option>
                    </select>
                    {!["exists", "not_exists"].includes(rule.op) && (
                      <Input className="h-8 text-xs flex-1" value={rule.value ?? ""} onChange={(e) => setRule(index, { value: e.target.value })} />
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
              "size-6 rounded text-[11px] font-medium",
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
        <Input type="time" className="h-8 text-xs" value={schedule.from} onChange={(e) => onChange({ schedule: { ...schedule, from: e.target.value } })} />
        <span className="text-xs text-muted-foreground">a</span>
        <Input type="time" className="h-8 text-xs" value={schedule.to} onChange={(e) => onChange({ schedule: { ...schedule, to: e.target.value } })} />
      </div>
      <Input className="h-8 text-xs" value={schedule.timezone} placeholder="America/Montevideo" onChange={(e) => onChange({ schedule: { ...schedule, timezone: e.target.value } })} />
    </div>
  );
}

function HttpForm({ data, set, refs }: { data: Record<string, any>; set: (p: Record<string, unknown>) => void; refs: BuilderRefs }) {
  const headers: Array<{ name: string; value: string }> = Array.isArray(data.headers) ? data.headers : [];
  return (
    <>
      <div className="flex gap-1.5">
        <select
          className="h-9 rounded-md border bg-background px-2 text-sm w-24"
          value={data.method ?? "GET"}
          onChange={(e) => set({ method: e.target.value })}
        >
          {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
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
              <Input className="w-32 text-xs" value={header.name} placeholder="Header" onChange={(e) => set({ headers: headers.map((h, i) => (i === index ? { ...h, name: e.target.value } : h)) })} />
              <Input className="flex-1 text-xs" value={header.value} placeholder="Valor" onChange={(e) => set({ headers: headers.map((h, i) => (i === index ? { ...h, value: e.target.value } : h)) })} />
              <Button variant="ghost" size="sm" onClick={() => set({ headers: headers.filter((_, i) => i !== index) })}>
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="w-full" onClick={() => set({ headers: [...headers, { name: "", value: "" }] })}>
            <Plus className="size-3.5 mr-1" /> Agregar header
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">No pegues tokens acá: usá una Conexión.</p>
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
        <p className="text-[11px] text-muted-foreground -mt-2">
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
  const data = node.data as Record<string, any>;
  const body = String(data.body ?? "");
  const buttons: Array<{ title: string }> =
    node.type === "action.send_buttons" && Array.isArray(data.buttons) ? data.buttons : [];
  const isList = node.type === "action.send_list";

  return (
    <div>
      <FieldLabel>Vista previa</FieldLabel>
      <div className="rounded-lg p-3" style={{ background: "#e5ddd5" }}>
        <div
          className="rounded-lg px-3 py-2 text-[13px] leading-snug max-w-full text-neutral-900 shadow-sm"
          style={{ background: "var(--asis-bubble-outbound, #DBEAFE)" }}
        >
          <p className="whitespace-pre-wrap break-words">
            {body.split(/(\{\{[^}]+\}\})/g).map((part, index) =>
              part.startsWith("{{") ? (
                <span key={index} className="text-teal-700 font-medium">{part}</span>
              ) : (
                <span key={index}>{part}</span>
              ),
            ) || "…"}
          </p>
          {data.footer ? <p className="text-[11px] text-neutral-500 mt-1">{String(data.footer)}</p> : null}
        </div>
        {buttons.length > 0 && (
          <div className="mt-1.5 space-y-1">
            {buttons.map((button, index) => (
              <div key={index} className="bg-white rounded-lg py-1.5 text-center text-[13px] text-sky-600 shadow-sm">
                {button.title || `Botón ${index + 1}`}
              </div>
            ))}
          </div>
        )}
        {isList && (
          <div className="mt-1.5 bg-white rounded-lg py-1.5 text-center text-[13px] text-sky-600 shadow-sm">
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
