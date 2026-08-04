"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Webhook, Plus, Copy, Check, RotateCw, SendHorizonal, Trash2,
  ChevronDown, ChevronUp, RefreshCw, Pencil,
} from "lucide-react";
import { api } from "@/lib/api";
import { useTranslations } from "@/lib/i18n/use-translations";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { LoadingState } from "@/components/ui/spinner";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { UpgradeCard } from "./upgrade-card";
import { EVENT_CATALOG } from "./catalogs";
import type { DeveloperOverview, Paginated, WebhookDeliveryView, WebhookEndpointView } from "./types";

interface EndpointFormState {
  url: string;
  description: string;
  events: string[];
}

const EMPTY_FORM: EndpointFormState = { url: "", description: "", events: ["message.received"] };

export function WebhooksTab({ overview }: { overview: DeveloperOverview | null }) {
  const { t } = useTranslations();
  const [endpoints, setEndpoints] = useState<WebhookEndpointView[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EndpointFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .get<WebhookEndpointView[]>("/developer/webhooks")
      .then(setEndpoints)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  if (overview && !overview.webhooks) {
    return <UpgradeCard body={t.developers.upgradeWebhooksBody} />;
  }

  const toggleEvent = (event: string) => {
    setForm((f) => ({
      ...f,
      events: f.events.includes(event) ? f.events.filter((e) => e !== event) : [...f.events, event],
    }));
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
    setFormOpen(true);
  };

  const openEdit = (endpoint: WebhookEndpointView) => {
    setEditingId(endpoint.id);
    setForm({ url: endpoint.url, description: endpoint.description ?? "", events: endpoint.events });
    setError(null);
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.url.trim() || form.events.length === 0 || saving) return;
    setSaving(true);
    setError(null);
    const payload = {
      url: form.url.trim(),
      description: form.description.trim() || null,
      events: form.events,
    };
    try {
      if (editingId) {
        await api.patch(`/developer/webhooks/${editingId}`, payload);
      } else {
        await api.post("/developer/webhooks", payload);
      }
      setFormOpen(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.developers.webhooksIntro}</p>

      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Webhook className="h-4 w-4" />
          {t.developers.tabWebhooks}
        </h2>
        {!formOpen && (
          <Button size="sm" onClick={openCreate} className="gap-1.5">
            <Plus className="h-4 w-4" />
            {t.developers.newEndpoint}
          </Button>
        )}
      </div>

      {formOpen && (
        <Card>
          <CardContent className="space-y-3 pt-4">
            <Input
              autoFocus
              value={form.url}
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
              placeholder="https://tu-servidor.com/webhooks/asis"
              type="url"
            />
            <Input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder={t.developers.endpointDescriptionPlaceholder}
              maxLength={200}
            />
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">{t.developers.subscribedEvents}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {EVENT_CATALOG.map((event) => (
                  <label
                    key={event.value}
                    className="flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 transition-colors hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={form.events.includes(event.value)}
                      onCheckedChange={() => toggleEvent(event.value)}
                      className="mt-0.5"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{t.developers[event.labelKey]}</span>
                      <code className="block truncate font-mono text-xs text-muted-foreground">{event.value}</code>
                      <span className="block text-xs text-muted-foreground">{t.developers[event.descKey]}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={!form.url.trim() || form.events.length === 0 || saving}>
                {saving ? t.developers.saving : t.developers.save}
              </Button>
              <Button variant="ghost" onClick={() => { setFormOpen(false); setEditingId(null); }}>
                {t.developers.cancel}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <LoadingState />
      ) : endpoints.length === 0 && !formOpen ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {t.developers.emptyEndpoints}
          </CardContent>
        </Card>
      ) : (
        endpoints.map((endpoint) => (
          <EndpointCard key={endpoint.id} endpoint={endpoint} onEdit={() => openEdit(endpoint)} onChanged={load} />
        ))
      )}
    </div>
  );
}

