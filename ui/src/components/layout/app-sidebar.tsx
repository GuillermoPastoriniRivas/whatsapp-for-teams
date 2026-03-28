"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquare, Settings, Shield, User, Bell } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { useConversationStore } from "@/stores/conversation.store";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function AppSidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const agent = useAuthStore((s) => s.agent);
  const totalUnread = useConversationStore((s) =>
    Object.values(s.unreadCounts).reduce((sum, n) => sum + n, 0)
  );

  const topTabs = [
    { href: "/", icon: MessageSquare, label: "Chats" },
    ...(agent?.role === "admin"
      ? [{ href: "/admin", icon: Shield, label: "Admin" }]
      : []),
  ];

  const bottomTabs = [
    { href: "/notifications", icon: Bell, label: "Notifications" },
    { href: "/settings", icon: Settings, label: "Settings" },
  ];

  const NavItem = ({ tab }: { tab: any }) => {
    const isActive =
      tab.href === "/"
        ? pathname === "/" || pathname.startsWith("/conversations")
        : pathname.startsWith(tab.href);

    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href={tab.href}
              className={cn(
                "relative flex h-12 w-12 items-center justify-center rounded-xl transition-all",
                isActive
                  ? "bg-[#25D366]/10 text-[#25D366] shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <tab.icon className={cn("h-5 w-5", isActive && "stroke-[2.5px]")} />
              {tab.label === "Chats" && totalUnread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#25D366] px-1 text-[9px] font-bold text-white">
                  {totalUnread > 99 ? "99+" : totalUnread}
                </span>
              )}
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right" className="font-semibold">{tab.label}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <div className={cn("hidden md:flex w-20 flex-col items-center border-r bg-background py-4", className)}>
      {/* App Logo */}
      <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#25D366] to-[#128C7E] shadow-lg shadow-[#25D366]/20">
        <MessageSquare className="h-6 w-6 text-white" />
      </div>

      <div className="flex flex-1 flex-col justify-between w-full px-4">
        <div className="flex flex-col gap-3">
          {topTabs.map((tab) => (
            <NavItem key={tab.href} tab={tab} />
          ))}
        </div>

        <div className="flex flex-col gap-3 pb-4">
          {bottomTabs.map((tab) => (
            <NavItem key={tab.href} tab={tab} />
          ))}
          
          <div className="mt-2 flex justify-center border-t pt-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 border">
              <User className="h-5 w-5 text-slate-600 dark:text-slate-300" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
