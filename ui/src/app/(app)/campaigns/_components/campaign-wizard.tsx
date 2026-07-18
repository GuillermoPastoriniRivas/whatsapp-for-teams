"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Loader2, Megaphone, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { SimpleSelect } from "@/components/ui/select";
import { InlineNotice } from "@/components/shared/inline-notice";
import { CsvImportPanel } from "@/components/contacts/csv-import-panel";
import { TemplatePreview } from "@/components/templates/template-preview";
import { ContactPicker } from "./contact-picker";
import { useCampaignStore } from "@/stores/campaign.store";
import { useTranslations } from "@/lib/i18n/use-translations";
import { api } from "@/lib/api";
import { extractPlaceholders, resolveMappingSample, variableKey } from "@/lib/template-utils";
import { extractPhones, parseCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";
import type {
  Campaign,
  Contact,
  MessageTemplate,
  PaginatedResponse,
  PhoneNumber,
  VariableMapping,
} from "@/types";

type AudienceMode = "pick" | "search" | "csv";
type MappingDraft = { source: "contact_field" | "static"; value: string; customField: boolean };

const CSV_MAX_ROWS = 2000;
const RESOLVE_CONCURRENCY = 10;

interface CampaignWizardProps {
  draft?: Campaign;
  onDone: (campaignId: string) => void;
  onCancel: () => void;
}

export function CampaignWizard({ draft, onDone, onCancel }: CampaignWizardProps) {
  const { t } = useTranslations();
  const { create, updateDraft, start } = useCampaignStore();

  const [step, setStep] = useState(1);
  const totalSteps = 4;

  // Step 1 — template
  const [name, setName] = useState(draft?.name ?? "");
  const [phones, setPhones] = useState<PhoneNumber[]>([]);
  const [phoneNumberId, setPhoneNumberId] = useState(draft?.phoneNumberId ?? "");
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templateFilter, setTemplateFilter] = useState("");
  const [template, setTemplate] = useState<MessageTemplate | null>(null);

  // Step 2 — audience
  const [audienceMode, setAudienceMode] = useState<AudienceMode>(
    draft?.audience.type === "filter" ? "search" : "pick"
  );
  const [selectedContacts, setSelectedContacts] = useState<Map<string, Contact>>(new Map());
  const [searchQuery, setSearchQuery] = useState(draft?.audience.search ?? "");
  const [reach, setReach] = useState<{ total: number; preview: Contact[] } | null>(null);
  const [reachLoading, setReachLoading] = useState(false);
  const [csvContacts, setCsvContacts] = useState<Contact[]>([]);
  const [csvNotFound, setCsvNotFound] = useState<string[]>([]);
  const [csvProgress, setCsvProgress] = useState<{ done: number; total: number } | null>(null);

  // Step 3 — variables
  const [mappings, setMappings] = useState<Record<string, MappingDraft>>({});
  const [previewIndex, setPreviewIndex] = useState(0);

  // Step 4 — schedule
  const [sendMode, setSendMode] = useState<"now" | "schedule">(draft?.scheduledAt ? "schedule" : "now");
  const [scheduledAt, setScheduledAt] = useState(
    draft?.scheduledAt ? draft.scheduledAt.slice(0, 16) : ""
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Load phone numbers once (only providers that support Meta templates)
  useEffect(() => {
    api
      .get<PhoneNumber[]>("/phone-numbers")
      .then((list) => {
        const capable = list.filter(
          (p) => ["meta", "kapso", "demo"].includes(p.provider) && p.status === "active"
        );
        setPhones(capable);
        if (!draft && capable.length > 0) setPhoneNumberId((prev) => prev || capable[0].id);
      })
      .catch(() => {});
  }, [draft]);

  // Load approved templates for the selected phone
  useEffect(() => {
    if (!phoneNumberId) return;
    setTemplatesLoading(true);
    const params = new URLSearchParams({ status: "approved", phoneNumberId, limit: "100" });
    api
      .get<PaginatedResponse<MessageTemplate>>(`/templates?${params}`)
      .then((res) => {
        setTemplates(res.data);
        if (draft && !template) {
          const draftTemplate = res.data.find((tpl) => tpl.id === draft.templateId);
          if (draftTemplate) setTemplate(draftTemplate);
        }
      })
      .catch(() => setTemplates([]))
      .finally(() => setTemplatesLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phoneNumberId]);

  // Preload draft audience contacts (contactIds mode)
  useEffect(() => {
    if (!draft || draft.audience.type !== "contactIds") return;
    const ids = draft.audience.contactIds ?? [];
    if (ids.length === 0) return;
    // Fetch first pages of contacts and keep the ones in the draft (best effort preload)
    api
      .get<PaginatedResponse<Contact>>(`/contacts?limit=100`)
      .then((res) => {
        const map = new Map<string, Contact>();
        for (const contact of res.data) {
          if (ids.includes(contact.id)) map.set(contact.id, contact);
        }
        setSelectedContacts(map);
      })
      .catch(() => {});
  }, [draft]);

  const placeholders = useMemo(
    () => (template ? extractPlaceholders(template.components) : []),
    [template]
  );

  // (Re)initialize mappings when the template changes
  useEffect(() => {
    if (!template) return;
    setMappings((prev) => {
      const next: Record<string, MappingDraft> = {};
      for (const ref of placeholders) {
        const key = variableKey(ref);
        const fromDraft = draft?.variableMappings.find(
          (m) => variableKey({ component: m.component, index: m.index, position: m.position }) === key
        );
        next[key] =
          prev[key] ??
          (fromDraft
            ? {
                source: fromDraft.source,
                value: fromDraft.value,
                customField: fromDraft.source === "contact_field" && fromDraft.value.startsWith("customFields."),
              }
            : { source: "contact_field", value: "name", customField: false });
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template?.id, placeholders.length]);

  // Sample contacts for the live preview in step 3
  const sampleContacts = useMemo(() => {
    if (audienceMode === "pick") return [...selectedContacts.values()];
    if (audienceMode === "csv") return csvContacts;
    return reach?.preview ?? [];
  }, [audienceMode, selectedContacts, csvContacts, reach]);

  const customFieldOptions = useMemo(() => {
    const keys = new Set<string>();
    for (const contact of sampleContacts.slice(0, 50)) {
      for (const key of Object.keys(contact.customFields ?? {})) keys.add(key);
    }
    return [...keys];
  }, [sampleContacts]);

  const checkReach = async () => {
    setReachLoading(true);
    setReach(null);
    try {
      const params = new URLSearchParams({ limit: "5", page: "1" });
      if (searchQuery) params.set("search", searchQuery);
      const res = await api.get<PaginatedResponse<Contact>>(`/contacts?${params}`);
      setReach({ total: res.meta.total, preview: res.data });
    } catch {
      setReach({ total: 0, preview: [] });
    } finally {
      setReachLoading(false);
    }
  };

  /** After a CSV import, resolve phone numbers → contact records in small concurrent batches. */
  const resolveCsvContacts = async (file: { phones: string[] }) => {
    const phonesToResolve = file.phones.slice(0, CSV_MAX_ROWS);
    setCsvProgress({ done: 0, total: phonesToResolve.length });
    setCsvContacts([]);
    setCsvNotFound([]);

    const found: Contact[] = [];
    const notFound: string[] = [];
    let done = 0;

    for (let i = 0; i < phonesToResolve.length; i += RESOLVE_CONCURRENCY) {
      const batch = phonesToResolve.slice(i, i + RESOLVE_CONCURRENCY);
      await Promise.all(
        batch.map(async (phone) => {
          try {
            const res = await api.get<PaginatedResponse<Contact>>(`/contacts?search=${phone}&limit=1`);
            const match = res.data.find((c) => c.waId === phone || c.phone === phone);
            if (match) found.push(match);
            else notFound.push(phone);
          } catch {
            notFound.push(phone);
          } finally {
            done++;
          }
        })
      );
      setCsvProgress({ done, total: phonesToResolve.length });
    }

    setCsvContacts(found);
    setCsvNotFound(notFound);
    setCsvProgress(null);
  };

  const canNext = (): boolean => {
    switch (step) {
      case 1:
        return name.trim().length > 0 && !!template;
      case 2:
        if (audienceMode === "pick") return selectedContacts.size > 0;
        if (audienceMode === "search") return searchQuery.trim().length > 0 && (reach?.total ?? 0) > 0;
        return csvContacts.length > 0 && !csvProgress;
      case 3:
        return placeholders.every((ref) => {
          const mapping = mappings[variableKey(ref)];
          return mapping && mapping.value.trim().length > 0;
        });
      case 4:
        return sendMode === "now" || (!!scheduledAt && new Date(scheduledAt).getTime() > Date.now());
      default:
        return false;
    }
  };

  const buildPayload = () => {
    const variableMappings: VariableMapping[] = placeholders.map((ref) => {
      const mapping = mappings[variableKey(ref)];
      return {
        component: ref.component,
        ...(ref.component === "button" ? { index: ref.index } : {}),
        position: ref.position,
        source: mapping.source,
        value: mapping.value,
      };
    });

    const audience =
      audienceMode === "search"
        ? { type: "filter" as const, search: searchQuery }
        : {
            type: "contactIds" as const,
            contactIds:
              audienceMode === "pick" ? [...selectedContacts.keys()] : csvContacts.map((c) => c.id),
          };

    return {
      name,
      phoneNumberId,
      templateId: template!.id,
      variableMappings,
      audience,
      ...(sendMode === "schedule" && scheduledAt ? { scheduledAt: new Date(scheduledAt).toISOString() } : {}),
    };
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const payload = buildPayload();
      const campaign = draft ? await updateDraft(draft.id, payload) : await create(payload);
      await start(campaign.id);
      onDone(campaign.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
      setSubmitting(false);
    }
  };

  const previewValues = useMemo(() => {
    const contact = sampleContacts[previewIndex % Math.max(1, sampleContacts.length)];
    const values: Record<string, string> = {};
    const missing: string[] = [];
    for (const ref of placeholders) {
      const key = variableKey(ref);
      const mapping = mappings[key];
      if (!mapping) continue;
      const sample = contact
        ? resolveMappingSample(
            { component: ref.component, index: ref.index, position: ref.position, source: mapping.source, value: mapping.value },
            contact
          )
        : mapping.source === "static"
          ? mapping.value
          : undefined;
      if (sample) values[key] = sample;
      else missing.push(key);
    }
    return { contact, values, missing };
  }, [sampleContacts, previewIndex, placeholders, mappings]);

  const filteredTemplates = templates.filter((tpl) =>
    tpl.name.toLowerCase().includes(templateFilter.toLowerCase())
  );

  const stepTitles = [t.campaigns.stepTemplate, t.campaigns.stepAudience, t.campaigns.stepVariables, t.campaigns.stepConfirm];

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="px-4 pb-4 pt-6">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
            <Megaphone className="size-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold">{draft ? t.campaigns.edit : t.campaigns.newCampaign}</h2>
            <p className="text-xs text-muted-foreground">
              {t.campaigns.stepOf.replace("{current}", String(step))} · {stepTitles[step - 1]}
            </p>
          </div>
        </div>
        <div className="flex gap-1">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} className={cn("h-1 flex-1 rounded-full", i < step ? "bg-primary" : "bg-muted")} />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-4">
        {/* ── Step 1: template ── */}
        {step === 1 && (
          <>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t.campaigns.campaignName}</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.campaigns.campaignNamePlaceholder} />
            </div>

            {phones.length > 1 && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t.templates.phoneNumber}</label>
                <SimpleSelect
                  value={phoneNumberId}
                  onChange={(value) => {
                    setPhoneNumberId(value);
                    setTemplate(null);
                  }}
                  options={phones.map((p) => ({ value: p.id, label: p.label || p.displayPhone }))}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t.campaigns.selectTemplate}</label>
              {templates.length > 5 && (
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="h-8 pl-8 text-xs"
                    placeholder={t.campaigns.searchTemplates}
                    value={templateFilter}
                    onChange={(e) => setTemplateFilter(e.target.value)}
                  />
                </div>
              )}
              {templatesLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                </div>
              ) : filteredTemplates.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-center">
                  <p className="text-xs text-muted-foreground">{t.campaigns.noApprovedTemplates}</p>
                  <Link href="/templates" className="mt-1 inline-block text-xs font-medium text-primary hover:underline">
                    {t.campaigns.goToTemplates}
                  </Link>
                </div>
              ) : (
                <div className="max-h-72 space-y-2 overflow-y-auto">
                  {filteredTemplates.map((tpl) => {
                    const body = tpl.components.find((c) => c.type === "BODY")?.text ?? "";
                    const isSelected = template?.id === tpl.id;
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => setTemplate(tpl)}
                        className={cn(
                          "w-full rounded-lg border p-3 text-left transition-colors",
                          isSelected ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-medium">{tpl.name}</span>
                          <span className="text-[11px] text-muted-foreground">{tpl.language}</span>
                        </div>
                        <p className="mt-1 truncate text-[11px] text-muted-foreground">{body}</p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Step 2: audience ── */}
        {step === 2 && (
          <>
            <p className="text-sm font-medium">{t.campaigns.audienceMode}</p>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { mode: "pick", label: t.campaigns.audiencePick, hint: t.campaigns.audiencePickHint },
                  { mode: "search", label: t.campaigns.audienceSearch, hint: t.campaigns.audienceSearchHint },
                  { mode: "csv", label: t.campaigns.audienceCsv, hint: t.campaigns.audienceCsvHint },
                ] as const
              ).map(({ mode, label, hint }) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setAudienceMode(mode)}
                  className={cn(
                    "rounded-lg border p-2 text-left transition-colors",
                    audienceMode === mode ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                  )}
                >
                  <p className="text-xs font-medium">{label}</p>
                  <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">{hint}</p>
                </button>
              ))}
            </div>

            {audienceMode === "pick" && <ContactPicker selected={selectedContacts} onChange={setSelectedContacts} />}

            {audienceMode === "search" && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    className="h-9 flex-1"
                    placeholder={t.contacts.searchPlaceholder}
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setReach(null);
                    }}
                  />
                  <Button type="button" variant="outline" onClick={checkReach} disabled={reachLoading || !searchQuery.trim()}>
                    {reachLoading ? <Loader2 className="size-4 animate-spin" /> : t.campaigns.checkReach}
                  </Button>
                </div>
                {reach && (
                  <div className="space-y-1.5 rounded-lg border p-3">
                    <p className="text-sm font-medium">
                      ~{reach.total} {t.campaigns.reachResult}
                    </p>
                    {reach.preview.length > 0 && (
                      <>
                        <p className="text-[11px] text-muted-foreground">{t.campaigns.reachPreview}</p>
                        {reach.preview.map((contact) => (
                          <p key={contact.id} className="text-[11px] text-muted-foreground">
                            {contact.name} · +{contact.waId}
                          </p>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {audienceMode === "csv" && (
              <div className="space-y-3">
                <CsvImportPanel
                  embedded
                  onImported={async (_result, file) => {
                    // Contacts are now upserted server-side; resolve the file's
                    // phones back to contact records to build the audience.
                    const parsed = parseCsv(await file.text());
                    const phones = extractPhones(parsed);
                    if (phones.length > CSV_MAX_ROWS) alert(t.campaigns.csvTooBig);
                    await resolveCsvContacts({ phones });
                  }}
                />
                <CsvResolutionStatus progress={csvProgress} resolved={csvContacts.length} notFound={csvNotFound} />
              </div>
            )}
          </>
        )}

        {/* ── Step 3: variables ── */}
        {step === 3 && (
          <>
            {placeholders.length === 0 ? (
              <InlineNotice variant="info">{t.campaigns.noVariables}</InlineNotice>
            ) : (
              <>
                <p className="text-sm font-medium">{t.campaigns.variablesTitle}</p>
                {placeholders.map((ref) => {
                  const key = variableKey(ref);
                  const mapping = mappings[key];
                  if (!mapping) return null;
                  const label =
                    ref.component === "body"
                      ? `${t.templates.body} — {{${ref.position}}}`
                      : ref.component === "header"
                        ? `${t.templates.header} — ${ref.position === "link" ? "link" : `{{${ref.position}}}`}`
                        : `${t.templates.buttonUrl} — {{${ref.position}}}`;
                  return (
                    <div key={key} className="space-y-2 rounded-lg border p-3">
                      <div>
                        <p className="text-xs font-medium">{label}</p>
                        <p className="truncate text-[11px] text-muted-foreground">{ref.context}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-0.5">
                        {(
                          [
                            { source: "contact_field", label: t.campaigns.contactField },
                            { source: "static", label: t.campaigns.staticValue },
                          ] as const
                        ).map(({ source, label: sourceLabel }) => (
                          <button
                            key={source}
                            type="button"
                            onClick={() =>
                              setMappings((prev) => ({
                                ...prev,
                                [key]: {
                                  source,
                                  value: source === "contact_field" ? "name" : "",
                                  customField: false,
                                },
                              }))
                            }
                            className={cn(
                              "rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
                              mapping.source === source ? "bg-background shadow-sm" : "text-muted-foreground"
                            )}
                          >
                            {sourceLabel}
                          </button>
                        ))}
                      </div>
                      {mapping.source === "contact_field" ? (
                        <div className="space-y-1.5">
                          <SimpleSelect
                            className="h-8 text-xs"
                            value={mapping.customField ? "__custom__" : mapping.value}
                            onChange={(value) => {
                              if (value === "__custom__") {
                                setMappings((prev) => ({
                                  ...prev,
                                  [key]: { ...mapping, customField: true, value: "customFields." },
                                }));
                              } else {
                                setMappings((prev) => ({
                                  ...prev,
                                  [key]: { ...mapping, customField: false, value },
                                }));
                              }
                            }}
                            options={[
                              { value: "name", label: t.campaigns.fieldName },
                              { value: "phone", label: t.campaigns.fieldPhone },
                              { value: "email", label: t.campaigns.fieldEmail },
                              { value: "company", label: t.campaigns.fieldCompany },
                              ...customFieldOptions.map((field) => ({
                                value: `customFields.${field}`,
                                label: `${t.campaigns.fieldCustomPrefix}: ${field}`,
                              })),
                              { value: "__custom__", label: t.campaigns.fieldOther },
                            ]}
                          />
                          {mapping.customField && (
                            <Input
                              className="h-8 text-xs"
                              placeholder={t.campaigns.customFieldPlaceholder}
                              value={mapping.value.replace(/^customFields\./, "")}
                              onChange={(e) =>
                                setMappings((prev) => ({
                                  ...prev,
                                  [key]: { ...mapping, value: `customFields.${e.target.value.trim()}` },
                                }))
                              }
                            />
                          )}
                        </div>
                      ) : (
                        <Input
                          className="h-8 text-xs"
                          placeholder={t.campaigns.staticPlaceholder}
                          value={mapping.value}
                          onChange={(e) => setMappings((prev) => ({ ...prev, [key]: { ...mapping, value: e.target.value } }))}
                        />
                      )}
                    </div>
                  );
                })}
              </>
            )}

            {/* Live preview with a real contact */}
            {template && (
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">{t.templates.preview}</p>
                  {sampleContacts.length > 1 && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="rounded p-0.5 text-muted-foreground hover:bg-muted"
                        onClick={() => setPreviewIndex((i) => (i - 1 + sampleContacts.length) % sampleContacts.length)}
                      >
                        <ChevronLeft className="size-3.5" />
                      </button>
                      <span className="text-[11px] text-muted-foreground">
                        {t.campaigns.previewingContact} {previewValues.contact?.name ?? "—"}
                      </span>
                      <button
                        type="button"
                        className="rounded p-0.5 text-muted-foreground hover:bg-muted"
                        onClick={() => setPreviewIndex((i) => (i + 1) % sampleContacts.length)}
                      >
                        <ChevronRight className="size-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                <TemplatePreview components={template.components} values={previewValues.values} missingKeys={previewValues.missing} />
                {previewValues.missing.length > 0 && previewValues.contact && (
                  <p className="mt-1 text-[11px] text-destructive">
                    {previewValues.missing.length} {t.campaigns.missingValue}
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {/* ── Step 4: schedule + summary ── */}
        {step === 4 && (
          <>
            <p className="text-sm font-medium">{t.campaigns.schedule}</p>
            <div className="space-y-2">
              {(
                [
                  { mode: "now", label: t.campaigns.sendNow },
                  { mode: "schedule", label: t.campaigns.scheduleFor },
                ] as const
              ).map(({ mode, label }) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setSendMode(mode)}
                  className={cn(
                    "w-full rounded-lg border p-2.5 text-left text-xs font-medium transition-colors",
                    sendMode === mode ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                  )}
                >
                  {label}
                </button>
              ))}
              {sendMode === "schedule" && (
                <>
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  />
                  {scheduledAt && new Date(scheduledAt).getTime() <= Date.now() && (
                    <p className="text-[11px] text-destructive">{t.campaigns.scheduleInvalid}</p>
                  )}
                </>
              )}
            </div>

            {/* Summary */}
            <div className="space-y-2 rounded-lg border p-3 text-xs">
              <p className="font-semibold">{t.campaigns.summary}</p>
              <SummaryRow label={t.campaigns.name} value={name} />
              <SummaryRow label={t.campaigns.summaryTemplate} value={`${template?.name} (${template?.language})`} />
              <SummaryRow
                label={t.campaigns.summaryAudience}
                value={
                  audienceMode === "search"
                    ? `"${searchQuery}" · ~${reach?.total ?? "?"} ${t.campaigns.summaryContacts} (${t.campaigns.summaryBySearch})`
                    : `${audienceMode === "pick" ? selectedContacts.size : csvContacts.length} ${t.campaigns.summaryContacts}`
                }
              />
              {placeholders.length > 0 && (
                <div>
                  <p className="text-muted-foreground">{t.campaigns.summaryVariables}</p>
                  {placeholders.map((ref) => {
                    const key = variableKey(ref);
                    const mapping = mappings[key];
                    return (
                      <p key={key} className="font-mono text-[11px]">
                        {key} → {mapping?.source === "static" ? `"${mapping.value}"` : mapping?.value}
                      </p>
                    );
                  })}
                </div>
              )}
              <SummaryRow
                label={t.campaigns.summarySchedule}
                value={sendMode === "now" ? t.campaigns.summaryNow : new Date(scheduledAt).toLocaleString()}
              />
            </div>

            {error && <InlineNotice variant="error">{error}</InlineNotice>}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="flex gap-2 border-t p-4">
        {step > 1 ? (
          <Button variant="outline" className="flex-1" onClick={() => setStep((s) => s - 1)} disabled={submitting}>
            {t.campaigns.back}
          </Button>
        ) : (
          <Button variant="outline" className="flex-1" onClick={onCancel} disabled={submitting}>
            {t.templates.cancel}
          </Button>
        )}
        {step < totalSteps ? (
          <Button className="flex-1" onClick={() => setStep((s) => s + 1)} disabled={!canNext()}>
            {t.campaigns.next}
          </Button>
        ) : (
          <Button className="flex-1" onClick={handleSubmit} disabled={!canNext() || submitting}>
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {t.campaigns.creating}
              </>
            ) : sendMode === "now" ? (
              t.campaigns.createAndSend
            ) : (
              t.campaigns.createCampaign
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function CsvResolutionStatus({
  progress,
  resolved,
  notFound,
}: {
  progress: { done: number; total: number } | null;
  resolved: number;
  notFound: string[];
}) {
  const { t } = useTranslations();

  return (
    <div className="space-y-2">
      {progress && (
        <div className="space-y-1">
          <Progress value={(progress.done / Math.max(1, progress.total)) * 100} className="h-1.5" />
          <p className="text-[11px] text-muted-foreground">
            {t.campaigns.verifyingContacts} {progress.done}/{progress.total}
          </p>
        </div>
      )}

      {!progress && resolved > 0 && (
        <p className="text-xs font-medium">
          {resolved} {t.campaigns.reachResult}
        </p>
      )}

      {!progress && notFound.length > 0 && (
        <div className="max-h-24 overflow-y-auto rounded-lg border border-amber-200 bg-amber-50 p-2 dark:border-amber-900/50 dark:bg-amber-900/10">
          <p className="mb-1 text-[11px] font-medium text-amber-700 dark:text-amber-400">{t.campaigns.phonesNotFound}</p>
          <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80">{notFound.join(", ")}</p>
        </div>
      )}
    </div>
  );
}
