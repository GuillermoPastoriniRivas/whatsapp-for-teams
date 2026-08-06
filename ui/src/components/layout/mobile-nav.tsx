"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Grip } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { useConversationStore } from "@/stores/conversation.store";
import { useTranslations } from "@/lib/i18n/use-translations";
import { useMobileNavVisible } from "@/lib/use-mobile-nav-visible";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { NavBadge } from "@/components/layout/nav-badge";
import { isNavActive, mobileMoreItems, mobileTabs } from "@/lib/nav-config";
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
  const tabs = mobileTabs(isAdmin);
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
          {tabs.map((tab) => {
            const isActive = isNavActive(pathname, tab.href) && !moreActive;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex min-h-11 flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium",
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
                <span className="max-w-full truncate">
                  {t.nav[tab.tabLabelKey ?? tab.labelKey]}
                </span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-expanded={moreOpen}
            className={cn(
              "flex min-h-11 flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium",
              moreActive ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Grip className="h-5 w-5" />
            <span>{t.nav.menu}</span>
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85dvh] rounded-t-2xl pb-[calc(1rem+env(safe-area-inset-bottom))]"
        >
          <SheetHeader className="shrink-0">
            <SheetTitle>{t.nav.menu}</SheetTitle>
          </SheetHeader>
          {/* Grilla de botones en vez de lista apilada: se abarca todo de un
              vistazo y el destino queda al alcance del pulgar. Scrollea sola
              porque en teléfonos cortos los últimos ítems se salían de pantalla. */}
          <div className="grid min-h-0 flex-1 grid-cols-3 gap-2 overflow-y-auto px-4 pb-2">
            {moreItems.map((item) => {
              const isActive = isNavActive(pathname, item.href);
              return (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => handleMoreNavigate(item.href)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border px-2 py-3 text-center text-xs font-medium transition-colors",
                    isActive
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "bg-card text-foreground hover:bg-muted"
                  )}
                >
                  <item.icon className="h-6 w-6 shrink-0" />
                  <span className="leading-tight text-balance">{t.nav[item.labelKey]}</span>
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
