"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/spinner";
import { Check, Phone, User } from "lucide-react";
import { useTranslations } from "@/lib/i18n/use-translations";
import { cn } from "@/lib/utils";
import type { Agent, PhoneNumber } from "@/types";

interface PhoneAccessItem {
  id: string;
}

/** Una fila seleccionable: un número (modo agent) o una persona (modo phone). */
interface Row {
  id: string;
  title: string;
  subtitle: string;
}

type Props =
  | { mode: "agent"; agentId: string }
  | { mode: "phone"; phoneId: string };

/**
 * Asignación de números ↔ personas, editable desde los dos lados: desde la
 * ficha de una persona ("qué números atiende") y desde la ficha de un número
 * ("quién lo atiende"). Ambos escriben sobre /agents/:id/phone-access.
 */
export function PhoneAccessSection(props: Props) {
  const { t } = useTranslations();
  const [rows, setRows] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const key = props.mode === "agent" ? props.agentId : props.phoneId;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (props.mode === "agent") {
        const [phones, access] = await Promise.all([
          api.get<PhoneNumber[]>("/phone-numbers"),
          api
            .get<PhoneAccessItem[]>(`/agents/${props.agentId}/phone-access`)
            .catch(() => [] as PhoneAccessItem[]),
        ]);
        setRows(
          phones.map((p) => ({
            id: p.id,
            title: p.label || p.displayPhone,
            subtitle: p.displayPhone,
          }))
        );
        setSelected(new Set(access.map((a) => a.id)));
      } else {
        const agents = await api.get<Agent[]>("/agents");
        const humans = agents.filter((a) => a.type !== "ai");
        const grants = await Promise.all(
          humans.map(async (a) => {
            try {
              const access = await api.get<PhoneAccessItem[]>(
                `/agents/${a.id}/phone-access`
              );
              return access.some((x) => x.id === props.phoneId) ? a.id : null;
            } catch {
              return null;
            }
          })
        );
        setRows(
          humans.map((a) => ({ id: a.id, title: a.name, subtitle: a.email }))
        );
        setSelected(new Set(grants.filter((id): id is string => !!id)));
      }
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [props.mode, key]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /** Traduce (fila, modo) al par agentId/phoneId que espera la API. */
  const endpointFor = (rowId: string) =>
    props.mode === "agent"
      ? { agentId: props.agentId, phoneId: rowId }
      : { agentId: rowId, phoneId: props.phoneId };

  const toggle = async (rowId: string) => {
    const { agentId, phoneId } = endpointFor(rowId);
    const granted = selected.has(rowId);
    setBusy(rowId);

    // Optimista: el checkbox responde al toque y se revierte si la API falla.
    setSelected((prev) => {
      const next = new Set(prev);
      granted ? next.delete(rowId) : next.add(rowId);
      return next;
    });

    try {
      if (granted) {
        await api.delete(`/agents/${agentId}/phone-access/${phoneId}`);
      } else {
        await api.post(`/agents/${agentId}/phone-access`, {
          phoneNumberId: phoneId,
        });
      }
    } catch {
      setSelected((prev) => {
        const next = new Set(prev);
        granted ? next.add(rowId) : next.delete(rowId);
        return next;
      });
    } finally {
      setBusy(null);
    }
  };

  const setAll = async (grant: boolean) => {
    const targets = rows.filter((r) => selected.has(r.id) !== grant);
    if (targets.length === 0) return;

    setBusy("bulk");
    const previous = new Set(selected);
    setSelected(grant ? new Set(rows.map((r) => r.id)) : new Set());

    try {
      await Promise.all(
        targets.map((r) => {
          const { agentId, phoneId } = endpointFor(r.id);
          return grant
            ? api.post(`/agents/${agentId}/phone-access`, {
                phoneNumberId: phoneId,
              })
            : api.delete(`/agents/${agentId}/phone-access/${phoneId}`);
        })
      );
    } catch {
      setSelected(previous);
    } finally {
      setBusy(null);
    }
  };

  const isAgentMode = props.mode === "agent";
  const RowIcon = isAgentMode ? Phone : User;
  const title = isAgentMode ? t.access.phonesForAgent : t.access.agentsForPhone;
  const hint = isAgentMode ? t.access.phonesHint : t.access.agentsHint;
  const emptyText = isAgentMode ? t.access.noPhones : t.access.noAgents;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{title}</p>
        {!loading && rows.length > 0 && (
          <span className="shrink-0 text-xs text-muted-foreground">
            {selected.size}/{rows.length} {t.access.countOf}
          </span>
        )}
      </div>

      {loading ? (
        <LoadingState className="py-6" />
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyText}</p>
      ) : (
        <>
          <div className="divide-y overflow-hidden rounded-xl border">
            {rows.map((row) => {
              const granted = selected.has(row.id);
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => toggle(row.id)}
                  disabled={busy !== null}
                  className="flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/50 disabled:opacity-60"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <RowIcon className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="truncate text-sm">{row.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {row.subtitle}
                      </p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-md border-2 transition-all",
                      granted
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border"
                    )}
                  >
                    {granted && <Check className="size-3.5" />}
                  </span>
                </button>
              );
            })}
          </div>

          {rows.length > 1 && (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAll(true)}
                disabled={busy !== null || selected.size === rows.length}
              >
                {t.access.selectAll}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAll(false)}
                disabled={busy !== null || selected.size === 0}
              >
                {t.access.clearAll}
              </Button>
            </div>
          )}

          <p className="text-xs text-muted-foreground">{hint}</p>
        </>
      )}
    </div>
  );
}
