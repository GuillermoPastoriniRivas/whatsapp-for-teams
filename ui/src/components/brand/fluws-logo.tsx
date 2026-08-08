/* Marca fluws: núcleo macizo + órbita de 315°.
 *
 * La forma salió de una exploración larga y conviene saber qué NO volver a
 * proponer, porque cada una se descartó por un motivo concreto:
 * burbuja de chat (literal, y es territorio de Intercom), horquilla o
 * bifurcación (es el glifo de compartir de iOS y Android), monograma "f"
 * (Facebook, y en un producto del ecosistema Meta la colisión es con la
 * familia de al lado), barras de señal limpias (es el ícono de cobertura de la
 * barra de estado del teléfono), abanico de arcos (wifi y RSS), y patita de
 * burbuja sobre este mismo anillo (queda una lupa, o un pin de mapa).
 *
 * El color va PLANO, no en degradado: así lo define el brand board. */

import { useId } from "react";

/* Espacio de 512.
 *
 * La órbita barre 315° y deja la boca arriba, entre 247.5° y 292.5° (en SVG el
 * ángulo crece hacia abajo, así que 270° es arriba). Las puntas del arco caen
 * en (304.6, 122.6) y (207.4, 122.6).
 *
 * Casi cerrada a propósito: con la boca más ancha lee como anillo roto o como
 * spinner de carga, y cerrada del todo lee como el punto de grabar. */
const ORBIT_PATH = "M310.3 124.8A142 142 0 1 1 201.7 124.8";
const ORBIT_STROKE = 46;
const CORE_R = 54;

/* La patita, abajo a la izquierda. Es un triángulo con la base APOYADA SOBRE LA
 * BANDA del trazo de la órbita (los dos vértices de la base están a r=150, y la
 * banda va de 119 a 165), así queda fundida con el anillo en vez de pegada.
 *
 * Vértices en polares desde el centro: base a 118° y 152° con r=150, punta a
 * 136° con r=238.
 *
 * Se dibuja con relleno Y trazo del mismo color: es la forma más simple de
 * redondearle las esquinas a un triángulo en SVG, y deja la patita con el mismo
 * acabado que los caps redondos de la órbita. */
const TAIL_PATH = "M185.6 388.4L84.8 421.3L123.6 326.4Z";
const TAIL_STROKE = 18;

/* Bbox real, contando los caps de la órbita y el trazo de la patita:
   x 75.8→421, y 101.8→430.3. El viewBox de `mark` lo encuadra con un respiro
   de 6. */
const MARK_VIEWBOX = "70 96 357 340";

/**
 * Verde del LOGO.
 *
 * OJO: ya NO coincide con el `--primary` de la interfaz, que es
 * `oklch(0.525 0.110 165)` = `#027E5A`. Se despegaron a propósito: el logo tira
 * más al teal, hacia el verde histórico de asis, y la interfaz se queda en el
 * esmeralda más oscuro, que es el único que aguanta texto blanco encima.
 *
 * O sea que el logo va a verse un tono distinto de los botones, y está bien.
 * Si alguien los "sincroniza", rompe una de las dos cosas.
 *
 * Va fijo y no como token: es el ícono de la marca y no cambia con el tema.
 * Excepción deliberada a la regla de solo-tokens de DESIGN.md.
 */
export const FLUWS_GREEN = "#15A58A";
/** Negro de marca. También el color del wordmark sobre fondo claro. */
export const FLUWS_INK = "#0B0F14";

interface FluwsLogoProps {
  size?: number;
  className?: string;
  /**
   * "mark" = el símbolo suelto en el verde de marca, sobre transparente.
   * "mono" = el mismo símbolo en `currentColor`, para fondos de color donde el
   *          verde desaparecería contra el fondo (el panel de auth). Se tiñe
   *          con `text-*`.
   * "app"  = el símbolo blanco sobre el cuadrado verde. Es el ícono de la app,
   *          y es lo que hereda del logo de asis: cuadrado de color con una
   *          forma blanca adentro.
   */
  variant?: "mark" | "mono" | "app";
}

function Glyph({ color }: { color: string }) {
  return (
    <>
      <path
        d={ORBIT_PATH}
        fill="none"
        stroke={color}
        strokeWidth={ORBIT_STROKE}
        strokeLinecap="round"
      />
      <path
        d={TAIL_PATH}
        fill={color}
        stroke={color}
        strokeWidth={TAIL_STROKE}
        strokeLinejoin="round"
      />
      <circle cx="256" cy="256" r={CORE_R} fill={color} />
    </>
  );
}

export function FluwsLogo({ size = 40, className, variant = "mark" }: FluwsLogoProps) {
  // `useId` solo hace falta si algún día vuelve un degradado o una máscara; el
  // símbolo actual es color plano y no necesita ids únicos.
  useId();

  if (variant === "app") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 512 512"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
      >
        <rect width="512" height="512" rx="115" fill={FLUWS_GREEN} />
        {/* Sin escalar: el glifo ocupa 91→421 de 512, que deja el aire justo
            para que el radio del contenedor no se lo coma. */}
        <Glyph color="#FFFFFF" />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={MARK_VIEWBOX}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <Glyph color={variant === "mono" ? "currentColor" : FLUWS_GREEN} />
    </svg>
  );
}
