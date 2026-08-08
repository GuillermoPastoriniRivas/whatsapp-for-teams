/* Marca Fluws: la horquilla — un tallo que se abre en dos ramas hacia la
   derecha. Es el gesto del producto (una conversación que se bifurca en un
   flujo), así que se dibuja con trazo y caps redondos, no con relleno.

   OJO: esto está reconstruido a partir de una captura del arte, no calcado del
   archivo original. La convención del repo es que el arte manda y el SVG es la
   copia (ver la nota de marca en mdvault). Cuando aparezca el PNG/SVG en alta,
   hay que volver a medir: geometría y paradas del degradado son estimaciones. */

import { useId } from "react";

/* Espacio de 512. El tallo entra por la izquierda a media altura y se abre en
   dos ramas simétricas.

   Proporción sacada del arte: alto 270 y ancho 343 con los caps incluidos
   (razón 1.27), de donde salen el arranque del tallo en x=116 y las puntas en
   x=396, y=256±104.

   El primer punto de control se queda pegado al cruce (x=276, apenas 36 más a
   la derecha) a propósito: si se estira, las ramas se abrazan a la horizontal y
   la bifurcación engorda hasta parecer una mancha. El segundo cae un poco por
   fuera de la recta cruce→punta, que es lo que le da el arqueo suave. */
const STEM_PATH = "M116 256H272";
const UPPER_ARM = "M272 256C304 256 336 212 396 152";
const LOWER_ARM = "M272 256C304 256 336 300 396 360";

/** Grosor del trazo en el espacio de 512, con cap redondo. */
const STROKE = 62;

/* Bbox real del glifo con los caps incluidos: x 85→427, y 121→391. El viewBox
   de `mark` lo encuadra con un respiro de 6, para que el glifo no nade dentro
   de la caja cuando se renderiza chico. */
const MARK_VIEWBOX = "79 115 354 282";

/* Teal de marca muestreado del arte: oscuro en el tallo, mint en las puntas.
   Van fijos y no como tokens: es el ícono de la marca y no cambia con el tema.
   Misma excepción deliberada a la regla de solo-tokens de DESIGN.md que tenía
   el logo anterior. */
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
   * "mark" = la horquilla sola sobre transparente, como en el arte. Lleva el
   *          degradado de marca fijo: no toma `currentColor` ni sigue al tema.
   * "mono" = la misma horquilla en `currentColor`, para fondos de color donde
   *          el teal desaparecería contra el fondo (el panel de auth, por
   *          ejemplo, que ya es teal). Se tiñe con `text-*`.
   * "app"  = la horquilla en blanco sobre el cuadrado teal; es la que se usa
   *          para generar los íconos de PWA y el favicon.
   */
  variant?: "mark" | "mono" | "app";
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
          transform="translate(256 256) scale(0.72) translate(-256 -256)"
          stroke="white"
          strokeWidth={STROKE}
          strokeLinecap="round"
        >
          <path d={STEM_PATH} />
          <path d={UPPER_ARM} />
          <path d={LOWER_ARM} />
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
          {/* Casi horizontal: en el arte lo oscuro es el tallo (izquierda) y
              las dos puntas son mint, así que x pesa mucho más que y. */}
          <linearGradient id={gradientId} x1="0" y1="0.6" x2="1" y2="0.25">
            <stop offset="0" stopColor={TEAL_DARK} />
            <stop offset="0.5" stopColor={TEAL_MID} />
            <stop offset="1" stopColor={TEAL_LIGHT} />
          </linearGradient>
        </defs>
      )}

      <g
        stroke={variant === "mono" ? "currentColor" : `url(#${gradientId})`}
        strokeWidth={STROKE}
        strokeLinecap="round"
      >
        <path d={STEM_PATH} />
        <path d={UPPER_ARM} />
        <path d={LOWER_ARM} />
      </g>
    </svg>
  );
}
