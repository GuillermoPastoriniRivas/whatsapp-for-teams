"use client";

import { AuthProvider } from "@/components/auth-provider";
import { AppHeader } from "@/components/layout/app-header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { DemoBanner } from "@/components/demo-banner";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className="flex flex-col h-screen w-full overflow-hidden bg-background font-sans">
        <DemoBanner />
        <div className="flex flex-1 overflow-hidden">
          <AppSidebar />
          <div className="flex flex-1 flex-col overflow-hidden relative shadow-xl shadow-slate-200/50 dark:shadow-none">
            <div className="md:hidden">
              <AppHeader />
            </div>
            <main className="flex-1 overflow-hidden relative pb-14 md:pb-0">
              {children}
            </main>
            <MobileNav />
          </div>
        </div>
      </div>
    </AuthProvider>
  );
}
