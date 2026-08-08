/* Marca fluws: núcleo macizo + órbita de 320°.
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
 * La órbita barre 320° y deja la boca arriba, entre 250° y 290° (en SVG el
 * ángulo crece hacia abajo, así que 270° es arriba). Las puntas del arco caen
 * en (304.6, 122.6) y (207.4, 122.6).
 *
 * Casi cerrada a propósito: con la boca más ancha lee como anillo roto o como
 * spinner de carga, y cerrada del todo lee como el punto de grabar. */
const ORBIT_PATH = "M304.6 122.6A142 142 0 1 1 207.4 122.6";
const ORBIT_STROKE = 46;
const CORE_R = 54;

/* La patita, abajo a la izquierda. NO es un triángulo relleno: es el mismo
 * trazo que sale del anillo, llega a la punta y vuelve. Lo que se ve adentro es
 * el fondo, no una pieza. Por eso va con `fill="none"`.
 *
 * Vértices en polares desde el centro: base a 109° y 159° con r=150 —dentro de
 * la banda del trazo, que va de 119 a 165, para que quede fundida con el
 * anillo— y punta a 134° con r=235.
 *
 * Los brazos van MAS FINOS que la órbita (36 contra 46), y es un canje
 * deliberado: al mismo grosor el hueco queda en una astilla y el efecto se
 * pierde. Se prefirió que el hueco se lea antes que la uniformidad de peso.
 *
 * Se probó también agrandarla para que el hueco se viera más: queda un apéndice
 * en V que compite con el anillo. Chica es la única manera. */
const TAIL_PATH = "M207.2 397.8L92.7 425L115.9 309.8";
const TAIL_STROKE = 36;

/* Bbox real, contando los caps de la órbita y de la patita:
   x 74.7→421, y 99.6→443. El viewBox de `mark` lo encuadra con un respiro
   de 6. */
const MARK_VIEWBOX = "69 94 359 356";
/** Centro real del bbox. No es (256,256): la patita corre el peso abajo a la
 *  izquierda, y sin esto el glifo se descentra al escalarlo. */
const GLYPH_CENTER = { x: 247.85, y: 271.3 };

/** Verde de marca del brand board. Va fijo y no como token: es el ícono de la
 *  marca y no cambia con el tema. Excepción deliberada a la regla de
 *  solo-tokens de DESIGN.md. */
export const FLUWS_GREEN = "#027E5A";
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
        fill="none"
        stroke={color}
        strokeWidth={TAIL_STROKE}
        strokeLinecap="round"
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
        {/* Recentrado, no escalado: el bbox del glifo no está en el centro del
            lienzo porque la patita corre el peso abajo a la izquierda. Sin este
            translate el símbolo queda pegado a esa esquina. */}
        <g
          transform={`translate(256 256) translate(${-GLYPH_CENTER.x} ${-GLYPH_CENTER.y})`}
        >
          <Glyph color="#FFFFFF" />
        </g>
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
