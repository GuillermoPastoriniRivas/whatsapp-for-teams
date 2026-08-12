"use client";

import { useCallback, useEffect, useState } from "react";
import { KeyRound, Plus, Copy, Check, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";
import { useTranslations } from "@/lib/i18n/use-translations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { LoadingState } from "@/components/ui/spinner";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { UpgradeCard } from "./upgrade-card";
import type { ApiKeyView, ApiScope, CreatedApiKey, DeveloperOverview } from "./types";

const API_SCOPES: ApiScope[] = ["messages:read", "messages:write", "flows:read", "flows:write"];
const DEFAULT_SCOPES: ApiScope[] = ["messages:read", "messages:write"];

const SCOPE_LABEL_KEYS = {
  "messages:read": "scopeMessagesRead",
  "messages:write": "scopeMessagesWrite",
  "flows:read": "scopeFlowsRead",
  "flows:write": "scopeFlowsWrite",
} as const;

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
  const confirm = useConfirm();
  const [keys, setKeys] = useState<ApiKeyView[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<ApiScope[]>([...DEFAULT_SCOPES]);
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
      const result = await api.post<CreatedApiKey>("/developer/api-keys", { name: name.trim(), scopes });
      setCreated(result);
      setName("");
      setScopes([...DEFAULT_SCOPES]);
      setFormOpen(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (key: ApiKeyView) => {
    if (!(await confirm({ title: t.developers.revokeConfirm, destructive: true }))) return;
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
          <CardContent className="space-y-4 pt-4">
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.developers.keyNamePlaceholder}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              maxLength={80}
            />

            <div className="space-y-2">
              <p className="text-sm font-medium">{t.developers.scopesTitle}</p>
              <p className="text-xs text-muted-foreground">{t.developers.scopesHelp}</p>
              {API_SCOPES.map((scope) => (
                <label key={scope} className="flex items-start gap-2 text-sm">
                  <Checkbox
                    className="mt-0.5"
                    checked={scopes.includes(scope)}
                    onCheckedChange={(checked) =>
                      setScopes(checked ? [...scopes, scope] : scopes.filter((item) => item !== scope))
                    }
                  />
                  <span>
                    <code className="font-mono text-xs">{scope}</code>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {t.developers[SCOPE_LABEL_KEYS[scope]]}
                    </span>
                  </span>
                </label>
              ))}
            </div>

            <div className="flex gap-2">
              <Button onClick={handleCreate} disabled={!name.trim() || scopes.length === 0 || creating}>
                {creating ? t.developers.creating : t.developers.create}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setFormOpen(false);
                  setName("");
                  setScopes([...DEFAULT_SCOPES]);
                  setError(null);
                }}
              >
                {t.developers.cancel}
              </Button>
            </div>
          </CardContent>
          {error && <p className="px-6 pb-3 text-xs text-destructive">{error}</p>}
        </Card>
      )}

      {loading ? (
        <LoadingState />
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
                    {(key.scopes ?? []).length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {key.scopes.map((scope) => (
                          <code key={scope} className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                            {scope}
                          </code>
                        ))}
                      </div>
                    )}
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