function EndpointCard({
  endpoint,
  onEdit,
  onChanged,
}: {
  endpoint: WebhookEndpointView;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const { t } = useTranslations();
  const confirm = useConfirm();
  const [secretCopied, setSecretCopied] = useState(false);
  const [testFeedback, setTestFeedback] = useState(false);
  const [showDeliveries, setShowDeliveries] = useState(false);
  const [deliveries, setDeliveries] = useState<WebhookDeliveryView[] | null>(null);
  const [retriedId, setRetriedId] = useState<string | null>(null);

  const eventLabel = (value: string) => {
    const entry = EVENT_CATALOG.find((e) => e.value === value);
    return entry ? t.developers[entry.labelKey] : value;
  };

  const copySecret = async () => {
    await navigator.clipboard.writeText(endpoint.secret);
    setSecretCopied(true);
    setTimeout(() => setSecretCopied(false), 2000);
  };

  const loadDeliveries = useCallback(() => {
    api
      .get<Paginated<WebhookDeliveryView>>(`/developer/webhooks/${endpoint.id}/deliveries?limit=10`)
      .then((r) => setDeliveries(r.data))
      .catch(() => setDeliveries([]));
  }, [endpoint.id]);

  const toggleDeliveries = () => {
    const next = !showDeliveries;
    setShowDeliveries(next);
    if (next && deliveries === null) loadDeliveries();
  };

  const handleToggleActive = async () => {
    await api.patch(`/developer/webhooks/${endpoint.id}`, { active: !endpoint.active });
    onChanged();
  };

  const handleRotate = async () => {
    if (!(await confirm({ title: t.developers.rotateConfirm, destructive: true }))) return;
    await api.post(`/developer/webhooks/${endpoint.id}/rotate-secret`);
    onChanged();
  };

  const handleDelete = async () => {
    if (!(await confirm({ title: t.developers.deleteEndpointConfirm, destructive: true }))) return;
    await api.delete(`/developer/webhooks/${endpoint.id}`);
    onChanged();
  };

  const handleTest = async () => {
    await api.post(`/developer/webhooks/${endpoint.id}/test`);
    setTestFeedback(true);
    setTimeout(() => setTestFeedback(false), 2500);
    if (showDeliveries) setTimeout(loadDeliveries, 1500);
  };

  const handleRetry = async (deliveryId: string) => {
    await api.post(`/developer/deliveries/${deliveryId}/retry`);
    setRetriedId(deliveryId);
    setTimeout(() => {
      setRetriedId(null);
      loadDeliveries();
    }, 1500);
  };

  const statusBadge = (status: WebhookDeliveryView["status"]) => {
    if (status === "success")
      return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300">{t.developers.statusSuccess}</Badge>;
    if (status === "failed")
      return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-950 dark:text-red-300">{t.developers.statusFailed}</Badge>;
    return <Badge variant="secondary">{t.developers.statusPending}</Badge>;
  };

  return (
    <Card className={cn(!endpoint.active && "opacity-70")}>
      <CardContent className="space-y-3 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 truncate font-mono text-sm">{endpoint.url}</code>
          <Badge variant={endpoint.active ? "default" : "secondary"}>
            {endpoint.active ? t.developers.active : t.developers.paused}
          </Badge>
        </div>
        {endpoint.description && <p className="text-xs text-muted-foreground">{endpoint.description}</p>}

        <div className="flex flex-wrap gap-1.5">
          {endpoint.events.map((event) => (
            <Badge key={event} variant="outline" className="font-normal">
              {eventLabel(event)}
            </Badge>
          ))}
        </div>

        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{t.developers.signingSecret}</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-md border bg-muted/40 px-2.5 py-1.5 font-mono text-xs">
              {endpoint.secret}
            </code>
            <Button size="sm" variant="ghost" onClick={copySecret} className="shrink-0 gap-1">
              {secretCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t.developers.signingSecretHint}</p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 border-t pt-3">
          <Button size="sm" variant="outline" onClick={handleTest} className="gap-1.5">
            <SendHorizonal className="h-3.5 w-3.5" />
            {testFeedback ? t.developers.testQueued : t.developers.sendTest}
          </Button>
          <Button size="sm" variant="ghost" onClick={onEdit} className="gap-1.5">
            <Pencil className="h-3.5 w-3.5" />
            {t.developers.edit}
          </Button>
          <Button size="sm" variant="ghost" onClick={handleToggleActive}>
            {endpoint.active ? t.developers.pause : t.developers.activate}
          </Button>
          <Button size="sm" variant="ghost" onClick={handleRotate} className="gap-1.5">
            <RotateCw className="h-3.5 w-3.5" />
            {t.developers.rotateSecret}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDelete}
            className="gap-1.5 text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {t.developers.delete}
          </Button>
          <Button size="sm" variant="ghost" onClick={toggleDeliveries} className="ml-auto gap-1">
            {showDeliveries ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {showDeliveries ? t.developers.hideDeliveries : t.developers.viewDeliveries}
          </Button>
        </div>

        {showDeliveries && (
          <div className="rounded-lg border">
            {deliveries === null ? (
              <p className="py-6 text-center text-xs text-muted-foreground">…</p>
            ) : deliveries.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">{t.developers.deliveriesEmpty}</p>
            ) : (
              <div className="divide-y">
                {deliveries.map((delivery) => (
                  <div key={delivery.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-xs">
                    {statusBadge(delivery.status)}
                    <code className="font-mono">{delivery.eventType}</code>
                    <span className="text-muted-foreground">
                      {new Date(delivery.createdAt).toLocaleString()}
                    </span>
                    <span className="text-muted-foreground">
                      {delivery.attempts} {t.developers.attempts}
                      {delivery.responseStatus ? ` · HTTP ${delivery.responseStatus}` : ""}
                      {delivery.lastError && !delivery.responseStatus ? ` · ${delivery.lastError}` : ""}
                    </span>
                    {delivery.status === "failed" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ml-auto h-6 gap-1 px-2 text-xs"
                        onClick={() => handleRetry(delivery.id)}
                      >
                        <RefreshCw className="h-3 w-3" />
                        {retriedId === delivery.id ? t.developers.retryQueued : t.developers.retry}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
