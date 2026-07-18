"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useTranslations } from "@/lib/i18n/use-translations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ChevronRight, Loader2 } from "lucide-react";
import type { Conversation, MessageTemplate, PaginatedResponse, TemplateComponent } from "@/types";

const PLACEHOLDER_REGEX = /\{\{([a-z0-9_]+)\}\}/gi;

interface Placeholder {
  /** Clave canónica que espera el backend: body.1, header.link, button.0.1 */
  key: string;
  label: string;
  isLink: boolean;
}

// Espeja listTemplatePlaceholders del backend (template-variable.resolver.ts)
function listPlaceholders(components: TemplateComponent[]): Placeholder[] {
  const found: Placeholder[] = [];
  const extract = (text: string) =>
    [...text.matchAll(PLACEHOLDER_REGEX)].map((m) => m[1]);

  for (const c of components) {
    if (c.type === "BODY" && c.text) {
      for (const pos of extract(c.text)) {
        found.push({ key: `body.${pos}`, label: `{{${pos}}}`, isLink: false });
      }
    } else if (c.type === "HEADER") {
      if (c.format === "TEXT" && c.text) {
        for (const pos of extract(c.text)) {
          found.push({ key: `header.${pos}`, label: `Header {{${pos}}}`, isLink: false });
        }
      } else if (c.format && c.format !== "TEXT") {
        found.push({ key: "header.link", label: c.format, isLink: true });
      }
    } else if (c.type === "BUTTONS") {
      (c.buttons ?? []).forEach((b, i) => {
        if (b.type === "URL" && b.url) {
          for (const pos of extract(b.url)) {
            found.push({ key: `button.${i}.${pos}`, label: `${b.text} {{${pos}}}`, isLink: false });
          }
        } else if (b.type === "COPY_CODE") {
          found.push({ key: `button.${i}.code`, label: b.text, isLink: false });
        }
      });
    }
  }
  // sin duplicados (el mismo placeholder puede repetirse en el texto)
  return found.filter((p, i) => found.findIndex((q) => q.key === p.key) === i);
}

function templateBody(template: MessageTemplate): string {
  return template.components.find((c) => c.type === "BODY")?.text ?? "";
}

function renderPreview(template: MessageTemplate, variables: Record<string, string>): string {
  return templateBody(template).replace(
    PLACEHOLDER_REGEX,
    (match, pos) => variables[`body.${pos}`] || match,
  );
}

interface Props {
  conversation: Conversation;
  open: boolean;
  onClose: () => void;
}

export function SendTemplateDialog({ conversation, open, onClose }: Props) {
  const { t } = useTranslations();
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<MessageTemplate | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelected(null);
    setVariables({});
    setError(null);
    setLoading(true);
    const params = new URLSearchParams({
      status: "approved",
      phoneNumberId: conversation.phoneNumberId,
      limit: "50",
    });
    api
      .get<PaginatedResponse<MessageTemplate>>(`/templates?${params}`)
      .then((res) => setTemplates(res.data))
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false));
  }, [open, conversation.phoneNumberId]);

  const placeholders = useMemo(
    () => (selected ? listPlaceholders(selected.components) : []),
    [selected],
  );
  const allFilled = placeholders.every((p) => (variables[p.key] ?? "").trim() !== "");

  const handleSend = async () => {
    if (!selected || sending) return;
    setSending(true);
    setError(null);
    try {
      await api.post(`/conversations/${conversation.id}/send-template`, {
        templateId: selected.id,
        variables,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.chat.templateError);
    } finally {
      setSending(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="bottom"
        className="max-h-[85dvh] overflow-y-auto rounded-t-2xl pb-[calc(1rem+env(safe-area-inset-bottom))] sm:mx-auto sm:max-w-lg"
      >
        <SheetHeader>
          <SheetTitle>{t.chat.templateDialogTitle}</SheetTitle>
          <SheetDescription>{t.chat.templateDialogSubtitle}</SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-2 space-y-3">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : templates.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              <p>{t.chat.templateNone}</p>
              <p className="mt-1 text-xs">{t.chat.templateNoneHint}</p>
            </div>
          ) : !selected ? (
            <ul className="divide-y rounded-lg border">
              {templates.map((tpl) => (
                <li key={tpl.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(tpl)}
                    className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-muted/50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{tpl.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                        {templateBody(tpl)}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium truncate">{selected.name}</p>
                <Button variant="ghost" size="sm" onClick={() => { setSelected(null); setVariables({}); setError(null); }}>
                  {t.chat.templateChangeSelection}
                </Button>
              </div>

              {placeholders.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    {t.chat.templateVariables}
                  </p>
                  {placeholders.map((p) => (
                    <div key={p.key} className="flex items-center gap-2">
                      <span className="w-28 shrink-0 text-xs text-muted-foreground truncate">
                        {p.isLink ? `${p.label} — ${t.chat.templateVariableLink}` : p.label}
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
                  {t.chat.templatePreview}
                </p>
                <div className="rounded-lg border bg-[var(--asis-bubble-outbound)] dark:bg-secondary px-3 py-2 text-sm whitespace-pre-wrap">
                  {renderPreview(selected, variables)}
                </div>
              </div>

              {error && <p className="text-xs text-destructive">{error}</p>}

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="ghost" onClick={onClose} disabled={sending}>
                  {t.common.cancel}
                </Button>
                <Button onClick={handleSend} disabled={sending || !allFilled}>
                  {sending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  {sending ? t.chat.templateSending : t.chat.templateSend}
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
