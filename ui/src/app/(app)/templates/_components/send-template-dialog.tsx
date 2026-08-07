"use client";

// Envío suelto de una plantilla: se elige una aprobada, se escribe un número
// cualquiera y se manda. No hace falta que exista la conversación — el backend
// crea contacto y chat si no están. Es la única forma de escribirle primero a
// alguien: fuera de la ventana de 24 hs WhatsApp solo deja plantillas.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import { useTranslations } from "@/lib/i18n/use-translations";
import { listPlaceholders, renderPreview, templateBody } from "@/lib/template-placeholders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { SimpleSelect } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { InlineNotice } from "@/components/shared/inline-notice";
import type { MessageTemplate, PaginatedResponse, PhoneNumber } from "@/types";

interface SendResult {
  conversationId: string;
  conversationCreated: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  phones: PhoneNumber[];
  /** Plantilla ya elegida desde la fila; si no viene, se elige acá. */
  template?: MessageTemplate;
}

export function SendTemplateDialog({ open, onClose, phones, template }: Props) {
  const { t } = useTranslations();
  const router = useRouter();

  const [approved, setApproved] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<MessageTemplate | null>(null);
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [to, setTo] = useState("");
  const [contactName, setContactName] = useState("");
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<SendResult | null>(null);

  const activePhones = useMemo(() => phones.filter((p) => p.status === "active"), [phones]);

  useEffect(() => {
    if (!open) return;
    setSelected(template ?? null);
    setVariables({});
    setTo("");
    setContactName("");
    setError(null);
    setSent(null);
    setPhoneNumberId(activePhones[0]?.id ?? "");

    // Solo con una plantilla ya elegida no hace falta el listado.
    if (template) return;
    setLoading(true);
    api
      .get<PaginatedResponse<MessageTemplate>>("/templates?status=approved&limit=100")
      .then((res) => setApproved(res.data))
      .catch(() => setApproved([]))
      .finally(() => setLoading(false));
  }, [open, template, activePhones]);

  const placeholders = useMemo(
    () => (selected ? listPlaceholders(selected.components) : []),
    [selected],
  );
  const allFilled = placeholders.every((p) => (variables[p.key] ?? "").trim() !== "");
  const canSend = !!selected && to.trim().length >= 6 && allFilled && !!phoneNumberId;

  const handleSend = async () => {
    if (!selected || !canSend || sending) return;
    setSending(true);
    setError(null);
    try {
      const result = await api.post<SendResult>(`/templates/${selected.id}/send`, {
        to: to.trim(),
        phoneNumberId,
        contactName: contactName.trim() || undefined,
        variables,
      });
      setSent(result);
      toast.success(t.templates.sendSuccess);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.templates.sendError);
    } finally {
      setSending(false);
    }
  };

  const footer = sent ? (
    <>
      <Button variant="ghost" onClick={onClose}>
        {t.templates.sendClose}
      </Button>
      <Button onClick={() => router.push(`/conversations/${sent.conversationId}`)}>
        {t.templates.sendOpenChat}
      </Button>
    </>
  ) : (
    <>
      <Button variant="ghost" onClick={onClose} disabled={sending}>
        {t.common.cancel}
      </Button>
      <Button onClick={handleSend} disabled={!canSend || sending}>
        {sending && <Spinner size="sm" className="mr-1.5" />}
        {sending ? t.templates.sending : t.templates.send}
      </Button>
    </>
  );

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={t.templates.sendTitle}
      description={t.templates.sendSubtitle}
      footer={selected ? footer : undefined}
    >
      {sent ? (
        <InlineNotice variant="success">
          {sent.conversationCreated ? t.templates.sendCreatedChat : t.templates.sendSuccess}
        </InlineNotice>
      ) : loading ? (
        <div className="flex justify-center py-8">
          <Spinner className="text-muted-foreground" />
        </div>
      ) : !selected ? (
        approved.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t.templates.sendNoApproved}
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {approved.map((tpl) => (
              <li key={tpl.id}>
                <button
                  type="button"
                  onClick={() => setSelected(tpl)}
                  className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-xs font-medium">{tpl.name}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {templateBody(tpl)}
                    </p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        )
      ) : (
        <div className="space-y-4">
          {activePhones.length === 0 && (
            <InlineNotice variant="warning">{t.templates.sendNoActivePhone}</InlineNotice>
          )}

          {!template && (
            <div className="flex items-center justify-between gap-2">
              <p className="truncate font-mono text-xs font-medium">{selected.name}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelected(null);
                  setVariables({});
                  setError(null);
                }}
              >
                {t.templates.sendChangeTemplate}
              </Button>
            </div>
          )}

          <Field label={t.templates.sendTo} hint={t.templates.sendToHint} required>
            <Input
              type="tel"
              inputMode="tel"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="+54 9 11 2233 4455"
              autoComplete="off"
            />
          </Field>

          <Field label={t.templates.sendContactName} hint={t.templates.sendContactNameHint}>
            <Input
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder={t.templates.sendContactNamePlaceholder}
            />
          </Field>

          {activePhones.length > 1 && (
            <Field label={t.templates.sendFrom}>
              <SimpleSelect
                value={phoneNumberId}
                onChange={setPhoneNumberId}
                options={activePhones.map((p) => ({
                  value: p.id,
                  label: p.label || p.displayPhone,
                }))}
              />
            </Field>
          )}

          {placeholders.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                {t.templates.sendVariables}
              </p>
              {placeholders.map((p) => (
                <div key={p.key} className="flex items-center gap-2">
                  <span className="w-28 shrink-0 truncate text-xs text-muted-foreground">
                    {p.isLink ? `${p.label} — ${t.templates.sendVariableLink}` : p.label}
                  </span>
                  <Input
                    value={variables[p.key] ?? ""}
                    onChange={(e) =>
                      setVariables((prev) => ({ ...prev, [p.key]: e.target.value }))
                    }
                    placeholder={p.isLink ? "https://..." : ""}
                    className="h-9 text-base sm:text-sm"
                  />
                </div>
              ))}
            </div>
          )}

          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              {t.templates.sendPreview}
            </p>
            <div className="rounded-lg border bg-[var(--asis-bubble-outbound)] px-3 py-2 text-sm whitespace-pre-wrap dark:bg-secondary">
              {renderPreview(selected, variables)}
            </div>
          </div>

          {error && <InlineNotice variant="error">{error}</InlineNotice>}
        </div>
      )}
    </ResponsiveDialog>
  );
}
