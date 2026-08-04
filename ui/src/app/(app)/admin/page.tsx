"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageShell, PageContent } from "@/components/layout/page-shell";
import { PageHeader } from "@/components/layout/page-header";
import { RightPanel } from "@/components/layout/right-panel";
import { PhoneNumberList } from "@/components/admin/phone-number-list";
import { LabelManager } from "@/components/admin/label-manager";
import { useAuthStore } from "@/stores/auth.store";
import { useBillingStore } from "@/stores/billing.store";
import { useTranslations } from "@/lib/i18n/use-translations";

export default function AdminPage() {
  const agent = useAuthStore((s) => s.agent);
  const usage = useBillingStore((s) => s.usage);
  const router = useRouter();
  const { t } = useTranslations();
  const [panelContent, setPanelContent] = useState<ReactNode>(null);
  const [tab, setTab] = useState("phones");

  // Cada pestaña publica acá su "crear": la cabecera es la única que muestra
  // acciones, pero el alta vive adentro porque tiene que refrescar la lista.
  const createPhone = useRef<(() => void) | null>(null);
  const createLabel = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (agent && agent.role !== "admin") {
      router.push("/");
    }
  }, [agent, router]);

  if (agent?.role !== "admin") return null;

  const closePanel = () => setPanelContent(null);

  const isPhones = tab === "phones";
  const phoneUsage = usage?.phoneNumbers;
  const atLimit = isPhones && phoneUsage ? !phoneUsage.allowed : false;

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
            title={t.admin.title}
            subtitle={t.admin.subtitle}
            actions={
              <Button
                size="sm"
                disabled={atLimit}
                onClick={() => (isPhones ? createPhone : createLabel).current?.()}
              >
                <Plus className="size-4" />
                {isPhones ? t.admin.newPhone : t.admin.createLabel}
              </Button>
            }
          >
            <TabsList>
              <TabsTrigger value="phones">{t.admin.phoneNumbers}</TabsTrigger>
              <TabsTrigger value="labels">{t.admin.labels}</TabsTrigger>
            </TabsList>
          </PageHeader>

          <TabsContent value="phones" className="flex min-h-0 flex-1 flex-col">
            <PageContent>
              <PhoneNumberList
                onPanelChange={setPanelContent}
                onPanelClose={closePanel}
                createRef={createPhone}
              />
            </PageContent>
          </TabsContent>
          <TabsContent value="labels" className="flex min-h-0 flex-1 flex-col">
            <PageContent>
              <LabelManager createRef={createLabel} />
            </PageContent>
          </TabsContent>
        </Tabs>
      </PageShell>

      <RightPanel open={!!panelContent} onClose={closePanel} label={t.admin.title}>
        {panelContent}
      </RightPanel>
    </div>
  );
}
