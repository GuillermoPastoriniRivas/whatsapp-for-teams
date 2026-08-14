"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Plus, Sparkles, Trash2 } from "lucide-react";

import { PageShell, PageContent } from "@/components/layout/page-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { InlineNotice } from "@/components/shared/inline-notice";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { api, ApiError } from "@/lib/api";
import { toast } from "@/lib/toast";
import { useAuthStore } from "@/stores/auth.store";
import { useTranslations } from "@/lib/i18n/use-translations";
import type { AccountBusinessProfile, BusinessVertical, KnowledgeDocument } from "@/types";

interface AccountProfileResponse {
  businessProfile: AccountBusinessProfile | null;
  timezone: string | null;
}

const EMPTY_PROFILE: AccountBusinessProfile = {
  vertical: "generic",
  businessName: "",
  description: "",
  address: "",
  paymentMethods: "",
  catalog: [],
  faqs: [],
  extraNotes: "",
  assistantInstructions: "",
};

export default function BusinessPage() {
  const agent = useAuthStore((s) => s.agent);
  const router = useRouter();
  const { t } = useTranslations();
  const confirm = useConfirm();

  const [profile, setProfile] = useState<AccountBusinessProfile>(EMPTY_PROFILE);
  const [starters, setStarters] = useState<Record<BusinessVertical, string> | null>(null);
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const copy = t.business;

  const loadDocuments = useCallback(async () => {
    setDocuments(await api.get<KnowledgeDocument[]>("/knowledge"));
  }, []);

  useEffect(() => {
    if (agent && agent.role !== "admin") router.push("/");
  }, [agent, router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [account, starterMap, docs] = await Promise.all([
          api.get<AccountProfileResponse>("/account/profile"),
          api.get<Record<BusinessVertical, string>>("/account/profile/instruction-starters"),
          api.get<KnowledgeDocument[]>("/knowledge"),
        ]);
        if (cancelled) return;
        setProfile({ ...EMPTY_PROFILE, ...(account.businessProfile ?? {}) });
        setStarters(starterMap);
        setDocuments(docs);
      } catch {
        if (!cancelled) toast.error(copy.loadFailed);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [copy.loadFailed]);

  const patch = (changes: Partial<AccountBusinessProfile>) =>
    setProfile((current) => ({ ...current, ...changes }));

  const save = async () => {
    setSaving(true);
    try {
      // El PATCH reemplaza el perfil entero: catálogo y preguntas frecuentes
      // viajan de vuelta tal cual vinieron para no borrarlos desde acá.
      await api.patch("/account/profile", { businessProfile: profile });
      toast.success(copy.saved);
    } catch {
      toast.error(copy.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  const useStarter = () => {
    const starter = starters?.[profile.vertical];
    if (!starter) return;
    patch({ assistantInstructions: starter });
    toast.info(copy.starterApplied);
  };

  const removeDocument = async (doc: KnowledgeDocument) => {
    const ok = await confirm({
      title: copy.deleteTitle,
      description: copy.deleteDescription.replace("{title}", doc.title),
      confirmLabel: copy.delete,
      destructive: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/knowledge/${doc.id}`);
      await loadDocuments();
      toast.success(copy.deleted);
    } catch {
      toast.error(copy.deleteFailed);
    }
  };

  if (agent?.role !== "admin") return null;

  return (
    <PageShell>
      <PageHeader
        title={copy.title}
        subtitle={copy.subtitle}
        actions={
          <Button size="sm" onClick={save} disabled={saving || loading}>
            {saving ? <Spinner className="size-4" /> : null}
            {copy.save}
          </Button>
        }
      />
      <PageContent width="narrow" className="space-y-4 md:space-y-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : (
          <>
            <Card className="space-y-4 p-4 md:p-6">
              <div>
                <h2 className="text-base font-semibold text-foreground">{copy.instructionsTitle}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{copy.instructionsHint}</p>
              </div>

              <Field label={copy.businessType}>
                <select
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm md:h-8"
                  value={profile.vertical}
                  onChange={(e) => patch({ vertical: e.target.value as BusinessVertical })}
                >
                  <option value="beauty">{copy.verticalBeauty}</option>
                  <option value="food">{copy.verticalFood}</option>
                  <option value="retail">{copy.verticalRetail}</option>
                  <option value="generic">{copy.verticalGeneric}</option>
                </select>
              </Field>

              <Field label={copy.instructionsLabel} hint={copy.instructionsFieldHint}>
                <Textarea
                  rows={12}
                  value={profile.assistantInstructions}
                  placeholder={copy.instructionsPlaceholder}
                  onChange={(e) => patch({ assistantInstructions: e.target.value })}
                />
              </Field>

              <Button variant="outline" size="sm" onClick={useStarter} disabled={!starters}>
                <Sparkles className="size-4" />
                {copy.useStarter}
              </Button>
            </Card>

            <Card className="space-y-4 p-4 md:p-6">
              <div>
                <h2 className="text-base font-semibold text-foreground">{copy.businessTitle}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{copy.businessHint}</p>
              </div>

              <Field label={copy.businessName}>
                <Input
                  value={profile.businessName}
                  onChange={(e) => patch({ businessName: e.target.value })}
                />
              </Field>

              <Field label={copy.description}>
                <Textarea
                  rows={2}
                  value={profile.description}
                  onChange={(e) => patch({ description: e.target.value })}
                />
              </Field>

              <Field label={copy.address}>
                <Input value={profile.address} onChange={(e) => patch({ address: e.target.value })} />
              </Field>

              <Field label={copy.paymentMethods}>
                <Input
                  value={profile.paymentMethods}
                  onChange={(e) => patch({ paymentMethods: e.target.value })}
                />
              </Field>

              <Field label={copy.extraNotes} hint={copy.extraNotesHint}>
                <Textarea
                  rows={3}
                  value={profile.extraNotes}
                  onChange={(e) => patch({ extraNotes: e.target.value })}
                />
              </Field>
            </Card>

            <Card className="space-y-4 p-4 md:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-foreground">{copy.knowledgeTitle}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{copy.knowledgeHint}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
                  <Plus className="size-4" />
                  {copy.addDocument}
                </Button>
              </div>

              {documents.length === 0 ? (
                <EmptyState
                  icon={BookOpen}
                  title={copy.knowledgeEmptyTitle}
                  description={copy.knowledgeEmptyDescription}
                />
              ) : (
                <ul className="divide-y divide-border">
                  {documents.map((doc) => (
                    <li key={doc.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{doc.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {copy.fragments.replace("{count}", String(doc.chunkCount))}
                          {doc.sourceRef ? ` · ${doc.sourceRef}` : ""}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={copy.delete}
                        onClick={() => removeDocument(doc)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </>
        )}
      </PageContent>

      <AddDocumentDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onAdded={async () => {
          setAddOpen(false);
          await loadDocuments();
        }}
      />
    </PageShell>
  );
}

function AddDocumentDialog({
  open,
  onOpenChange,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: () => void;
}) {
  const { t } = useTranslations();
  const copy = t.business;
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTitle("");
      setText("");
      setError(null);
    }
  }, [open]);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.post("/knowledge", { title, text, source: "text" });
      toast.success(copy.documentAdded);
      onAdded();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : copy.addFailed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={copy.addDocument}
      description={copy.addDocumentDescription}
      footer={
        <Button onClick={submit} disabled={saving || !title.trim() || !text.trim()}>
          {saving ? <Spinner className="size-4" /> : null}
          {copy.addDocument}
        </Button>
      }
    >
      <div className="space-y-4">
        {error ? <InlineNotice variant="error">{error}</InlineNotice> : null}

        <Field label={copy.documentTitle} hint={copy.documentTitleHint}>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={copy.documentTitlePlaceholder} />
        </Field>

        <Field label={copy.documentText} hint={copy.documentTextHint}>
          <Textarea rows={12} value={text} onChange={(e) => setText(e.target.value)} />
        </Field>
      </div>
    </ResponsiveDialog>
  );
}
