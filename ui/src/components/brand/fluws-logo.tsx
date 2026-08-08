/* Marca Fluws: el grafo — un nodo que dispara otros dos. Es el gesto del
   producto: un paso de la automatización que abre dos caminos.

   La geometría es LITERAL del boceto que se eligió (concepto B de
   api/scripts/fluws-logo-concepts.js). No tocarla "para mejorarla": ya se
   probó con los nodos huecos y las aristas rectas, y el resultado no era el
   boceto. Si hay que iterar, se itera primero en la hoja de contacto y recién
   después se baja acá.

   La silueta es muy cercana al glifo de compartir de iOS y Android. Está
   asumido a propósito, no es un descuido. Si algún día molesta, lo que lo
   despega es mover los nodos de destino fuera del eje simétrico o cambiarle la
   forma al nodo de origen. */

import { useId } from "react";

/* Espacio de 512. Nodos macizos y aristas curvas de grosor 40.

   Las aristas arrancan y terminan pisando los círculos (x=186 cae dentro del
   nodo de origen, y las puntas quedan a ~45 del centro de los de destino, que
   tienen radio 44), así los caps redondos quedan tapados y no asoman como
   muñones sueltos. */
const STROKE = 40;
const NODE_IN = { cx: 136, cy: 256, r: 50 };
const NODE_UP = { cx: 374, cy: 154, r: 44 };
const NODE_DOWN = { cx: 374, cy: 358, r: 44 };

const EDGE_UP = "M186 256C248 256 262 178 330 162";
const EDGE_DOWN = "M186 256C248 256 262 334 330 350";

/* Bbox real del glifo: x 86→418, y 110→402 (lo definen los círculos, no las
   aristas). El viewBox de `mark` lo encuadra con un respiro de 6, para que el
   glifo no nade dentro de la caja cuando se renderiza chico. */
const MARK_VIEWBOX = "80 104 344 304";

/** Centro real del bbox. No es 256 en x: el nodo de origen es más grande que
 *  los de destino y corre el peso a la izquierda. */
const GLYPH_CENTER = { x: 252, y: 256 };

/* Teal de marca muestreado del arte original: oscuro a la izquierda, mint a la
   derecha. Van fijos y no como tokens: es el ícono de la marca y no cambia con
   el tema. Excepción deliberada a la regla de solo-tokens de DESIGN.md. */
const TEAL_DARK = "#0FA292";
const TEAL_MID = "#23C7A6";
const TEAL_LIGHT = "#4AE4BC";

/** Navy del wordmark. El lockup lo dibuja el llamador como texto, con los
 *  tokens del tema; esto queda para donde haga falta el color literal de
 *  marca (arte exportado, emails, og:image). */
export const FLUWS_NAVY = "#101A2B";

interface FluwsLogoProps {
  size?: number;
  className?: string;
  /**
   * "mark" = el grafo sobre transparente. Lleva el degradado de marca fijo: no
   *          toma `currentColor` ni sigue al tema.
   * "mono" = el mismo grafo en `currentColor`, para fondos de color donde el
   *          teal desaparecería contra el fondo (el panel de auth, por ejemplo,
   *          que ya es teal). Se tiñe con `text-*`.
   * "app"  = el grafo en blanco sobre el cuadrado teal; es la que se usa para
   *          generar los íconos de PWA y el favicon.
   */
  variant?: "mark" | "mono" | "app";
}

/** Aristas de `stroke`, nodos de `fill`, con el mismo color. Las aristas van
 *  primero para que los círculos les tapen los caps. */
function Glyph({ color }: { color: string }) {
  return (
    <>
      <g stroke={color} strokeWidth={STROKE} strokeLinecap="round" fill="none">
        <path d={EDGE_UP} />
        <path d={EDGE_DOWN} />
      </g>
      <circle cx={NODE_IN.cx} cy={NODE_IN.cy} r={NODE_IN.r} fill={color} />
      <circle cx={NODE_UP.cx} cy={NODE_UP.cy} r={NODE_UP.r} fill={color} />
      <circle cx={NODE_DOWN.cx} cy={NODE_DOWN.cy} r={NODE_DOWN.r} fill={color} />
    </>
  );
}

export function FluwsLogo({ size = 40, className, variant = "mark" }: FluwsLogoProps) {
  const id = useId().replace(/:/g, "");
  const gradientId = `fluws-teal-${id}`;

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
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0.72">
            <stop offset="0" stopColor={TEAL_LIGHT} />
            <stop offset="1" stopColor={TEAL_DARK} />
          </linearGradient>
        </defs>

        <rect width="512" height="512" rx="100" fill={`url(#${gradientId})`} />

        {/* El glifo al 72% para que respire dentro del cuadrado redondeado y no
            se coma el radio de la máscara con la que se generan los íconos. */}
        <g
          transform={`translate(256 256) scale(0.72) translate(${-GLYPH_CENTER.x} ${-GLYPH_CENTER.y})`}
        >
          <Glyph color="white" />
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
      {variant === "mark" && (
        <defs>
          {/* Casi horizontal: en el arte lo oscuro está a la izquierda y lo
              mint a la derecha, así que x pesa mucho más que y. */}
          <linearGradient id={gradientId} x1="0" y1="0.6" x2="1" y2="0.25">
            <stop offset="0" stopColor={TEAL_DARK} />
            <stop offset="0.5" stopColor={TEAL_MID} />
            <stop offset="1" stopColor={TEAL_LIGHT} />
          </linearGradient>
        </defs>
      )}

      <Glyph color={variant === "mono" ? "currentColor" : `url(#${gradientId})`} />
    </svg>
  );
}
