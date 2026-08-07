"use client";

// Los datos del negocio que usan los nodos de IA de las automatizaciones para
// armar su prompt. Viven en la cuenta, una sola vez: antes eran parte de la
// config de cada bot, así que tener dos bots obligaba a mantener dos copias del
// mismo catálogo y una siempre quedaba vieja.
//
// No confundir con el perfil de WhatsApp del número (foto, "about", rubro), que
// es lo que ve el cliente al tocar el chat y se edita en Números.

import { useEffect, useState } from "react";
import { Building2, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { SimpleSelect } from "@/components/ui/select";
import { LoadingState, Spinner } from "@/components/ui/spinner";
import { InlineNotice } from "@/components/shared/inline-notice";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import { useAuthStore } from "@/stores/auth.store";
import type { AccountBusinessProfile } from "@/types";

const VERTICALS = [
  { value: "generic", label: "Otro" },
  { value: "beauty", label: "Belleza y bienestar" },
  { value: "food", label: "Gastronomía" },
  { value: "retail", label: "Comercio y retail" },
];

const EMPTY: AccountBusinessProfile = {
  vertical: "generic",
  businessName: "",
  description: "",
  address: "",
  paymentMethods: "",
  catalog: [],
  faqs: [],
  extraNotes: "",
};

export function BusinessProfileCard() {
  const agent = useAuthStore((s) => s.agent);
  const [profile, setProfile] = useState<AccountBusinessProfile | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get<{ businessProfile: AccountBusinessProfile }>("/account/profile")
      .then((data) => setProfile({ ...EMPTY, ...data.businessProfile }))
      .catch(() => setProfile(EMPTY));
  }, []);

  if (agent?.role !== "admin") return null;

  const set = (patch: Partial<AccountBusinessProfile>) =>
    setProfile((prev) => (prev ? { ...prev, ...patch } : prev));

  const save = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      await api.patch("/account/profile", { businessProfile: profile });
      toast.success("Perfil del negocio guardado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="h-4 w-4" />
          Perfil del negocio
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <InlineNotice variant="info">
          Esto es lo que sabe tu asistente cuando contesta. Se carga una vez y lo usan todas las
          automatizaciones con IA.
        </InlineNotice>

        {!profile ? (
          <LoadingState className="py-6" />
        ) : (
          <>
            <Field label="Nombre del negocio">
              <Input
                value={profile.businessName}
                placeholder="Ej: Barbería Don Pedro"
                onChange={(e) => set({ businessName: e.target.value })}
              />
            </Field>

            <Field label="Rubro">
              <SimpleSelect
                value={profile.vertical}
                options={VERTICALS}
                onChange={(value) => set({ vertical: value as AccountBusinessProfile["vertical"] })}
              />
            </Field>

            <Field label="A qué se dedica">
              <Textarea
                rows={3}
                value={profile.description}
                placeholder="Contale al asistente qué vendés o qué servicio das"
                onChange={(e) => set({ description: e.target.value })}
              />
            </Field>

            <Field label="Dirección">
              <Input
                value={profile.address}
                placeholder="Av. Siempre Viva 123"
                onChange={(e) => set({ address: e.target.value })}
              />
            </Field>

            <Field label="Medios de pago">
              <Input
                value={profile.paymentMethods}
                placeholder="Efectivo, transferencia, tarjetas"
                onChange={(e) => set({ paymentMethods: e.target.value })}
              />
            </Field>

            <ListEditor
              label="Catálogo"
              hint="Lo que el asistente puede cotizar. Sin esto, no inventa precios: dice que consulta."
              items={profile.catalog}
              empty={{ name: "", price: "", description: "" }}
              onChange={(catalog) => set({ catalog })}
              fields={[
                { key: "name", placeholder: "Corte de pelo" },
                { key: "price", placeholder: "$8.000" },
                { key: "description", placeholder: "Incluye lavado" },
              ]}
            />

            <ListEditor
              label="Preguntas frecuentes"
              hint="Las respuestas que ya venís repitiendo todos los días."
              items={profile.faqs}
              empty={{ question: "", answer: "" }}
              onChange={(faqs) => set({ faqs })}
              fields={[
                { key: "question", placeholder: "¿Hacen envíos?" },
                { key: "answer", placeholder: "Sí, a todo el país en 3 a 5 días." },
              ]}
            />

            <Field label="Notas extra">
              <Textarea
                rows={3}
                value={profile.extraNotes}
                placeholder="Cualquier cosa que el asistente tenga que saber"
                onChange={(e) => set({ extraNotes: e.target.value })}
              />
            </Field>

            <Button onClick={() => void save()} disabled={saving}>
              {saving && <Spinner size="sm" />}
              Guardar
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** Editor de una lista de objetos planos (catálogo, FAQs). */
function ListEditor<T extends Record<string, string>>({
  label,
  hint,
  items,
  empty,
  fields,
  onChange,
}: {
  label: string;
  hint: string;
  items: T[];
  empty: T;
  fields: Array<{ key: keyof T & string; placeholder: string }>;
  onChange: (items: T[]) => void;
}) {
  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>

      {items.map((item, index) => (
        <div key={index} className="flex items-start gap-2 rounded-xl border p-2">
          <div className="min-w-0 flex-1 space-y-1.5">
            {fields.map((field) => (
              <Input
                key={field.key}
                value={item[field.key] ?? ""}
                placeholder={field.placeholder}
                onChange={(e) =>
                  onChange(items.map((it, i) => (i === index ? { ...it, [field.key]: e.target.value } : it)))
                }
              />
            ))}
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Quitar"
            onClick={() => onChange(items.filter((_, i) => i !== index))}
          >
            <Trash2 className="size-4 text-muted-foreground" />
          </Button>
        </div>
      ))}

      <Button variant="outline" size="sm" onClick={() => onChange([...items, { ...empty }])}>
        <Plus className="size-4" />
        Agregar
      </Button>
    </div>
  );
}
