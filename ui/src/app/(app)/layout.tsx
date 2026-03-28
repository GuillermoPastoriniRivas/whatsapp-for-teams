"use client";

import { AuthProvider } from "@/components/auth-provider";
import { AppHeader } from "@/components/layout/app-header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { AppSidebar } from "@/components/layout/app-sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className="flex h-screen w-full overflow-hidden bg-white dark:bg-slate-950 font-sans">
        <AppSidebar />
        <div className="flex flex-1 flex-col overflow-hidden relative border-l border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
          {/* We only show the AppHeader on mobile or as a specific use-case inside. If we want we can hide it on desktop. */}
          <div className="md:hidden">
            <AppHeader />
          </div>
          <main className="flex-1 overflow-hidden relative pb-14 md:pb-0 h-[calc(100vh-56px)] md:h-screen">
            {children}
          </main>
          <MobileNav />
        </div>
      </div>
    </AuthProvider>
  );
}
