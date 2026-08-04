"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  User,
  MessageSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { useConversationStore } from "@/stores/conversation.store";
import { useBillingStore } from "@/stores/billing.store";
import { useTranslations } from "@/lib/i18n/use-translations";
import { cn } from "@/lib/utils";
import { AsisLogo } from "@/components/brand/asis-logo";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { AgentStatusToggle } from "@/components/agent/agent-status-toggle";
import { NavBadge } from "@/components/layout/nav-badge";
import {
  NAV_BOTTOM,
  NAV_SECTIONS,
  isNavActive,
  visibleItems,
  type NavItem,
} from "@/lib/nav-config";
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
    s.conversations.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0)
  );
  const billingPlan = useBillingStore((s) => s.plan);
  const { t } = useTranslations();
  const showWhatsAppSupport = ["pro", "business", "agencies"].includes(billingPlan);

  const [collapsed, setCollapsed] = useState(false);

  /**
   * Con la barra de scroll oculta no queda ninguna pista de que hay más ítems.
   * Se mide el desborde a mano para mostrar el degradado y la flecha del borde.
   */
  const scrollRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState({ top: false, bottom: false });

  const updateOverflow = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    setOverflow({
      top: scrollTop > 4,
      bottom: scrollTop + clientHeight < scrollHeight - 4,
    });
  }, []);

  const scrollToBottom = () => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  };

  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_KEY);
    if (stored === "true") setCollapsed(true);
  }, []);

  // El desborde cambia al colapsar, al redimensionar y cuando aparecen ítems
  // de admin, así que se observa el elemento en vez de medirlo una sola vez.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateOverflow();
    const observer = new ResizeObserver(updateOverflow);
    observer.observe(el);
    for (const child of Array.from(el.children)) observer.observe(child);
    return () => observer.disconnect();
  }, [updateOverflow, collapsed, agent?.role]);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_KEY, String(next));
      return next;
    });
  };

  const isAdmin = agent?.role === "admin";

  const sections = NAV_SECTIONS.map((section) => ({
    title: t.nav[section.titleKey],
    items: visibleItems(section.items, isAdmin),
  })).filter((section) => section.items.length > 0);

  const bottomItems = visibleItems(NAV_BOTTOM, isAdmin);

  const SidebarNavItem = ({ item }: { item: NavItem }) => {
    const label = t.nav[item.labelKey];
    const isActive = isNavActive(pathname, item.href);

    const linkContent = (
      <Link
        href={item.href}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "relative flex items-center gap-3 rounded-xl transition-all",
          collapsed ? "h-11 w-11 justify-center" : "h-11 w-full px-3",
          isActive
            ? "bg-primary/10 text-primary shadow-sm"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <item.icon
          className={cn("h-5 w-5 shrink-0", isActive && "stroke-[2.5px]")}
        />
        {!collapsed && (
          <span
            className={cn(
              "text-sm font-medium truncate",
              isActive && "font-semibold"
            )}
          >
            {label}
          </span>
        )}
        {item.href === "/conversations" && totalUnread > 0 && (
          <NavBadge count={totalUnread} className={collapsed ? "absolute -top-1 -right-1" : "ml-auto"} />
        )}
      </Link>
    );

    if (collapsed) {
      return (
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
            <TooltipContent side="right" className="font-semibold">
              {label}
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
        collapsed ? "w-[68px] items-center" : "w-[240px]",
        className
      )}
    >
      {/* Collapse toggle */}
      <button
        onClick={toggleCollapsed}
        className="absolute -right-2 top-2 z-(--z-nav) flex h-4 w-4 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground transition-colors"
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

      {/* Nav items — el bloque de arriba scrollea, el de abajo queda anclado */}
      <div className={cn("flex flex-1 flex-col min-h-0 w-full", collapsed ? "px-2" : "px-3")}>
        <div className="relative flex flex-1 min-h-0">
          <div
            ref={scrollRef}
            onScroll={updateOverflow}
            className="scrollbar-subtle flex flex-1 flex-col gap-4 min-h-0 overflow-y-auto pb-4"
          >
            {sections.map((section, i) => (
              <div key={section.title} className="flex flex-col gap-1">
                {collapsed ? (
                  // Colapsado no hay lugar para el título: separa con una línea,
                  // salvo antes del primer grupo donde no hay nada que separar.
                  i > 0 && <div className="mx-auto my-1 h-px w-6 bg-border" />
                ) : (
                  <span className="px-3 pb-0.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {section.title}
                  </span>
                )}
                {section.items.map((item) => (
                  <SidebarNavItem key={item.href} item={item} />
                ))}
              </div>
            ))}
          </div>

          {/* Degradado arriba: solo avisa que quedó contenido atrás */}
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-background to-transparent transition-opacity duration-150",
              overflow.top ? "opacity-100" : "opacity-0"
            )}
          />

          {/* Abajo el degradado no alcanza: sin barra visible hay que decir que
              hay más. La flecha desaparece al llegar al final. */}
          <button
            type="button"
            aria-hidden={!overflow.bottom}
            tabIndex={-1}
            onClick={scrollToBottom}
            className={cn(
              "absolute inset-x-0 bottom-0 flex h-10 items-end justify-center bg-gradient-to-t from-background via-background/90 to-transparent transition-opacity duration-150",
              overflow.bottom
                ? "opacity-100"
                : "pointer-events-none opacity-0"
            )}
          >
            <ChevronDown className="h-4 w-4 animate-nudge-down text-muted-foreground" />
          </button>
        </div>

        <div className="flex shrink-0 flex-col gap-1 border-t pt-2 pb-2">
          {bottomItems.map((item) => (
            <SidebarNavItem key={item.href} item={item} />
          ))}

          {/* WhatsApp support */}
          {showWhatsAppSupport && (
            collapsed ? (
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <a
                      href="https://wa.me/5493442670825"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
                    >
                      <MessageSquare className="h-5 w-5 shrink-0" />
                    </a>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="font-semibold">
                    {t.billing.whatsappSupport}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <a
                href="https://wa.me/5493442670825"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-11 w-full items-center gap-3 rounded-xl px-3 text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
              >
                <MessageSquare className="h-5 w-5 shrink-0" />
                <span className="text-sm font-medium">{t.billing.whatsappSupport}</span>
              </a>
            )
          )}

          {/* Language toggle */}
          <div className="mt-1">
            <LanguageToggle collapsed={collapsed} />
          </div>

          {/* Disponibilidad: vivía solo en el header de mobile, así que en
              escritorio no había forma de cambiarla. */}
          <div className={cn("mt-1", collapsed ? "flex justify-center" : "px-1")}>
            <AgentStatusToggle collapsed={collapsed} />
          </div>

          {/* User avatar */}
          <Link
            href="/settings"
            className={cn(
              "mt-3 flex items-center gap-3 border-t pt-3 rounded-xl transition-colors hover:bg-muted cursor-pointer",
              collapsed ? "justify-center" : "px-3"
            )}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-muted text-muted-foreground">
              <User className="h-4 w-4" />
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
