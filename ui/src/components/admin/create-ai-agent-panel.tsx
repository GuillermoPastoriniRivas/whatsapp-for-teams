"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import type { BusinessVertical, CatalogItem, FaqEntry } from "@/types";
import { Bot, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";

interface Props {
  onCreated: () => void;
  onCancel: () => void;
}

const verticals: { value: BusinessVertical; label: string; description: string; catalogLabel: string; catalogNamePlaceholder: string }[] = [
  { value: "beauty", label: "Estética y belleza", description: "Barbería, peluquería, spa, estética", catalogLabel: "Servicios y precios", catalogNamePlaceholder: "Corte de pelo" },
  { value: "food", label: "Gastronomía", description: "Restaurante, delivery, cafetería", catalogLabel: "Menú y precios", catalogNamePlaceholder: "Hamburguesa doble" },
  { value: "retail", label: "Tienda", description: "Ropa, productos, retail", catalogLabel: "Productos y precios", catalogNamePlaceholder: "Remera básica" },
  { value: "generic", label: "Otro negocio", description: "Servicios, software, lo que sea", catalogLabel: "Productos / servicios y precios", catalogNamePlaceholder: "Plan mensual" },
];

const languages = [
  { value: "es", label: "Español" },
  { value: "en", label: "English" },
  { value: "pt", label: "Português" },
];

const goalTemplates = [
  { label: "Agendar turnos", text: "Cuando alguien quiera un turno, preguntá qué servicio busca y qué día y horario prefiere. Después avisale que el equipo confirma la disponibilidad." },
  { label: "Tomar pedidos", text: "Ayudá a los clientes a armar su pedido: qué quieren, si es delivery o retiro, dirección y medio de pago. Al final repetí el pedido completo para confirmar." },
  { label: "Calificar clientes", text: "Si alguien muestra interés en comprar, preguntá su nombre, qué necesita y para cuándo lo necesita." },
];

export function CreateAiAgentPanel({ onCreated, onCancel }: Props) {
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [vertical, setVertical] = useState<BusinessVertical>("beauty");
  const [businessName, setBusinessName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [paymentMethods, setPaymentMethods] = useState("");
  const [catalog, setCatalog] = useState<CatalogItem[]>([{ name: "", price: "", description: "" }]);
  const [faqs, setFaqs] = useState<FaqEntry[]>([{ question: "", answer: "" }]);
  const [language, setLanguage] = useState("es");
  const [formality, setFormality] = useState<"informal" | "formal">("informal");
  const [useEmojis, setUseEmojis] = useState(true);
  const [goal, setGoal] = useState("");

  const totalSteps = 5;
  const selectedVertical = verticals.find((v) => v.value === vertical)!;

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);

    try {
      await api.post("/ai-agents", {
        name,
        businessProfile: {
          vertical,
          businessName,
          description,
          address,
          paymentMethods,
          catalog: catalog.filter((c) => c.name.trim().length > 0),
          faqs: faqs.filter((f) => f.question.trim().length > 0 && f.answer.trim().length > 0),
          extraNotes: "",
        },
        behavior: {
          language,
          formality,
          useEmojis,
          goal,
          customInstructions: "",
        },
        handoffRules: { onCustomerRequest: true, maxConsecutiveFailures: 3 },
      });
      onCreated();
    } catch (err: any) {
      setError(err.message || "No se pudo crear el asistente");
    } finally {
      setLoading(false);
    }
  };

  const canNext = () => {
    switch (step) {
      case 1: return name.trim().length > 0;
      case 2: return businessName.trim().length > 0;
      case 3: return true;
      case 4: return true;
      case 5: return true;
      default: return false;
    }
  };

  const updateCatalogItem = (i: number, patch: Partial<CatalogItem>) => {
    setCatalog((prev) => prev.map((item, idx) => (idx === i ? { ...item, ...patch } : item)));
  };

  const updateFaq = (i: number, patch: Partial<FaqEntry>) => {
    setFaqs((prev) => prev.map((item, idx) => (idx === i ? { ...item, ...patch } : item)));
  };

  return (
    <>
      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/30">
            <Bot className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Nuevo asistente</h2>
            <p className="text-xs text-muted-foreground">Paso {step} de {totalSteps}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="flex gap-1">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full ${i < step ? "bg-violet-500" : "bg-muted"}`}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pb-4 space-y-4">
        {step === 1 && (
          <>
            <h3 className="font-medium text-sm">¿Qué tipo de negocio tenés?</h3>
            <div className="grid grid-cols-1 gap-2">
              {verticals.map((v) => (
                <button
                  key={v.value}
                  type="button"
                  onClick={() => setVertical(v.value)}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    vertical === v.value
                      ? "border-violet-500 bg-violet-50 dark:bg-violet-900/20"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <span className="text-sm font-medium">{v.label}</span>
                  <p className="text-xs text-muted-foreground">{v.description}</p>
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Nombre del asistente</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder='Ej: "Sofi", "Asistente de Lo de Marcos"'
              />
              <p className="text-xs text-muted-foreground">
                Así lo vas a identificar dentro de asis.chat.
              </p>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h3 className="font-medium text-sm">Datos del negocio</h3>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Nombre del negocio</label>
              <Input
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder='Ej: "Barbería Don Pedro"'
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">¿Qué hace tu negocio? (una frase)</label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder='Ej: "Barbería clásica con cortes y afeitado"'
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Dirección (opcional)</label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder='Ej: "Av. Italia 1234, Montevideo"'
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Medios de pago (opcional)</label>
              <Input
                value={paymentMethods}
                onChange={(e) => setPaymentMethods(e.target.value)}
                placeholder='Ej: "Efectivo, débito, Mercado Pago"'
              />
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h3 className="font-medium text-sm">{selectedVertical.catalogLabel}</h3>
            <p className="text-sm text-muted-foreground">
              El asistente solo va a informar lo que cargues acá. Podés dejarlo vacío y completarlo después.
            </p>
            <div className="space-y-2">
              {catalog.map((item, i) => (
                <div key={i} className="rounded-lg border p-2 space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={item.name}
                      onChange={(e) => updateCatalogItem(i, { name: e.target.value })}
                      placeholder={selectedVertical.catalogNamePlaceholder}
                      className="flex-1"
                    />
                    <Input
                      value={item.price}
                      onChange={(e) => updateCatalogItem(i, { price: e.target.value })}
                      placeholder="$500"
                      className="w-28"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setCatalog((prev) => prev.filter((_, idx) => idx !== i))}
                      disabled={catalog.length === 1}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                  <Input
                    value={item.description}
                    onChange={(e) => updateCatalogItem(i, { description: e.target.value })}
                    placeholder="Detalle opcional (duración, qué incluye...)"
                  />
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCatalog((prev) => [...prev, { name: "", price: "", description: "" }])}
              className="gap-1"
            >
              <Plus className="h-4 w-4" />
              Agregar otro
            </Button>
          </>
        )}

        {step === 4 && (
          <>
            <h3 className="font-medium text-sm">Preguntas frecuentes</h3>
            <p className="text-sm text-muted-foreground">
              ¿Qué te preguntan siempre por WhatsApp? Cargá la pregunta y cómo querés que la responda.
            </p>
            <div className="space-y-2">
              {faqs.map((faq, i) => (
                <div key={i} className="rounded-lg border p-2 space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={faq.question}
                      onChange={(e) => updateFaq(i, { question: e.target.value })}
                      placeholder='Ej: "¿Hacen envíos?"'
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setFaqs((prev) => prev.filter((_, idx) => idx !== i))}
                      disabled={faqs.length === 1}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                  <Textarea
                    value={faq.answer}
                    onChange={(e) => updateFaq(i, { answer: e.target.value })}
                    placeholder='Ej: "Sí, hacemos envíos a todo el país por DAC."'
                    rows={2}
                  />
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setFaqs((prev) => [...prev, { question: "", answer: "" }])}
              className="gap-1"
            >
              <Plus className="h-4 w-4" />
              Agregar otra
            </Button>
          </>
        )}

        {step === 5 && (
          <>
            <h3 className="font-medium text-sm">¿Cómo tiene que responder?</h3>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Idioma</label>
              <div className="flex flex-wrap gap-2">
                {languages.map((l) => (
                  <button
                    key={l.value}
                    type="button"
                    onClick={() => setLanguage(l.value)}
                    className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                      language === l.value
                        ? "border-violet-500 bg-violet-50 dark:bg-violet-900/20"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Trato</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "informal" as const, label: "Cercano (vos / tú)" },
                  { value: "formal" as const, label: "Formal (usted)" },
                ].map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setFormality(f.value)}
                    className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                      formality === f.value
                        ? "border-violet-500 bg-violet-50 dark:bg-violet-900/20"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Emojis</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: true, label: "Puede usar alguno" },
                  { value: false, label: "Sin emojis" },
                ].map((opt) => (
                  <button
                    key={String(opt.value)}
                    type="button"
                    onClick={() => setUseEmojis(opt.value)}
                    className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                      useEmojis === opt.value
                        ? "border-violet-500 bg-violet-50 dark:bg-violet-900/20"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">¿Qué querés que logre? (opcional)</label>
              <Textarea
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="Ej: que junte los datos del pedido y avise que lo confirmamos enseguida."
                rows={3}
              />
              <div className="flex flex-wrap gap-1.5">
                {goalTemplates.map((t) => (
                  <button
                    key={t.label}
                    type="button"
                    onClick={() => setGoal(t.text)}
                    className="rounded-md border px-2.5 py-1 text-xs hover:bg-muted/50 transition-colors"
                  >
                    + {t.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {error && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-2 pt-2">
          {step > 1 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setStep(step - 1)}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              Atrás
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCancel}
            >
              Cancelar
            </Button>
          )}
          <div className="flex-1" />
          {step < totalSteps ? (
            <Button
              type="button"
              size="sm"
              onClick={() => setStep(step + 1)}
              disabled={!canNext()}
              className="gap-1 bg-primary hover:bg-primary/90"
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={handleSubmit}
              disabled={loading}
              className="bg-primary hover:bg-primary/90"
            >
              {loading ? "Creando..." : "Crear asistente"}
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
