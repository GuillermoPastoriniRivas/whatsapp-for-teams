"use client";

import { useEffect, useState } from "react";
import { Plus, RefreshCw, Trash2 } from "lucide-react";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { LoadingState } from "@/components/ui/spinner";
import { StatusPill } from "@/components/ui/status-pill";
import { InlineNotice } from "@/components/shared/inline-notice";
import { toast } from "@/lib/toast";
import { useTranslations } from "@/lib/i18n/use-translations";
import type { BlockedUser, ConversationalComponents, PhoneNumber, PhoneNumberHealth } from "@/types";

const MAX_ICE_BREAKERS = 4;
const MAX_COMMANDS = 30;

interface Props {
  phone: PhoneNumber;
  onUpdated: () => void;
}

/** La calidad que reporta Meta se lee como semáforo, no como texto. */
function qualityTone(value: string | null): "success" | "warning" | "danger" | "neutral" {
  switch ((value ?? "").toUpperCase()) {
    case "GREEN":
      return "success";
    case "YELLOW":
      return "warning";
    case "RED":
      return "danger";
    default:
      return "neutral";
  }
}

function HealthRow({ label, value, tone }: { label: string; value: string | null; tone?: "success" | "warning" | "danger" | "neutral" }) {
  if (!value) return null;
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 px-3 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      {tone ? <StatusPill tone={tone}>{value}</StatusPill> : <span className="text-sm">{value}</span>}
    </div>
  );
}

/**
 * Lo que el cliente ve en el chat antes de escribir —accesos rápidos y
 * comandos— más lo que Meta reporta del número.
 *
 * Los topes (4 accesos, 30 comandos, sin emojis) son de Meta: se respetan acá
 * para que el error salga antes de mandar y no como un rechazo genérico suyo.
 */
