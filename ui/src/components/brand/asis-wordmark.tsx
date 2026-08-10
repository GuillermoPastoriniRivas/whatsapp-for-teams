import { cn } from "@/lib/utils";
import { ASIS_GREEN } from "./asis-logo";

/**
 * El wordmark de marca: "asis.chat" en minúscula, en la tipografía de marca y en el
 * verde del símbolo.
 *
 * Va acá y no como un `<span>` suelto en cada lockup para que la familia, el
 * peso, el color y el interletrado se definan en un solo lugar: eran seis
 * copias con clases distintas y ya habían empezado a divergir.
 *
 * El color va literal y no por token, igual que el símbolo: es marca y no
 * cambia con el tema. Es la misma excepción a la regla de solo-tokens de
 * DESIGN.md que ya tiene `AsisLogo`.
 *
 * OJO CON EL CONTRASTE: el verde da 2.15:1 contra blanco. Como logotipo está
 * permitido —WCAG exime a los logotipos del mínimo de contraste— pero sobre
 * fondo claro se ve lavado. Si algún día molesta, la salida es `tone="ink"`
 * para las superficies claras, que ya está implementado acá abajo.
 *
 * El nombre va COMPLETO y en un solo color, "asis.chat", no "asis" a secas: el
 * ".chat" es parte de la marca, no un dominio pegado atrás.
 *
 * Hubo una etapa en que el ".chat" iba en otro color que el "asis". Se dejó de
 * lado al unificar el lockup: con el símbolo al lado, dos colores en la palabra
 * compiten con él y el conjunto deja de leerse como una unidad.
 */
export function AsisWordmark({
  className,
  tone = "brand",
  style,
}: {
  className?: string;
  /** "brand" = verde de marca. "ink" = hereda el color del texto de alrededor. */
  tone?: "brand" | "ink";
  /** Lo usa `AsisLockup` para derivar el cuerpo y el ajuste óptico del tamaño
   *  del símbolo, que no se puede expresar con la escala de Tailwind. */
  style?: React.CSSProperties;
}) {
  return (
    <span
      className={cn("font-brand font-semibold tracking-tight", className)}
      style={{ ...(tone === "brand" ? { color: ASIS_GREEN } : null), ...style }}
    >
      asis.chat
    </span>
  );
}
