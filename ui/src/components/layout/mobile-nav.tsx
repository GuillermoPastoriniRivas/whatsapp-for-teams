"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { MoreHorizontal, ChevronRight } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { useConversationStore } from "@/stores/conversation.store";
import { useTranslations } from "@/lib/i18n/use-translations";
import { useMobileNavVisible } from "@/lib/use-mobile-nav-visible";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { NavBadge } from "@/components/layout/nav-badge";
import { MOBILE_TABS, isNavActive, mobileMoreItems } from "@/lib/nav-config";
import { cn } from "@/lib/utils";

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
  const moreItems = mobileMoreItems(isAdmin);

  if (!visible) return null;

  // Todo lo que no es tab vive en "Más": el botón se marca activo si estamos en
  // cualquiera de esas rutas.
  const moreActive = moreItems.some((item) => isNavActive(pathname, item.href));

  const handleMoreNavigate = (href: string) => {
    setMoreOpen(false);
    router.push(href);
  };

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-(--z-nav) border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden">
        <div className="flex items-center justify-around">
          {MOBILE_TABS.map((tab) => {
            const isActive = isNavActive(pathname, tab.href) && !moreActive;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex min-h-11 flex-1 flex-col items-center gap-1 py-3 text-xs",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                <span className="relative">
                  <tab.icon className="h-5 w-5" />
                  {tab.href === "/conversations" && (
                    <NavBadge
                      count={totalUnread}
                      className="absolute -top-2 -right-3"
                    />
                  )}
                </span>
                <span>{t.nav[tab.labelKey]}</span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-expanded={moreOpen}
            className={cn(
              "flex min-h-11 flex-1 flex-col items-center gap-1 py-3 text-xs",
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
          className="max-h-[85dvh] rounded-t-2xl pb-[calc(1rem+env(safe-area-inset-bottom))]"
        >
          <SheetHeader className="shrink-0">
            <SheetTitle>{t.nav.more}</SheetTitle>
          </SheetHeader>
          {/* La lista scrollea sola: con la barra del navegador o en teléfonos
              cortos, los últimos ítems quedaban fuera de pantalla sin salida. */}
          <ul className="min-h-0 flex-1 divide-y overflow-y-auto px-4 pb-2">
            {moreItems.map((item) => {
              const isActive = isNavActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <button
                    type="button"
                    onClick={() => handleMoreNavigate(item.href)}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 w-full items-center gap-3 py-3.5 text-left text-sm transition-colors",
                      isActive ? "font-medium text-primary" : "hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    <span className="flex-1">{t.nav[item.labelKey]}</span>
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
