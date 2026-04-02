"use client";

import { usePathname } from "next/navigation";
import { ConversationList } from "@/components/conversations/conversation-list";

export default function ConversationsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isChatView = pathname !== "/conversations" && pathname !== "/" && pathname.startsWith("/conversations/");

  return (
    <div className="flex h-full w-full bg-background">
      {/* Master List Column */}
      <div 
        className={`${isChatView ? 'hidden md:flex' : 'flex'} w-full md:w-[380px] lg:w-[420px] h-full flex-col border-r border-border bg-background z-10 transition-all shadow-sm`}
      >
        <ConversationList />
      </div>
      
      {/* Detail Chat Column */}
      <div 
        className={`${!isChatView ? 'hidden md:flex' : 'flex'} flex-1 h-full flex-col bg-[var(--asis-surface-panel)] relative z-0`}
      >
        {/* subtle background pattern */}
        <div className="absolute inset-0 z-0 opacity-[0.06] dark:opacity-[0.04] pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23808080' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` }}></div>
        <div className="relative z-10 h-full flex flex-col">
          {children}
        </div>
      </div>
    </div>
  );
}
