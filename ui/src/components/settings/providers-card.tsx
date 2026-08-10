"use client";

// Proveedores externos: el carpintero, el plomero. Gente de afuera con su
// propio WhatsApp, a la que las automatizaciones le pasan datos de clientes.
//
// No son agentes (no atienden en la bandeja) ni contactos (no son clientes).
// Y la conversación NO se les transfiere: eso no existe en WhatsApp. Lo que
// reciben es una plantilla con el dato y un botón para escribirle al cliente.

import { useEffect, useState } from "react";
import { Handshake, Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { StatusPill } from "@/components/ui/status-pill";
import { LoadingState, Spinner } from "@/components/ui/spinner";
import { InlineNotice } from "@/components/shared/inline-notice";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import { useAuthStore } from "@/stores/auth.store";
import type { ServiceProvider } from "@/types";

interface DraftProvider {
  id?: string;
  name: string;
  phone: string;
  services: string;
  active: boolean;
  optIn: boolean;
  optInNote: string;
  notes: string;
}

const EMPTY: DraftProvider = {
  name: "",
  phone: "",
  services: "",
  active: true,
  optIn: false,
  optInNote: "",
  notes: "",
};

export function ProvidersCard() {
  const agent = useAuthStore((s) => s.agent);
  const confirm = useConfirm();
  const [providers, setProviders] = useState<ServiceProvider[] | null>(null);
  const [draft, setDraft] = useState<DraftProvider | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () =>
    api
      .get<ServiceProvider[]>("/providers")
      .then(setProviders)
      .catch(() => setProviders([]));

  useEffect(() => {
    void load();
  }, []);

  if (agent?.role !== "admin") return null;

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    const body = {
      name: draft.name,
      phone: draft.phone,
      services: draft.services.split(",").map((s) => s.trim()).filter(Boolean),
      active: draft.active,
      optIn: draft.optIn,
      optInNote: draft.optInNote,
      notes: draft.notes,
    };
    try {
      if (draft.id) await api.patch(`/providers/${draft.id}`, body);
      else await api.post("/providers", body);
      setDraft(null);
      await load();
      toast.success("Proveedor guardado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (provider: ServiceProvider) => {
    if (!(await confirm({ title: `¿Borrar a ${provider.name}?`, confirmLabel: "Borrar", destructive: true }))) return;
    try {
      await api.delete(`/providers/${provider.id}`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo borrar");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Handshake className="h-4 w-4" />
          Proveedores
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <InlineNotice variant="info">
          Terceros a los que una automatización les pasa el dato de un cliente. Reciben una plantilla
          con un botón para escribirle; la conversación no se transfiere.
        </InlineNotice>

        {providers === null ? (
          <LoadingState className="py-6" />
        ) : providers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no cargaste ninguno.</p>
        ) : (
          <div className="divide-y overflow-hidden rounded-xl border">
            {providers.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium">{p.name}</span>
                    <StatusPill tone={p.active ? "success" : "neutral"}>
                      {p.active ? "Activo" : "Pausado"}
                    </StatusPill>
                    {!p.optInAt && <StatusPill tone="warning">Sin permiso</StatusPill>}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    +{p.phone}
                    {p.services.length > 0 && ` · ${p.services.join(" · ")}`}
                    {p.assignedCount > 0 && ` · ${p.assignedCount} derivados`}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Editar"
                  onClick={() =>
                    setDraft({
                      id: p.id,
                      name: p.name,
                      phone: `+${p.phone}`,
                      services: p.services.join(", "),
                      active: p.active,
                      optIn: p.optInAt !== null,
                      optInNote: p.optInNote,
                      notes: p.notes,
                    })
                  }
                >
                  <Pencil className="size-4 text-muted-foreground" />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label="Borrar" onClick={() => void remove(p)}>
                  <Trash2 className="size-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <Button variant="outline" size="sm" onClick={() => setDraft({ ...EMPTY })}>
          <Plus className="size-4" />
          Agregar proveedor
        </Button>
      </CardContent>

      <ResponsiveDialog
        open={draft !== null}
        onOpenChange={(open) => !open && setDraft(null)}
        title={draft?.id ? "Editar proveedor" : "Nuevo proveedor"}
        footer={
          <Button onClick={() => void save()} disabled={saving || !draft?.name || !draft?.phone}>
            {saving && <Spinner size="sm" />}
            Guardar
          </Button>
        }
      >
        {draft && (
          <div className="space-y-4">
            <Field label="Nombre">
              <Input
                value={draft.name}
                placeholder="Juan Pérez"
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </Field>

            <Field label="WhatsApp" hint="Su número personal, con código de país.">
              <Input
                value={draft.phone}
                placeholder="+598 99 123 456"
                onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
              />
            </Field>

            <Field
              label="Servicios que cubre"
              hint="Separados por coma. Tienen que coincidir con las opciones de la lista del flujo."
            >
              <Input
                value={draft.services}
                placeholder="carpinteria, muebles"
                onChange={(e) => setDraft({ ...draft, services: e.target.value })}
              />
            </Field>

            {/* El permiso no es un trámite: le escribimos primero, y si marca el
                mensaje como spam se cae la calidad del número del cliente. */}
            <label className="flex items-start gap-2.5 rounded-xl border p-3">
              <input
                type="checkbox"
                className="mt-0.5 size-4 shrink-0"
                checked={draft.optIn}
                onChange={(e) => setDraft({ ...draft, optIn: e.target.checked })}
              />
              <span className="text-sm">
                Aceptó recibir estos avisos por WhatsApp
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Obligatorio para activarlo. Le vamos a escribir primero, y sin permiso Meta puede
                  bajar la calidad de tu número.
                </span>
              </span>
            </label>

            {draft.optIn && (
              <Field label="¿Cómo lo aceptó?" hint="Para poder responder si algún día lo preguntan.">
                <Input
                  value={draft.optInNote}
                  placeholder="Firmó el acuerdo de proveedores el 3/8"
                  onChange={(e) => setDraft({ ...draft, optInNote: e.target.value })}
                />
              </Field>
            )}

            <label className="flex items-center gap-2.5">
              <input
                type="checkbox"
                className="size-4 shrink-0"
                checked={draft.active}
                onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
              />
              <span className="text-sm">Activo (recibe derivaciones)</span>
            </label>

            <Field label="Notas internas">
              <Textarea
                rows={2}
                value={draft.notes}
                placeholder="Zona, horarios, lo que sirva"
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              />
            </Field>
          </div>
        )}
      </ResponsiveDialog>
    </Card>
  );
}
