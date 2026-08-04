"use client";

import { useState, useEffect } from "react";
import { Bot, Trash2, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { InlineNotice } from "@/components/shared/inline-notice";
import { api } from "@/lib/api";
import { PhoneAccessSection } from "@/components/admin/phone-access-section";
import { useTranslations } from "@/lib/i18n/use-translations";
import { cn } from "@/lib/utils";
import { AgentStatus } from "./agent-status";
import type { Agent } from "@/types";

interface Props {
  agent: Agent;
  onUpdated: (updated?: Agent) => void;
  onDeleted: () => void;
}

export function AgentDetailPanel({ agent, onUpdated, onDeleted }: Props) {
  const { t } = useTranslations();
  const confirm = useConfirm();
  const [name, setName] = useState(agent.name);
  const [role, setRole] = useState(agent.role);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setName(agent.name);
    setRole(agent.role);
    setError(null);
    setSuccess(null);
  }, [agent.id]);

  const roleLabel = (value: Agent["role"]) =>
    value === "admin" ? t.agents.roleAdmin : t.agents.roleAgent;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const updated = await api.patch<Agent>(`/agents/${agent.id}`, { name, role });
      setSuccess(t.agents.saved);
      onUpdated(updated);
    } catch (err: any) {
      setError(err.message || t.agents.saveError);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!(await confirm({ title: t.agents.confirmDelete, confirmLabel: t.common.delete, destructive: true }))) return;

    try {
      await api.delete(`/agents/${agent.id}`);
      onDeleted();
    } catch (err: any) {
      setError(err.message || t.agents.deleteError);
    }
  };

  const isAi = agent.type === "ai";

  return (
    <>
      {/* Header */}
      <div className="border-b px-4 pt-6 pb-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex size-12 shrink-0 items-center justify-center rounded-full",
              isAi ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            )}
          >
            {isAi ? <Bot className="size-6" /> : <User className="size-6" />}
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold">{agent.name}</h2>
            <div className="mt-0.5 flex items-center gap-2">
              <AgentStatus status={agent.status} />
              <Badge variant="outline">{roleLabel(agent.role)}</Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="space-y-4 px-4 py-4">
        <Field label={t.agents.name}>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>

        <Field label={t.agents.email} hint={t.agents.emailLocked}>
          <Input value={agent.email} disabled />
        </Field>

        <Field label={t.agents.role}>
          <div role="radiogroup" className="flex gap-2">
            {(["agent", "admin"] as const).map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={role === r}
                onClick={() => setRole(r)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-xs transition-colors",
                  role === r ? "border-primary bg-primary/10" : "hover:bg-muted/50"
                )}
              >
                {roleLabel(r)}
              </button>
            ))}
          </div>
        </Field>

        <div className="space-y-1.5">
          <p className="text-sm font-medium">{t.agents.status}</p>
          <AgentStatus status={agent.status} labelClassName="text-sm text-foreground" />
          <p className="text-xs text-muted-foreground">
            {t.agents.activeConversations}: {agent.activeCount}
          </p>
        </div>

        {/* Los agentes IA no tienen acceso por número: responden donde se publicó su flujo */}
        {isAi ? (
          <p className="text-xs text-muted-foreground">{t.access.aiHint}</p>
        ) : (
          <PhoneAccessSection mode="agent" agentId={agent.id} />
        )}

        {error && <InlineNotice variant="error">{error}</InlineNotice>}
        {!error && success && <InlineNotice variant="success">{success}</InlineNotice>}

        <div className="flex gap-2 pt-2">
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            <Trash2 className="size-4" />
            {t.common.delete}
          </Button>
          <div className="flex-1" />
          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving && <Spinner size="sm" />}
            {saving ? t.common.saving : t.common.save}
          </Button>
        </div>
      </div>
    </>
  );
}
