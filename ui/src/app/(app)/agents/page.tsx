"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgentList } from "@/components/admin/agent-list";
import { AiAgentList } from "@/components/admin/ai-agent-list";
import { RightPanel } from "@/components/layout/right-panel";
import { useAuthStore } from "@/stores/auth.store";
import { useTranslations } from "@/lib/i18n/use-translations";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

export default function AgentsPage() {
  const agent = useAuthStore((s) => s.agent);
  const router = useRouter();
  const { t } = useTranslations();
  const [panelContent, setPanelContent] = useState<ReactNode>(null);

  useEffect(() => {
    if (agent && agent.role !== "admin") {
      router.push("/");
    }
  }, [agent, router]);

  if (agent?.role !== "admin") return null;

  const closePanel = () => setPanelContent(null);

  return (
    <div className="h-full flex">
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <div className="px-4 pt-4 md:px-6 md:pt-6">
          <h1 className="text-xl font-bold mb-4">{t.agents.title}</h1>
        </div>
        <Tabs
          defaultValue="team"
          className="flex-1 flex flex-col min-h-0"
          onValueChange={() => closePanel()}
        >
          <div className="px-4 md:px-6">
            <TabsList>
              <TabsTrigger value="team">{t.agents.team}</TabsTrigger>
              <TabsTrigger value="ai">{t.agents.ai}</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="team" className="mt-0 flex-1 min-h-0">
            <AgentList onPanelChange={setPanelContent} onPanelClose={closePanel} />
          </TabsContent>
          <TabsContent value="ai" className="mt-0 flex-1 min-h-0">
            <AiAgentList onPanelChange={setPanelContent} onPanelClose={closePanel} />
          </TabsContent>
        </Tabs>
      </div>

      <RightPanel open={!!panelContent} onClose={closePanel}>
        {panelContent}
      </RightPanel>
    </div>
  );
}
