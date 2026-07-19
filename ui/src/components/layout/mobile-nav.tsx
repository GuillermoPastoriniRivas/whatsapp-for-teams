"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  MessageSquare,
  Settings,
  Contact,
  Megaphone,
  MoreHorizontal,
  LayoutTemplate,
  Users,
  Phone,
  ChevronRight,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { useConversationStore } from "@/stores/conversation.store";
import { useTranslations } from "@/lib/i18n/use-translations";
import { useMobileNavVisible } from "@/lib/use-mobile-nav-visible";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

// Rutas que viven dentro de "Más": el tab se marca activo en cualquiera de ellas
const MORE_ROUTES = ["/templates", "/agents", "/admin", "/settings", "/notifications"];

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const agent = useAuthStore((s) => s.agent);
  const totalUnread = useConversationStore((s) =>
    s.conversations.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0)
  );
  const { t } = useTranslations();
  const visible = useMobileNavVisible();
  const [moreOpen, setMoreOpen] = useState(false);

  const isAdmin = agent?.role === "admin";

  const tabs = [
    { href: "/conversations", icon: MessageSquare, label: t.nav.chats },
    { href: "/contacts", icon: Contact, label: t.nav.contacts },
    { href: "/campaigns", icon: Megaphone, label: t.nav.campaigns },
  ];

  const moreItems = [
    { href: "/templates", icon: LayoutTemplate, label: t.nav.templates, adminOnly: false },
    { href: "/agents", icon: Users, label: t.nav.team, adminOnly: true },
    { href: "/admin", icon: Phone, label: t.nav.phoneAdmin, adminOnly: true },
    { href: "/settings", icon: Settings, label: t.nav.settings, adminOnly: false },
  ].filter((item) => !item.adminOnly || isAdmin);

  if (!visible) return null;

  const moreActive = MORE_ROUTES.some((r) => pathname.startsWith(r));

  const handleMoreNavigate = (href: string) => {
    setMoreOpen(false);
    router.push(href);
  };

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background md:hidden pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-around">
          {tabs.map((tab) => {
            const isActive = pathname.startsWith(tab.href) && !moreActive;
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

          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-3 text-xs",
              moreActive ? "text-primary" : "text-muted-foreground"
            )}
          >
            <MoreHorizontal className="h-5 w-5" />
            <span>{t.nav.more}</span>
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl pb-[calc(1rem+env(safe-area-inset-bottom))]"
        >
          <SheetHeader>
            <SheetTitle>{t.nav.more}</SheetTitle>
          </SheetHeader>
          <ul className="px-4 pb-2 divide-y">
            {moreItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <button
                    type="button"
                    onClick={() => handleMoreNavigate(item.href)}
                    className={cn(
                      "flex w-full items-center gap-3 py-3.5 text-left text-sm transition-colors",
                      isActive ? "text-primary font-medium" : "hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    <span className="flex-1">{item.label}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                </li>
              );
            })}
          </ul>
        </SheetContent>
      </Sheet>
    </>
  );
}
