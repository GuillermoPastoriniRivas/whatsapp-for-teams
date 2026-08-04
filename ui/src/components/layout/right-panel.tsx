"use client";

import { useEffect, useRef } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n/use-translations";
import { useMobileNavVisible } from "@/lib/use-mobile-nav-visible";
import { useIsDesktop } from "@/lib/use-is-desktop";

interface RightPanelProps {
  open: boolean;
  onClose: () => void;
  onOpen?: () => void;
  children: React.ReactNode;
  className?: string;
  /** Qué es el panel, para los lectores de pantalla en mobile. */
  label?: string;
}

/**
 * Panel de detalle del patrón maestro-detalle: columna a la derecha en
 * escritorio, pantalla completa en mobile.
 *
 * En mobile tapa toda la app, así que ahí se comporta como un diálogo: se
 * anuncia como tal, recibe el foco, cierra con Escape y bloquea el scroll de
 * atrás. En escritorio es contenido inline y no hace nada de eso.
 */
export function RightPanel({ open, onClose, onOpen, children, className, label }: RightPanelProps) {
  const { t } = useTranslations();
  const navVisible = useMobileNavVisible();
  const isDesktop = useIsDesktop();
  const panelRef = useRef<HTMLDivElement>(null);
  const asDialog = open && !isDesktop;

  useEffect(() => {
    if (!asDialog) return;

    panelRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [asDialog, onClose]);

  if (!open) {
    // Desktop-only collapsed handle
    if (!onOpen) return null;
    return (
      <div className="hidden md:flex relative">
        <button
          onClick={onOpen}
          className="absolute -left-2 top-2 z-(--z-panel) flex h-4 w-4 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground transition-colors"
          aria-label={t.common.back}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <div className="w-1 bg-muted/50 hover:bg-muted transition-colors cursor-pointer h-full" onClick={onOpen} />
      </div>
    );
  }

  return (
    <div
      ref={panelRef}
      role={asDialog ? "dialog" : undefined}
      aria-modal={asDialog ? true : undefined}
      aria-label={asDialog ? label : undefined}
      tabIndex={asDialog ? -1 : undefined}
      className={cn(
        // Mobile: full-screen overlay
        "absolute inset-0 z-(--z-panel) flex flex-col bg-background h-full outline-none",
        // Desktop: inline panel on the right
        "md:relative md:inset-auto md:z-auto md:w-[340px] lg:w-[380px] md:shrink-0 md:border-l",
        className
      )}
    >
      {/* Mobile: back button */}
      <div className="flex items-center h-[52px] px-3 border-b md:hidden">
        <button
          onClick={onClose}
          className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
          <span>{t.common.back}</span>
        </button>
      </div>

      {/* Desktop: chevron on the border */}
      <button
        onClick={onClose}
        aria-label={t.common.back}
        className="absolute -left-2 top-2 z-(--z-panel) hidden md:flex h-4 w-4 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground transition-colors"
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>

      <div className={cn("flex-1 overflow-y-auto md:pb-0", navVisible && "pb-nav-safe")}>
        {children}
      </div>
    </div>
  );
}
