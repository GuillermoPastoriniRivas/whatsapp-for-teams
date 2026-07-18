"use client";

import { useMemo, useState } from "react";
import { Loader2, Plus, Trash2, Variable } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SimpleSelect } from "@/components/ui/select";
import { InlineNotice } from "@/components/shared/inline-notice";
import { TemplatePreview } from "@/components/templates/template-preview";
import { useTemplateStore } from "@/stores/template.store";
import { useTranslations } from "@/lib/i18n/use-translations";
import { nextPositionalToken, validateConsecutivePlaceholders } from "@/lib/template-utils";
import { cn } from "@/lib/utils";
import type { MessageTemplate, PhoneNumber, TemplateButton, TemplateCategory, TemplateComponent } from "@/types";

const LANGUAGES = ["es", "es_AR", "es_MX", "en", "en_US", "pt_BR"];
const MAX_BUTTONS = 3;

interface EditorButton {
  type: "QUICK_REPLY" | "URL";
  text: string;
  url: string;
}

interface TemplateEditorPanelProps {
  template?: MessageTemplate;
  phoneNumbers: PhoneNumber[];
  onSaved: () => void;
  onCancel: () => void;
}

export function TemplateEditorPanel({ template, phoneNumbers, onSaved, onCancel }: TemplateEditorPanelProps) {
  const { t } = useTranslations();
  const { create, update } = useTemplateStore();
  const isEdit = !!template;

  const initial = useMemo(() => {
    const header = template?.components.find((c) => c.type === "HEADER");
    const body = template?.components.find((c) => c.type === "BODY");
    const footer = template?.components.find((c) => c.type === "FOOTER");
    const buttons = template?.components.find((c) => c.type === "BUTTONS")?.buttons ?? [];
    return {
      header: header?.text ?? "",
      hasHeader: !!header?.text,
      body: body?.text ?? "",
      footer: footer?.text ?? "",
      hasFooter: !!footer?.text,
      buttons: buttons
        .filter((b): b is TemplateButton & { type: "QUICK_REPLY" | "URL" } => b.type === "QUICK_REPLY" || b.type === "URL")
        .map((b) => ({ type: b.type, text: b.text, url: b.url ?? "" })),
    };
  }, [template]);

  const [name, setName] = useState(template?.name ?? "");
  const [language, setLanguage] = useState(template?.language ?? "es_AR");
  const [category, setCategory] = useState<TemplateCategory>(template?.category ?? "marketing");
  const [phoneNumberId, setPhoneNumberId] = useState(template?.phoneNumberId ?? phoneNumbers[0]?.id ?? "");
  const [hasHeader, setHasHeader] = useState(initial.hasHeader);
  const [header, setHeader] = useState(initial.header);
  const [body, setBody] = useState(initial.body);
  const [hasFooter, setHasFooter] = useState(initial.hasFooter);
  const [footer, setFooter] = useState(initial.footer);
  const [buttons, setButtons] = useState<EditorButton[]>(initial.buttons);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const components = useMemo<TemplateComponent[]>(() => {
    const result: TemplateComponent[] = [];
    if (hasHeader && header.trim()) result.push({ type: "HEADER", format: "TEXT", text: header });
    result.push({ type: "BODY", text: body });
    if (hasFooter && footer.trim()) result.push({ type: "FOOTER", text: footer });
    if (buttons.length > 0) {
      result.push({
        type: "BUTTONS",
        buttons: buttons.map((b) =>
          b.type === "URL" ? { type: "URL" as const, text: b.text, url: b.url } : { type: "QUICK_REPLY" as const, text: b.text }
        ),
      });
    }
    return result;
  }, [hasHeader, header, body, hasFooter, footer, buttons]);

  const validation = useMemo(() => {
    const errors: string[] = [];
    if (!isEdit && !/^[a-z0-9_]+$/.test(name)) errors.push(t.templates.nameInvalid);
    if (!body.trim()) errors.push(t.templates.bodyRequired);
    if (validateConsecutivePlaceholders(body) || (hasHeader && validateConsecutivePlaceholders(header))) {
      errors.push(t.templates.placeholderGap);
    }
    if (buttons.some((b) => !b.text.trim())) errors.push(t.templates.buttonTextRequired);
    if (buttons.some((b) => b.type === "URL" && !/^https?:\/\/.+/.test(b.url))) errors.push(t.templates.buttonUrlInvalid);
    return errors;
  }, [isEdit, name, body, hasHeader, header, buttons, t]);

  const canSave = validation.length === 0 && (isEdit || (name.trim() && phoneNumberId));

  const handleSubmit = async () => {
    setSaving(true);
    setError("");
    try {
      if (isEdit) {
        await update(template.id, { category, components });
      } else {
        await create({ phoneNumberId, name, language, category, components });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
      setSaving(false);
    }
  };

  const insertVariable = () => setBody((prev) => prev + nextPositionalToken(prev));

  const categoryOptions: { value: TemplateCategory; label: string }[] = [
    { value: "marketing", label: t.templates.categoryMarketing },
    { value: "utility", label: t.templates.categoryUtility },
    { value: "authentication", label: t.templates.categoryAuthentication },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-4 py-3">
        <h2 className="font-semibold">{isEdit ? t.templates.editTitle : t.templates.createTitle}</h2>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {isEdit && <InlineNotice variant="info">{t.templates.editWarning}</InlineNotice>}

        {/* Live preview */}
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t.templates.preview}</p>
          <TemplatePreview components={components} />
          <p className="mt-1 text-[11px] text-muted-foreground">{t.templates.previewHint}</p>
        </div>

        {/* Name */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">{t.templates.name}</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
            placeholder="promo_verano"
            disabled={isEdit}
          />
          {!isEdit && <p className="text-[11px] text-muted-foreground">{t.templates.nameHint}</p>}
        </div>

        {/* Phone number + language */}
        {!isEdit && (
          <div className="grid grid-cols-2 gap-3">
            {phoneNumbers.length > 1 && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t.templates.phoneNumber}</label>
                <SimpleSelect
                  value={phoneNumberId}
                  onChange={setPhoneNumberId}
                  options={phoneNumbers.map((p) => ({ value: p.id, label: p.label || p.displayPhone }))}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t.templates.language}</label>
              <SimpleSelect
                value={language}
                onChange={setLanguage}
                options={LANGUAGES.map((l) => ({ value: l, label: l }))}
              />
            </div>
          </div>
        )}

        {/* Category */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">{t.templates.category}</label>
          <div className="grid grid-cols-3 gap-2">
            {categoryOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setCategory(option.value)}
                className={cn(
                  "rounded-lg border px-2 py-2 text-xs font-medium transition-colors",
                  category === option.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Header */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} className="accent-primary" />
            {t.templates.header}
          </label>
          {hasHeader && <Input value={header} onChange={(e) => setHeader(e.target.value)} maxLength={60} />}
        </div>

        {/* Body */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">{t.templates.body}</label>
            <Button type="button" variant="ghost" size="sm" onClick={insertVariable} className="h-7 gap-1 text-xs">
              <Variable className="size-3.5" />
              {t.templates.insertVariable}
            </Button>
          </div>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} maxLength={1024} />
        </div>

        {/* Footer */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={hasFooter} onChange={(e) => setHasFooter(e.target.checked)} className="accent-primary" />
            {t.templates.footer}
          </label>
          {hasFooter && <Input value={footer} onChange={(e) => setFooter(e.target.value)} maxLength={60} />}
        </div>

        {/* Buttons */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">{t.templates.buttons}</label>
            {buttons.length < MAX_BUTTONS && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={() => setButtons((prev) => [...prev, { type: "QUICK_REPLY", text: "", url: "" }])}
              >
                <Plus className="size-3.5" />
                {t.templates.addButton}
              </Button>
            )}
          </div>
          {buttons.map((button, i) => (
            <div key={i} className="space-y-2 rounded-lg border p-2">
              <div className="flex items-center gap-2">
                <SimpleSelect
                  className="h-8 flex-1"
                  value={button.type}
                  onChange={(value) =>
                    setButtons((prev) => prev.map((b, j) => (j === i ? { ...b, type: value as EditorButton["type"] } : b)))
                  }
                  options={[
                    { value: "QUICK_REPLY", label: t.templates.buttonQuickReply },
                    { value: "URL", label: t.templates.buttonUrl },
                  ]}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground"
                  onClick={() => setButtons((prev) => prev.filter((_, j) => j !== i))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <Input
                value={button.text}
                onChange={(e) => setButtons((prev) => prev.map((b, j) => (j === i ? { ...b, text: e.target.value } : b)))}
                placeholder={t.templates.buttonText}
                maxLength={25}
              />
              {button.type === "URL" && (
                <Input
                  value={button.url}
                  onChange={(e) => setButtons((prev) => prev.map((b, j) => (j === i ? { ...b, url: e.target.value } : b)))}
                  placeholder={t.templates.buttonUrlValue}
                />
              )}
            </div>
          ))}
        </div>

        {validation.length > 0 && (body.length > 0 || name.length > 0) && (
          <ul className="space-y-1">
            {validation.map((msg) => (
              <li key={msg} className="text-xs text-destructive">
                {msg}
              </li>
            ))}
          </ul>
        )}
        {error && <InlineNotice variant="error">{error}</InlineNotice>}
      </div>

      <div className="flex gap-2 border-t p-4">
        <Button variant="outline" className="flex-1" onClick={onCancel} disabled={saving}>
          {t.templates.cancel}
        </Button>
        <Button className="flex-1" onClick={handleSubmit} disabled={!canSave || saving}>
          {saving ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {isEdit ? t.templates.saving : t.templates.creating}
            </>
          ) : isEdit ? (
            t.templates.save
          ) : (
            t.templates.create
          )}
        </Button>
      </div>
    </div>
  );
}
