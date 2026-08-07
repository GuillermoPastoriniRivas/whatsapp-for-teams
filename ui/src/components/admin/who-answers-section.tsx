"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Workflow, ChevronRight } from "lucide-react";

import { api } from "@/lib/api";
import { LoadingState } from "@/components/ui/spinner";
import { InlineNotice } from "@/components/shared/inline-notice";
import { FlowStatusPill } from "@/components/flows/flow-status-pill";
import { useTranslations } from "@/lib/i18n/use-translations";
import type { FlowSummary } from "@/types";

/**
 * Quién atiende los chats de un número, en un solo lugar. Antes esto había que
 * reconstruirlo abriendo cada automatización en el canvas: el disparador guarda
 * los números adentro del nodo y no se veía desde ningún listado.
 *
 * Se muestran en orden de evaluación, que es el que decide quién gana.
 */
export function WhoAnswersSection({ phoneId }: { phoneId: string }) {
  const { t } = useTranslations();
  const [flows, setFlows] = useState<FlowSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .get<FlowSummary[]>("/flows")
      .then((all) => {
        if (cancelled) return;
        // Una automatización sin números en el disparador aplica a todas las
        // líneas, así que también atiende a esta.
        const applies = all.filter(
          (f) =>
            f.status === "published" &&
            (f.triggerPhoneNumberIds.length === 0 || f.triggerPhoneNumberIds.includes(phoneId))
        );
        setFlows(applies.sort((a, b) => a.priority - b.priority));
      })
      .catch(() => setFlows([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [phoneId]);

  const hasBase = flows.some((f) => f.defaultForPhoneNumberId === phoneId);

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{t.flows.whoAnswers}</p>

      {loading ? (
        <LoadingState className="py-6" />
      ) : (
        <>
          {flows.length > 0 && (
            <div className="divide-y overflow-hidden rounded-xl border">
              {flows.map((flow) => (
                <Link
                  key={flow.id}
                  href={`/flows/${flow.id}`}
                  className="flex min-h-11 items-center justify-between gap-3 px-3 py-2.5 transition-colors hover:bg-muted/50"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Workflow className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="truncate text-sm">{flow.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {flow.defaultForPhoneNumberId === phoneId
                          ? t.flows.baseAutomation
                          : flow.triggerPhoneNumberIds.length === 0
                            ? t.flows.allNumbers
                            : `v${flow.publishedVersion ?? 1}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <FlowStatusPill status={flow.status} />
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>
          )}

          {hasBase ? (
            <p className="text-xs text-muted-foreground">{t.flows.whoAnswersHint}</p>
          ) : (
            <InlineNotice variant="warning">{t.flows.noAutomationsForPhone}</InlineNotice>
          )}
        </>
      )}
    </div>
  );
}
