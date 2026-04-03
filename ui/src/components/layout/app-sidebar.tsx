"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Settings,
  Shield,
  User,
  Users,
  Bell,
  Contact,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  CreditCard,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { useConversationStore } from "@/stores/conversation.store";
import { useTranslations } from "@/lib/i18n/use-translations";
import { cn } from "@/lib/utils";
import { AsisLogo } from "@/components/brand/asis-logo";
import { LanguageToggle } from "@/components/layout/language-toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const SIDEBAR_KEY = "asis-sidebar-collapsed";

export function AppSidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const agent = useAuthStore((s) => s.agent);
  const totalUnread = useConversationStore((s) =>
    Object.values(s.unreadCounts).reduce((sum, n) => sum + n, 0)
  );
  const { t } = useTranslations();

  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_KEY);
    if (stored === "true") setCollapsed(true);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_KEY, String(next));
      return next;
    });
  };

  const topTabs = [
    { href: "/conversations", icon: MessageSquare, label: t.nav.chats },
    { href: "/contacts", icon: Contact, label: t.nav.contacts },
    ...(agent?.role === "admin"
      ? [
          { href: "/agents", icon: Users, label: t.nav.agents },
          { href: "/admin", icon: Shield, label: t.nav.admin },
        ]
      : []),
  ];

  const bottomTabs = [
    { href: "/notifications", icon: Bell, label: t.nav.notifications },
    ...(agent?.role === "admin"
      ? [{ href: "/settings/billing", icon: CreditCard, label: t.nav.billing }]
      : []),
    { href: "/settings", icon: Settings, label: t.nav.settings },
  ];

  const NavItem = ({ tab }: { tab: { href: string; icon: any; label: string } }) => {
    const isActive =
      tab.href === "/settings"
        ? pathname === "/settings"
        : pathname.startsWith(tab.href);

    const linkContent = (
      <Link
        href={tab.href}
        className={cn(
          "relative flex items-center gap-3 rounded-xl transition-all",
          collapsed ? "h-11 w-11 justify-center" : "h-11 w-full px-3",
          isActive
            ? "bg-primary/10 text-primary shadow-sm"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <tab.icon
          className={cn("h-5 w-5 shrink-0", isActive && "stroke-[2.5px]")}
        />
        {!collapsed && (
          <span
            className={cn(
              "text-sm font-medium truncate",
              isActive && "font-semibold"
            )}
          >
            {tab.label}
          </span>
        )}
        {tab.href === "/conversations" && totalUnread > 0 && (
          <span
            className={cn(
              "flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-white",
              collapsed
                ? "absolute -top-1 -right-1"
                : "ml-auto"
            )}
          >
            {totalUnread > 99 ? "99+" : totalUnread}
          </span>
        )}
      </Link>
    );

    if (collapsed) {
      return (
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
            <TooltipContent side="right" className="font-semibold">
              {tab.label}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return linkContent;
  };

  return (
    <div
      className={cn(
        "hidden md:flex relative flex-col border-r bg-background py-4 transition-all duration-200",
        collapsed ? "w-[68px] items-center" : "w-[220px]",
        className
      )}
    >
      {/* Collapse toggle */}
      <button
        onClick={toggleCollapsed}
        className="absolute -right-2 top-2 z-50 flex h-4 w-4 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground transition-colors"
      >
        {collapsed ? (
          <ChevronRight className="h-3.5 w-3.5" />
        ) : (
          <ChevronLeft className="h-3.5 w-3.5" />
        )}
      </button>

      {/* App Logo + Brand */}
      <div className={cn("mb-6 flex items-center gap-3", collapsed ? "justify-center px-0" : "px-4")}>
        <AsisLogo size={40} className="shrink-0 text-primary" />
        {!collapsed && (
          <span className="text-lg font-bold tracking-tight -ml-1">asis<span className="text-primary">.chat</span></span>
        )}
      </div>

      {/* Nav items */}
      <div className={cn("flex flex-1 flex-col justify-between w-full", collapsed ? "px-2" : "px-3")}>
        <div className="flex flex-col gap-1">
          {topTabs.map((tab) => (
            <NavItem key={tab.href} tab={tab} />
          ))}
        </div>

        <div className="flex flex-col gap-1 pb-2">
          {bottomTabs.map((tab) => (
            <NavItem key={tab.href} tab={tab} />
          ))}

          {/* Language toggle */}
          <div className="mt-1">
            <LanguageToggle collapsed={collapsed} />
          </div>

          {/* User avatar */}
          <Link
            href="/settings"
            className={cn(
              "mt-3 flex items-center gap-3 border-t pt-3 rounded-xl transition-colors hover:bg-muted cursor-pointer",
              collapsed ? "justify-center" : "px-3"
            )}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 border">
              <User className="h-4 w-4 text-slate-600 dark:text-slate-300" />
            </div>
            {!collapsed && agent && (
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium truncate">{agent.name}</span>
                <span className="text-xs text-muted-foreground truncate capitalize">{agent.role}</span>
              </div>
            )}
          </Link>
        </div>
      </div>
    </div>
  );
}
