import { cn } from "@/lib/utils";
import { FLUWS_GREEN } from "./fluws-logo";

/**
 * El wordmark de marca: "fluws" en minúscula, en la tipografía de marca y en el
 * verde del símbolo.
 *
 * Va acá y no como un `<span>` suelto en cada lockup para que la familia, el
 * peso, el color y el interletrado se definan en un solo lugar: eran seis
 * copias con clases distintas y ya habían empezado a divergir.
 *
 * El color va literal y no por token, igual que el símbolo: es marca y no
 * cambia con el tema. Es la misma excepción a la regla de solo-tokens de
 * DESIGN.md que ya tiene `FluwsLogo`.
 *
 * OJO CON EL CONTRASTE: el verde da 2.15:1 contra blanco. Como logotipo está
 * permitido —WCAG exime a los logotipos del mínimo de contraste— pero sobre
 * fondo claro se ve lavado. Si algún día molesta, la salida es `tone="ink"`
 * para las superficies claras, que ya está implementado acá abajo.
 */
export function FluwsWordmark({
  className,
  tone = "brand",
  style,
}: {
  className?: string;
  /** "brand" = verde de marca. "ink" = hereda el color del texto de alrededor. */
  tone?: "brand" | "ink";
  /** Lo usa `FluwsLockup` para derivar el cuerpo y el ajuste óptico del tamaño
   *  del símbolo, que no se puede expresar con la escala de Tailwind. */
  style?: React.CSSProperties;
}) {
  return (
    <span
      className={cn("font-brand font-semibold tracking-tight", className)}
      style={{ ...(tone === "brand" ? { color: FLUWS_GREEN } : null), ...style }}
    >
      fluws
    </span>
  );
}
