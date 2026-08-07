"use client";

// Solo personas. Los asistentes de IA dejaron de vivir acá en ago-2026: ya no
// son una identidad que se asigna, son un nodo de una automatización. Su
// conducta se edita en el flujo y los datos del negocio en Ajustes.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageShell, PageContent } from "@/components/layout/page-shell";
import { PageHeader } from "@/components/layout/page-header";
import { RightPanel } from "@/components/layout/right-panel";
import { AgentList } from "@/components/admin/agent-list";
import { useAuthStore } from "@/stores/auth.store";
import { useBillingStore } from "@/stores/billing.store";
import { useTranslations } from "@/lib/i18n/use-translations";

export default function AgentsPage() {
  const agent = useAuthStore((s) => s.agent);
  const usage = useBillingStore((s) => s.usage);
  const router = useRouter();
  const { t } = useTranslations();
  const [panelContent, setPanelContent] = useState<ReactNode>(null);

  // La lista publica acá su "crear": la cabecera es la única que muestra
  // acciones, pero el alta vive en la lista porque tiene que refrescarla.
  const createTeam = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (agent && agent.role !== "admin") {
      router.push("/");
    }
  }, [agent, router]);

  if (agent?.role !== "admin") return null;

  const closePanel = () => setPanelContent(null);
  const atLimit = usage?.humanAgents ? !usage.humanAgents.allowed : false;

  return (
    <div className="flex h-full">
      <PageShell className="min-w-0 flex-1">
        <PageHeader
          title={t.agents.title}
          subtitle={t.agents.subtitle}
          actions={
            <Button size="sm" disabled={atLimit} onClick={() => createTeam.current?.()}>
              <Plus className="size-4" />
              {t.agents.newAgent}
            </Button>
          }
        />

        <PageContent>
          <AgentList onPanelChange={setPanelContent} onPanelClose={closePanel} createRef={createTeam} />
        </PageContent>
      </PageShell>

      <RightPanel open={!!panelContent} onClose={closePanel} label={t.agents.title}>
        {panelContent}
      </RightPanel>
    </div>
  );
}
