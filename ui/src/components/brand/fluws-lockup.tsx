import { cn } from "@/lib/utils";
import { FluwsLogo } from "./fluws-logo";
import { FluwsWordmark } from "./fluws-wordmark";

/**
 * Símbolo + wordmark, con la relación entre los dos definida en UN solo lugar.
 *
 * Antes cada pantalla armaba su propio lockup a mano y las proporciones habían
 * divergido: el sidebar iba 40px de símbolo con 24px de texto (0.60), el panel
 * de auth 44 con 20 (0.45) y el header 32 con 16 (0.50). Se veían desparejos
 * entre pantallas y cada lockup nuevo era otra decisión a ojo.
 *
 * Acá solo se elige el tamaño del símbolo; todo lo demás se deriva.
 */

/**
 * Cuerpo del wordmark como fracción del alto del símbolo.
 *
 * Con 0.68 los ascendentes de la "f" y la "l" llegan casi al alto del símbolo,
 * que es lo que hace que se lea como una unidad. Más abajo (0.50–0.56) el texto
 * queda enano al lado; más arriba (0.75) la palabra se come al símbolo.
 */
const TEXT_RATIO = 0.68;

/** Espacio entre símbolo y palabra, también relativo al símbolo. */
const GAP_RATIO = 0.24;

/**
 * Corrección óptica vertical, como fracción del símbolo.
 *
 * "fluws" no tiene descendentes y sí ascendentes en la "f" y la "l", así que su
 * masa de tinta queda por encima del centro de la caja de línea. Centrado sin
 * más, el texto se ve flotando alto respecto del símbolo. Esto lo baja.
 */
const OPTICAL_NUDGE_RATIO = 0.045;

export function FluwsLockup({
  size = 40,
  variant = "mark",
  tone = "brand",
  className,
}: {
  /** Alto del símbolo en px. Todo lo demás se deriva de acá. */
  size?: number;
  /** Se pasa tal cual al símbolo. `mono` lo tiñe con el color heredado. */
  variant?: "mark" | "mono";
  /** Se pasa tal cual al wordmark. `ink` lo deja heredar el color. */
  tone?: "brand" | "ink";
  className?: string;
}) {
  return (
    <span
      className={cn("inline-flex items-center", className)}
      style={{ gap: size * GAP_RATIO }}
    >
      <FluwsLogo size={size} variant={variant} className="shrink-0" />
      <FluwsWordmark
        tone={tone}
        className="leading-none"
        style={{
          fontSize: size * TEXT_RATIO,
          transform: `translateY(${size * OPTICAL_NUDGE_RATIO}px)`,
        }}
      />
    </span>
  );
}
