"use client";

import { useEffect, useMemo, useState } from "react";
import { Play, Copy, Check, TerminalSquare } from "lucide-react";
import { useTranslations } from "@/lib/i18n/use-translations";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { SimpleSelect } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { UpgradeCard } from "./upgrade-card";
import { ENDPOINT_CATALOG, type CatalogEndpoint } from "./catalogs";
import { API_BASE, type DeveloperOverview } from "./types";

const STORAGE_KEY = "asis-playground-api-key";

interface PlaygroundResponse {
  status: number;
  statusText: string;
  durationMs: number;
  body: string;
}

function methodBadgeClass(method: string) {
  return method === "GET"
    ? "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300"
    : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
}

export function PlaygroundTab({ overview }: { overview: DeveloperOverview | null }) {
  const { t, locale } = useTranslations();
  const [apiKey, setApiKey] = useState("");
  const [endpointId, setEndpointId] = useState(ENDPOINT_CATALOG[0].id);
  const [pathValues, setPathValues] = useState<Record<string, string>>({});
  const [queryValues, setQueryValues] = useState<Record<string, string>>({});
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [response, setResponse] = useState<PlaygroundResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedSnippet, setCopiedSnippet] = useState<"curl" | "js" | null>(null);

  const endpoint = useMemo(
    () => ENDPOINT_CATALOG.find((e) => e.id === endpointId) ?? ENDPOINT_CATALOG[0],
    [endpointId],
  );

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setApiKey(stored);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, apiKey);
  }, [apiKey]);

  // Al cambiar de endpoint: resetear campos y precargar el body de ejemplo
  useEffect(() => {
    setPathValues({});
    setQueryValues({});
    setBody(endpoint.bodyExample ? JSON.stringify(endpoint.bodyExample, null, 2) : "");
    setResponse(null);
    setErrorMsg(null);
  }, [endpoint]);

  const builtPath = useMemoPath(endpoint, pathValues, queryValues);
  const fullUrl = `${API_BASE.replace(/\/$/, "")}${builtPath}`;

  const parsedBody = (): { ok: boolean; value?: string } => {
    if (endpoint.method === "GET" || !body.trim()) return { ok: true, value: undefined };
    try {
      return { ok: true, value: JSON.stringify(JSON.parse(body)) };
    } catch {
      return { ok: false };
    }
  };

  const handleSend = async () => {
    if (!apiKey.trim()) {
      setErrorMsg(t.developers.needKey);
      return;
    }
    const bodyResult = parsedBody();
    if (!bodyResult.ok) {
      setErrorMsg(t.developers.invalidJson);
      return;
    }
    setSending(true);
    setErrorMsg(null);
    setResponse(null);
    const started = performance.now();
    try {
      const res = await fetch(fullUrl, {
        method: endpoint.method,
        headers: {
          "X-Api-Key": apiKey.trim(),
          ...(bodyResult.value ? { "Content-Type": "application/json" } : {}),
        },
        body: bodyResult.value,
      });
      const durationMs = Math.round(performance.now() - started);
      const text = await res.text();
      let pretty = text;
      try {
        pretty = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        /* respuesta no-JSON: se muestra cruda */
      }
      setResponse({ status: res.status, statusText: res.statusText, durationMs, body: pretty });
    } catch {
      setErrorMsg(t.developers.networkError);
    } finally {
      setSending(false);
    }
  };

  const curlSnippet = useMemo(() => {
    const lines = [`curl -X ${endpoint.method} "${fullUrl}"`, `  -H "X-Api-Key: ${apiKey.trim() || "ak_live_TU_CLAVE"}"`];
    if (endpoint.method === "POST" && body.trim()) {
      lines.push(`  -H "Content-Type: application/json"`);
      lines.push(`  -d '${body.replace(/\n\s*/g, " ")}'`);
    }
    return lines.join(" \\\n");
  }, [endpoint.method, fullUrl, apiKey, body]);

  const jsSnippet = useMemo(() => {
    const opts: string[] = [`  method: "${endpoint.method}"`, `  headers: {\n    "X-Api-Key": "${apiKey.trim() || "ak_live_TU_CLAVE"}",\n    "Content-Type": "application/json",\n  }`];
    if (endpoint.method === "POST" && body.trim()) {
      opts.push(`  body: JSON.stringify(${body.replace(/\n/g, "\n  ")})`);
    }
    return `const res = await fetch("${fullUrl}", {\n${opts.join(",\n")}\n});\nconst data = await res.json();`;
  }, [endpoint.method, fullUrl, apiKey, body]);

  const copySnippet = async (kind: "curl" | "js") => {
    await navigator.clipboard.writeText(kind === "curl" ? curlSnippet : jsSnippet);
    setCopiedSnippet(kind);
    setTimeout(() => setCopiedSnippet(null), 2000);
  };

  const endpointOptions = ENDPOINT_CATALOG.map((e) => ({
    value: e.id,
    label: `${e.method} ${e.path} — ${e.summary[locale]}`,
  }));

  if (overview && !overview.apiAccess) {
    return <UpgradeCard body={t.developers.upgradeApiBody} />;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.developers.playgroundIntro}</p>

      <Card>
        <CardContent className="space-y-4 pt-4">
          <Field label={t.developers.apiKeyLabel} hint={t.developers.apiKeyHint}>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={t.developers.apiKeyPlaceholder}
              className="font-mono"
            />
          </Field>

          <Field label={t.developers.endpointLabel}>
            <SimpleSelect value={endpointId} onChange={setEndpointId} options={endpointOptions} />
          </Field>

          <div className="flex items-center gap-2 overflow-x-auto rounded-md border bg-muted/40 px-3 py-2">
            <Badge className={cn("shrink-0 font-mono", methodBadgeClass(endpoint.method))}>{endpoint.method}</Badge>
            <code className="whitespace-nowrap font-mono text-xs">{fullUrl}</code>
          </div>

          {endpoint.pathParams && endpoint.pathParams.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">{t.developers.pathParams}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {endpoint.pathParams.map((param) => (
                  <Input
                    key={param}
                    value={pathValues[param] ?? ""}
                    onChange={(e) => setPathValues((v) => ({ ...v, [param]: e.target.value }))}
                    placeholder={`{${param}}`}
                    className="font-mono text-xs"
                  />
                ))}
              </div>
            </div>
          )}

          {endpoint.queryParams && endpoint.queryParams.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">{t.developers.queryParams}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {endpoint.queryParams.map((param) => (
                  <div key={param.name} className="flex items-center gap-2">
                    <code className="w-28 shrink-0 truncate font-mono text-xs text-muted-foreground">{param.name}</code>
                    <Input
                      value={queryValues[param.name] ?? ""}
                      onChange={(e) => setQueryValues((v) => ({ ...v, [param.name]: e.target.value }))}
                      placeholder={param.placeholder ?? ""}
                      className="h-8 font-mono text-xs"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {endpoint.method === "POST" && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">{t.developers.bodyLabel}</p>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={7}
                className="font-mono text-xs"
                spellCheck={false}
              />
            </div>
          )}

          {errorMsg && <p className="text-xs text-destructive">{errorMsg}</p>}

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleSend} disabled={sending} className="gap-1.5">
              <Play className="h-4 w-4" />
              {sending ? t.developers.sending : t.developers.send}
            </Button>
            <Button size="sm" variant="outline" onClick={() => copySnippet("curl")} className="gap-1.5">
              {copiedSnippet === "curl" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedSnippet === "curl" ? t.developers.snippetCopied : t.developers.copyCurl}
            </Button>
            <Button size="sm" variant="outline" onClick={() => copySnippet("js")} className="gap-1.5">
              {copiedSnippet === "js" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedSnippet === "js" ? t.developers.snippetCopied : t.developers.copyJs}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <div className="mb-2 flex items-center gap-2">
            <TerminalSquare className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">{t.developers.response}</span>
            {response && (
              <>
                <Badge
                  className={cn(
                    "font-mono",
                    response.status < 300
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                      : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
                  )}
                >
                  {response.status} {response.statusText}
                </Badge>
                <span className="text-xs text-muted-foreground">{response.durationMs} ms</span>
              </>
            )}
          </div>
          {response ? (
            <pre className="max-h-96 overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-xs leading-relaxed">
              {response.body}
            </pre>
          ) : (
            <p className="py-6 text-center text-xs text-muted-foreground">{t.developers.noResponseYet}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** Ruta final con path params reemplazados y query string armada */
function useMemoPath(
  endpoint: CatalogEndpoint,
  pathValues: Record<string, string>,
  queryValues: Record<string, string>,
): string {
  return useMemo(() => {
    let path = endpoint.path;
    for (const param of endpoint.pathParams ?? []) {
      const value = pathValues[param]?.trim();
      path = path.replace(`{${param}}`, value ? encodeURIComponent(value) : `{${param}}`);
    }
    const query = (endpoint.queryParams ?? [])
      .map((p) => ({ name: p.name, value: queryValues[p.name]?.trim() }))
      .filter((p) => p.value)
      .map((p) => `${encodeURIComponent(p.name)}=${encodeURIComponent(p.value!)}`)
      .join("&");
    return query ? `${path}?${query}` : path;
  }, [endpoint, pathValues, queryValues]);
}
