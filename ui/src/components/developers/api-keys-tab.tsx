"use client";

import { useCallback, useEffect, useState } from "react";
import { KeyRound, Plus, Copy, Check, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";
import { useTranslations } from "@/lib/i18n/use-translations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { UpgradeCard } from "./upgrade-card";
import type { ApiKeyView, CreatedApiKey, DeveloperOverview } from "./types";

function formatDate(value: string | null): string | null {
  if (!value) return null;
  return new Date(value).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function ApiKeysTab({ overview }: { overview: DeveloperOverview | null }) {
  const { t } = useTranslations();
  const [keys, setKeys] = useState<ApiKeyView[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<CreatedApiKey | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .get<ApiKeyView[]>("/developer/api-keys")
      .then(setKeys)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  if (overview && !overview.apiAccess) {
    return <UpgradeCard body={t.developers.upgradeApiBody} />;
  }

  const handleCreate = async () => {
    if (!name.trim() || creating) return;
    setCreating(true);
    setError(null);
    try {
      const result = await api.post<CreatedApiKey>("/developer/api-keys", { name: name.trim() });
      setCreated(result);
      setName("");
      setFormOpen(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (key: ApiKeyView) => {
    if (!confirm(t.developers.revokeConfirm)) return;
    try {
      await api.delete(`/developer/api-keys/${key.id}`);
      load();
    } catch {
      /* la lista se refresca igual en el próximo load */
    }
  };

  const copyKey = async () => {
    if (!created) return;
    await navigator.clipboard.writeText(created.plainKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.developers.keysIntro}</p>

      {created && (
        <Card className="border-primary/40 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-primary" />
              {t.developers.createdKeyTitle}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">{t.developers.createdKeyBody}</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded-md border bg-background px-3 py-2 font-mono text-xs">
                {created.plainKey}
              </code>
              <Button size="sm" variant="outline" onClick={copyKey} className="shrink-0 gap-1.5">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? t.developers.copied : t.developers.copy}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <KeyRound className="h-4 w-4" />
          {t.developers.tabKeys}
        </h2>
        {!formOpen && (
          <Button size="sm" onClick={() => setFormOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            {t.developers.newKey}
          </Button>
        )}
      </div>

      {formOpen && (
        <Card>
          <CardContent className="flex flex-col gap-2 pt-4 sm:flex-row">
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.developers.keyNamePlaceholder}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              maxLength={80}
            />
            <div className="flex gap-2">
              <Button onClick={handleCreate} disabled={!name.trim() || creating}>
                {creating ? t.developers.creating : t.developers.create}
              </Button>
              <Button variant="ghost" onClick={() => { setFormOpen(false); setName(""); setError(null); }}>
                {t.developers.cancel}
              </Button>
            </div>
          </CardContent>
          {error && <p className="px-6 pb-3 text-xs text-destructive">{error}</p>}
        </Card>
      )}

      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">…</p>
      ) : keys.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {t.developers.emptyKeys}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="divide-y p-0">
            {keys.map((key) => {
              const revoked = !!key.revokedAt;
              return (
                <div key={key.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={revoked ? "text-sm font-medium line-through text-muted-foreground" : "text-sm font-medium"}>
                        {key.name}
                      </span>
                      {revoked && <Badge variant="secondary">{t.developers.revoked}</Badge>}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                      <code className="font-mono">{key.prefix}…</code>
                      <span>
                        {t.developers.colCreated}: {formatDate(key.createdAt)}
                      </span>
                      <span>
                        {t.developers.colLastUsed}: {formatDate(key.lastUsedAt) ?? t.developers.never}
                      </span>
                    </div>
                  </div>
                  {!revoked && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleRevoke(key)}
                    >
                      {t.developers.revoke}
                    </Button>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