export function PhoneChatForm({ phone, onUpdated }: Props) {
  const { t } = useTranslations();
  const [components, setComponents] = useState<ConversationalComponents | null>(null);
  const [health, setHealth] = useState<PhoneNumberHealth | null>(phone.health ?? null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get<ConversationalComponents>(`/phone-numbers/${phone.id}/conversational-components`)
      .then((data) => !cancelled && setComponents(data))
      .catch((err: unknown) => !cancelled && setError(err instanceof Error ? err.message : String(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [phone.id]);

  useEffect(() => setHealth(phone.health ?? null), [phone.id, phone.health]);

  const patch = (next: Partial<ConversationalComponents>) =>
    setComponents((prev) => (prev ? { ...prev, ...next } : prev));

  const save = async () => {
    if (!components) return;
    setError(null);
    setSaving(true);
    try {
      // Los vacíos no se mandan: un campo que quedó a medio escribir no debería
      // ocupar uno de los 4 lugares.
      const payload: ConversationalComponents = {
        enabled: components.enabled,
        iceBreakers: components.iceBreakers.map((text) => text.trim()).filter(Boolean),
        commands: components.commands.filter((c) => c.commandName.trim() && c.commandDescription.trim()),
      };
      const saved = await api.patch<ConversationalComponents>(
        `/phone-numbers/${phone.id}/conversational-components`,
        payload
      );
      setComponents(saved);
      toast.success(t.admin.saved);
      onUpdated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.admin.saveError);
    } finally {
      setSaving(false);
    }
  };

  const sync = async () => {
    setSyncing(true);
    try {
      const updated = await api.post<PhoneNumber>(`/phone-numbers/${phone.id}/sync`, {});
      setHealth(updated.health ?? null);
      toast.success(t.admin.synced);
      onUpdated();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t.admin.saveError);
    } finally {
      setSyncing(false);
    }
  };

  if (loading) return <LoadingState className="py-10" />;

  return (
    <div className="space-y-4 px-4 py-4">
      {error && <InlineNotice variant="error">{error}</InlineNotice>}

      {/* Estado en Meta: lo alimentan los webhooks de salud y este botón. */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">{t.admin.healthTitle}</p>
          <Button type="button" variant="outline" size="sm" onClick={sync} disabled={syncing}>
            <RefreshCw className={syncing ? "animate-spin" : undefined} />
            {t.admin.syncWithMeta}
          </Button>
        </div>
        {health && (health.qualityRating || health.throughputLevel || health.nameStatus || health.accountStatus) ? (
          <div className="divide-y overflow-hidden rounded-xl border">
            <HealthRow label={t.admin.healthQuality} value={health.qualityRating} tone={qualityTone(health.qualityRating)} />
            <HealthRow label={t.admin.healthThroughput} value={health.throughputLevel} />
            <HealthRow label={t.admin.healthName} value={health.nameStatus} />
            <HealthRow label={t.admin.healthAccount} value={health.accountStatus} tone="warning" />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{t.admin.healthNever}</p>
        )}
      </div>

      {components && (
        <>
          {/* Accesos rápidos */}
          <div className="space-y-2">
            <p className="text-sm font-medium">{t.admin.quickRepliesTitle}</p>
            <p className="text-xs text-muted-foreground">{t.admin.quickRepliesHint}</p>
            <div className="space-y-2">
              {components.iceBreakers.map((text, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={text}
                    maxLength={80}
                    placeholder={t.admin.quickReplyPlaceholder}
                    onChange={(e) =>
                      patch({
                        iceBreakers: components.iceBreakers.map((v, i) => (i === index ? e.target.value : v)),
                      })
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t.common.delete}
                    onClick={() => patch({ iceBreakers: components.iceBreakers.filter((_, i) => i !== index) })}
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
            </div>
            {components.iceBreakers.length < MAX_ICE_BREAKERS && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => patch({ iceBreakers: [...components.iceBreakers, ""] })}
              >
                <Plus />
                {t.admin.addQuickReply}
              </Button>
            )}
          </div>

          {/* Comandos */}
          <div className="space-y-2">
            <p className="text-sm font-medium">{t.admin.commandsTitle}</p>
            <p className="text-xs text-muted-foreground">{t.admin.commandsHint}</p>
            <div className="space-y-3">
              {components.commands.map((command, index) => (
                <div key={index} className="space-y-1.5 rounded-xl border p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">/</span>
                    <Input
                      value={command.commandName}
                      maxLength={32}
                      placeholder={t.admin.commandNamePlaceholder}
                      onChange={(e) =>
                        patch({
                          commands: components.commands.map((c, i) =>
                            i === index ? { ...c, commandName: e.target.value } : c
                          ),
                        })
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t.common.delete}
                      onClick={() => patch({ commands: components.commands.filter((_, i) => i !== index) })}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                  <Input
                    value={command.commandDescription}
                    maxLength={256}
                    placeholder={t.admin.commandDescriptionPlaceholder}
                    onChange={(e) =>
                      patch({
                        commands: components.commands.map((c, i) =>
                          i === index ? { ...c, commandDescription: e.target.value } : c
                        ),
                      })
                    }
                  />
                </div>
              ))}
            </div>
            {components.commands.length < MAX_COMMANDS && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  patch({ commands: [...components.commands, { commandName: "", commandDescription: "" }] })
                }
              >
                <Plus />
                {t.admin.addCommand}
              </Button>
            )}
          </div>

          <Button type="button" onClick={save} disabled={saving} className="w-full">
            {saving ? t.common.saving : t.common.save}
          </Button>
        </>
      )}

      <BlockedUsersSection phoneId={phone.id} />
    </div>
  );
}

/** Lista de bloqueados del número: quién no puede escribirle. */
function BlockedUsersSection({ phoneId }: { phoneId: string }) {
  const { t } = useTranslations();
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => {
    api
      .get<BlockedUser[]>(`/phone-numbers/${phoneId}/blocked-users`)
      .then(setBlocked)
      .catch(() => setBlocked([]));
  };

  useEffect(load, [phoneId]);

  const change = async (waIds: string[], action: "block" | "unblock") => {
    setBusy(true);
    try {
      await api.post(`/phone-numbers/${phoneId}/blocked-users`, { waIds, action });
      setInput("");
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t.admin.saveError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 border-t pt-4">
      <p className="text-sm font-medium">{t.admin.blockedTitle}</p>
      <p className="text-xs text-muted-foreground">{t.admin.blockedHint}</p>

      <div className="flex items-center gap-2">
        <Input
          value={input}
          inputMode="numeric"
          placeholder={t.admin.blockPlaceholder}
          onChange={(e) => setInput(e.target.value)}
        />
        <Button
          type="button"
          variant="outline"
          disabled={busy || !input.trim()}
          onClick={() => change([input.trim()], "block")}
        >
          {t.admin.block}
        </Button>
      </div>

      {blocked.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t.admin.blockedEmpty}</p>
      ) : (
        <div className="divide-y overflow-hidden rounded-xl border">
          {blocked.map((user) => (
            <div key={user.waId} className="flex min-h-11 items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm">{user.name ?? `+${user.waId}`}</p>
                {user.name && <p className="truncate text-xs text-muted-foreground">+{user.waId}</p>}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => change([user.waId], "unblock")}
              >
                {t.admin.unblock}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
