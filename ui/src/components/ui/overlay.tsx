"use client";

import { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

const noop = () => () => {};

/**
 * `true` solo en el cliente. `useSyncExternalStore` con snapshots distintos
 * para servidor y cliente es la forma que React entiende como "esto cambia al
 * hidratar": no dispara warning de mismatch ni setState dentro de un efecto.
 */
function useIsClient(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

interface OverlayProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Clases del contenedor que centra el contenido. */
  className?: string;
  label?: string;
}

/**
 * Capa modal a pantalla completa.
 *
 * Portalea a `document.body` a propósito: el `<main>` de la app lleva
 * `zoom: 1.15` (clase `content-zoom`) y **`zoom` crea un containing block para
 * `position: fixed`**. Un overlay renderizado dentro del árbol de la página se
 * posiciona respecto de `<main>` en vez del viewport, y aparece corrido y
 * tapado por los paneles vecinos. Los componentes de radix no sufren esto
 * porque también portalean.
 *
 * Además: cierra con Escape y bloquea el scroll del fondo mientras está abierto.
 */
export function Overlay({ open, onClose, children, className, label }: OverlayProps) {
  // `document` no existe en el render del servidor.
  const isClient = useIsClient();

  useEffect(() => {
    if (!open) return;

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
  }, [open, onClose]);

  if (!open || !isClient) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className={cn(
        "fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-0 sm:p-4",
        className
      )}
      onClick={onClose}
    >
      {/* El click adentro no cierra; el de afuera sí. */}
      <div className="contents" onClick={(event) => event.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body
  );
}
