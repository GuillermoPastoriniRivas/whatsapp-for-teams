"use client";

import { useEffect } from "react";
import { AuthProvider } from "@/components/auth-provider";
import { AppHeader } from "@/components/layout/app-header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { DemoBanner } from "@/components/demo-banner";
import { PwaProvider } from "@/components/pwa/pwa-provider";
import { MessageToast } from "@/components/notifications/message-toast";
import { useBillingStore } from "@/stores/billing.store";
import { useMobileNavVisible } from "@/lib/use-mobile-nav-visible";
import { cn } from "@/lib/utils";

function BillingLoader() {
  const fetchSubscription = useBillingStore((s) => s.fetchSubscription);
  useEffect(() => { fetchSubscription(); }, [fetchSubscription]);
  return null;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const navVisible = useMobileNavVisible();
  return (
    <AuthProvider>
      <BillingLoader />
      <PwaProvider />
      <MessageToast />
      <div className="flex flex-col h-dvh w-full overflow-hidden bg-background font-sans">
        <DemoBanner />
        <div className="flex flex-1 overflow-hidden">
          <AppSidebar />
          <div className="flex flex-1 flex-col overflow-hidden relative shadow-xl shadow-slate-200/50 dark:shadow-none">
            <div className="md:hidden">
              <AppHeader />
            </div>
            <main
              className={cn(
                "flex-1 overflow-hidden relative md:pb-0",
                navVisible
                  ? "pb-[calc(3.5rem+env(safe-area-inset-bottom))]"
                  : "pb-[env(safe-area-inset-bottom)]"
              )}
            >
              {children}
            </main>
            <MobileNav />
          </div>
        </div>
      </div>
    </AuthProvider>
  );
}
