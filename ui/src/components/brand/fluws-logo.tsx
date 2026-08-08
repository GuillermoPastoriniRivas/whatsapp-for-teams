/* Marca Fluws: el grafo — un nodo que dispara otros dos. Es el gesto del
   producto (un paso de la automatización que abre dos caminos), dibujado con
   los nodos macizos y las aristas en trazo con caps redondos.

   OJO, dos cosas heredadas de cómo se llegó acá:

   1. La geometría es una construcción propia, no un calco del arte que vino con
      el dominio (aquel era una horquilla, sin nodos). La convención del repo es
      que el arte manda y el SVG es la copia; acá no hay arte que mande todavía.
   2. La silueta es muy cercana al glifo de compartir de iOS y Android. Está
      asumido a propósito, no es un descuido: se eligió sabiéndolo. Si algún día
      molesta, lo que lo despega es mover los nodos de destino fuera del eje
      simétrico o cambiar el nodo de origen de círculo a otra forma. */

import { useId } from "react";

/* Espacio de 512. Los radios son de la LÍNEA MEDIA del anillo: el borde de
   afuera queda a r + STROKE/2.

   Con los nodos huecos hubo que agrandarlos. Un anillo necesita que el hueco
   sea comparable al grosor para leerse: con los radios de la versión maciza
   (50 y 44) el agujero quedaba en 24px contra 100 de diámetro y a simple vista
   volvía a ser un punto lleno. */
const STROKE = 36;
const NODE_IN = { cx: 132, cy: 256, r: 52 };
const NODE_UP = { cx: 372, cy: 152, r: 46 };
const NODE_DOWN = { cx: 372, cy: 360, r: 46 };

/* Aristas RECTAS, sobre la línea que une los centros, recortadas al borde de
   cada anillo. Los extremos entran un poco en el trazo del anillo para que el
   cap redondo quede tapado y no asome dentro del hueco.

   Se probaron curvas saliendo horizontales del nodo de origen y no va: las dos
   arrancan tangentes a la horizontal, se superponen los primeros ~60 y forman
   un tronco grueso que a simple vista parece un cruce en X. Rectas además
   aguantan mejor los tamaños chicos. */
const EDGE_UP = "M204 225L306 180";
const EDGE_DOWN = "M204 287L306 332";

/* Bbox real del glifo: x 62→436, y 88→424 (lo definen los bordes de afuera de
   los anillos, no las aristas). El viewBox de `mark` lo encuadra con un respiro
   de 6, para que el glifo no nade dentro de la caja cuando se renderiza chico. */
const MARK_VIEWBOX = "56 82 386 348";

/** Centro real del bbox. No es 256 en x: el nodo de origen es más grande que
 *  los de destino y corre el peso a la izquierda. */
const GLYPH_CENTER = { x: 249, y: 256 };

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

/** Todo el glifo es trazo: nodos huecos y aristas con el mismo grosor. Las
 *  aristas van primero para que los anillos les tapen los caps. */
function Glyph({ color }: { color: string }) {
  return (
    <g stroke={color} strokeWidth={STROKE} strokeLinecap="round" fill="none">
      <path d={EDGE_UP} />
      <path d={EDGE_DOWN} />
      <circle cx={NODE_IN.cx} cy={NODE_IN.cy} r={NODE_IN.r} />
      <circle cx={NODE_UP.cx} cy={NODE_UP.cy} r={NODE_UP.r} />
      <circle cx={NODE_DOWN.cx} cy={NODE_DOWN.cy} r={NODE_DOWN.r} />
    </g>
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
