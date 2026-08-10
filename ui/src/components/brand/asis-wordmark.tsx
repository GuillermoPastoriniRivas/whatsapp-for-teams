import { cn } from "@/lib/utils";
import { ASIS_GREEN } from "./asis-logo";

/**
 * El wordmark de marca: "asis.chat" en minúscula, en la tipografía de marca.
 *
 * Va acá y no como un `<span>` suelto en cada lockup para que la familia, el
 * peso, el color y el interletrado se definan en un solo lugar: eran seis
 * copias con clases distintas y ya habían empezado a divergir.
 *
 * VA A DOS COLORES: "asis" hereda el color del texto de alrededor y ".chat"
 * lleva el verde de marca. El ".chat" es parte del nombre, no un dominio pegado
 * atrás, y el acento verde es lo que lo dice.
 *
 * El "asis" hereda en vez de ir blanco literal, y esa diferencia importa: sobre
 * el sidebar oscuro y el landing se ve blanco, que es lo que se busca, pero
 * sobre las superficies claras —términos, privacidad, precios— se ve oscuro.
 * Blanco fijo lo haría desaparecer en tema claro.
 *
 * El verde sí va literal y no por token, igual que el símbolo: es marca y no
 * cambia con el tema. Es la misma excepción a la regla de solo-tokens de
 * DESIGN.md que ya tiene `AsisLogo`.
 *
 * OJO CON EL CONTRASTE: el verde da 2.15:1 contra blanco. Como logotipo está
 * permitido —WCAG exime a los logotipos del mínimo de contraste— y ahora pesa
 * menos que antes, porque solo lo lleva el ".chat" y no la palabra entera.
 */
export function AsisWordmark({
  className,
  tone = "brand",
  style,
}: {
  className?: string;
  /**
   * "brand" = "asis" heredado + ".chat" en verde de marca.
   * "ink"   = TODO heredado, sin verde. Es para fondos de color donde el verde
   *           desaparecería: el panel de auth es verde, y ahí un ".chat" verde
   *           sobre verde no se vería. No es una preferencia estética, es la
   *           única variante legible en esa superficie.
   */
  tone?: "brand" | "ink";
  /** Lo usa `AsisLockup` para derivar el cuerpo y el ajuste óptico del tamaño
   *  del símbolo, que no se puede expresar con la escala de Tailwind. */
  style?: React.CSSProperties;
}) {
  return (
    <span
      className={cn("font-brand font-semibold tracking-tight", className)}
      style={style}
    >
      asis
      <span style={tone === "brand" ? { color: ASIS_GREEN } : undefined}>
        .chat
      </span>
    </span>
  );
}
