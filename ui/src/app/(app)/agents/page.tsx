"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageShell, PageContent } from "@/components/layout/page-shell";
import { PageHeader } from "@/components/layout/page-header";
import { RightPanel } from "@/components/layout/right-panel";
import { AgentList } from "@/components/admin/agent-list";
import { AiAgentList } from "@/components/admin/ai-agent-list";
import { useAuthStore } from "@/stores/auth.store";
import { useBillingStore } from "@/stores/billing.store";
import { useTranslations } from "@/lib/i18n/use-translations";

export default function AgentsPage() {
  const agent = useAuthStore((s) => s.agent);
  const usage = useBillingStore((s) => s.usage);
  const router = useRouter();
  const { t } = useTranslations();
  const [panelContent, setPanelContent] = useState<ReactNode>(null);
  const [tab, setTab] = useState("team");

  // Cada lista publica acá su "crear": la cabecera es la única que muestra
  // acciones, pero el alta vive en la lista porque tiene que refrescarla.
  const createTeam = useRef<(() => void) | null>(null);
  const createAi = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (agent && agent.role !== "admin") {
      router.push("/");
    }
  }, [agent, router]);

  if (agent?.role !== "admin") return null;

  const closePanel = () => setPanelContent(null);

  const isTeam = tab === "team";
  const resource = isTeam ? usage?.humanAgents : usage?.aiBots;
  const atLimit = resource ? !resource.allowed : false;

  return (
    <div className="flex h-full">
      <PageShell className="min-w-0 flex-1">
        <Tabs
          value={tab}
          onValueChange={(value) => {
            setTab(value);
            closePanel();
          }}
          className="flex min-h-0 flex-1 flex-col gap-0"
        >
          <PageHeader
            title={t.agents.title}
            subtitle={t.agents.subtitle}
            actions={
              <Button
                size="sm"
                disabled={atLimit}
                onClick={() => (isTeam ? createTeam : createAi).current?.()}
              >
                <Plus className="size-4" />
                {isTeam ? t.agents.newAgent : t.agents.newAiAgent}
              </Button>
            }
          >
            <TabsList>
              <TabsTrigger value="team">{t.agents.team}</TabsTrigger>
              <TabsTrigger value="ai">{t.agents.ai}</TabsTrigger>
            </TabsList>
          </PageHeader>

          <TabsContent value="team" className="flex min-h-0 flex-1 flex-col">
            <PageContent>
              <AgentList onPanelChange={setPanelContent} onPanelClose={closePanel} createRef={createTeam} />
            </PageContent>
          </TabsContent>
          <TabsContent value="ai" className="flex min-h-0 flex-1 flex-col">
            <PageContent>
              <AiAgentList onPanelChange={setPanelContent} onPanelClose={closePanel} createRef={createAi} />
            </PageContent>
          </TabsContent>
        </Tabs>
      </PageShell>

      <RightPanel open={!!panelContent} onClose={closePanel} label={t.agents.title}>
        {panelContent}
      </RightPanel>
    </div>
  );
}
