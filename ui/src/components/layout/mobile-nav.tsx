"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquare, Settings, Shield, Users, Contact, Megaphone } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { useConversationStore } from "@/stores/conversation.store";
import { useTranslations } from "@/lib/i18n/use-translations";
import { cn } from "@/lib/utils";

export function MobileNav() {
  const pathname = usePathname();
  const agent = useAuthStore((s) => s.agent);
  const totalUnread = useConversationStore((s) =>
    Object.values(s.unreadCounts).reduce((sum, n) => sum + n, 0)
  );
  const { t } = useTranslations();

  const tabs = [
    { href: "/conversations", icon: MessageSquare, label: t.nav.chats },
    { href: "/contacts", icon: Contact, label: t.nav.contacts },
    { href: "/campaigns", icon: Megaphone, label: t.nav.campaigns },
    ...(agent?.role === "admin"
      ? [
          { href: "/agents", icon: Users, label: t.nav.agents },
          { href: "/admin", icon: Shield, label: t.nav.admin },
        ]
      : []),
    { href: "/settings", icon: Settings, label: t.nav.settings },
  ];

  // Hide nav on login page or when inside a chat on mobile
  if (pathname === "/login") return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background md:hidden">
      <div className="flex items-center justify-around">
        {tabs.map((tab) => {
          const isActive =
            pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-3 text-xs",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <span className="relative">
                <tab.icon className="h-5 w-5" />
                {tab.href === "/conversations" && totalUnread > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-white">
                    {totalUnread > 99 ? "99+" : totalUnread}
                  </span>
                )}
              </span>
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
