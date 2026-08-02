"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PhoneNumberList } from "@/components/admin/phone-number-list";
import { LabelManager } from "@/components/admin/label-manager";
import { RightPanel } from "@/components/layout/right-panel";
import { useAuthStore } from "@/stores/auth.store";
import { useTranslations } from "@/lib/i18n/use-translations";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

export default function AdminPage() {
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
      {/* Left: header + tabs + content */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <div className="px-4 pt-4 md:px-6 md:pt-6">
          <h1 className="text-xl font-bold">{t.admin.title}</h1>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">{t.admin.subtitle}</p>
        </div>
        <Tabs
          defaultValue="phones"
          className="flex-1 flex flex-col min-h-0"
          onValueChange={() => closePanel()}
        >
          <div className="px-4 md:px-6">
            <TabsList>
              <TabsTrigger value="phones">{t.admin.phoneNumbers}</TabsTrigger>
              <TabsTrigger value="labels">{t.admin.labels}</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="phones" className="mt-0 flex-1 min-h-0">
            <PhoneNumberList onPanelChange={setPanelContent} onPanelClose={closePanel} />
          </TabsContent>
          <TabsContent value="labels" className="mt-0 flex-1 min-h-0 overflow-auto px-4 pb-20 md:px-6 pt-4">
            <LabelManager />
          </TabsContent>
        </Tabs>
      </div>

      {/* Right panel at page level - full height */}
      <RightPanel open={!!panelContent} onClose={closePanel}>
        {panelContent}
      </RightPanel>
    </div>
  );
}
