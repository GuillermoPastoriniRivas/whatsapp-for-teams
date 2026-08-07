import { useId } from "react";

/* Geometría y colores calcados del arte original (ui/public/icons/icon-1024.png),
   medidos pixel a pixel sobre el render de 512. Antes esto era una recreación a
   ojo y se notaba: la burbuja quedaba chica, las líneas cortas y el degradado
   era vertical cuando el del arte es diagonal.

   Si el arte cambia, volver a medir: el PNG es la fuente, este SVG es la copia. */

/**
 * Burbuja + cola, en el espacio de 512.
 * Cuerpo x 110→391, y 130→350, radio 42. La cola baja con el borde izquierdo
 * recto en x=229 hasta la punta (229, 395) y vuelve en diagonal a (273, 350).
 */
const BUBBLE_PATH =
  "M152 130H349A42 42 0 0 1 391 172V308A42 42 0 0 1 349 350H273L229 395V350H152A42 42 0 0 1 110 308V172A42 42 0 0 1 152 130Z";

/* Colores muestreados del arte. Van fijos y no como tokens: la variante "full"
   es el icono de la app, y un icono de marca no cambia de color con el tema. Es
   una de las excepciones deliberadas a la regla de solo-tokens de DESIGN.md. */
const BRAND_FROM = "#46C7AC"; // arriba-izquierda
const BRAND_TO = "#16A08A"; // abajo-derecha
const MINT_FROM = "#2BBBA0";
const MINT_TO = "#1CA187";
const BRAND_LINE = "#199C82";

/** Desplazamiento de la capa mint que asoma detrás de la burbuja. */
const MINT_OFFSET = { x: 24, y: 13 };

interface AsisLogoProps {
  size?: number;
  className?: string;
  /**
   * Solo aplica a `variant="bubble"`, que es el glifo monocromo y sí se tiñe.
   * La variante `full` ignora esto a propósito: si tomara `currentColor`, con
   * `text-primary` el fondo del logo se volvería mint en dark mode.
   */
  color?: string;
  /** "full" = cuadrado redondeado + burbuja blanca; "bubble" = solo la burbuja */
  variant?: "full" | "bubble";
}

export function AsisLogo({
  size = 40,
  className,
  color = "currentColor",
  variant = "full",
}: AsisLogoProps) {
  const id = useId().replace(/:/g, "");
  const filterId = `asis-shadow-${id}`;
  const bgId = `asis-bg-${id}`;
  const mintId = `asis-mint-${id}`;

  if (variant === "bubble") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="110 130 281 265"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
      >
        <path d={BUBBLE_PATH} fill={color} />
        <path d="M180 227H236" stroke="white" strokeWidth="13" strokeLinecap="round" />
        <path d="M180 261H296" stroke="white" strokeWidth="13" strokeLinecap="round" />
      </svg>
    );
  }

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
        {/* Diagonal, no vertical: en el arte la esquina superior derecha es más
            oscura que la inferior izquierda, así que x pesa más que y. */}
        <linearGradient id={bgId} x1="0" y1="0" x2="1" y2="0.63">
          <stop offset="0" stopColor={BRAND_FROM} />
          <stop offset="1" stopColor={BRAND_TO} />
        </linearGradient>
        <linearGradient id={mintId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={MINT_FROM} />
          <stop offset="1" stopColor={MINT_TO} />
        </linearGradient>
        <filter id={filterId} x="-10%" y="-10%" width="130%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#0b6b57" floodOpacity="0.32" />
        </filter>
      </defs>

      <rect width="512" height="512" rx="100" fill={`url(#${bgId})`} />

      {/* Capa mint desplazada, que asoma a la derecha y abajo de la burbuja
          blanca, igual que en el arte. */}
      <path
        d={BUBBLE_PATH}
        fill={`url(#${mintId})`}
        transform={`translate(${MINT_OFFSET.x} ${MINT_OFFSET.y})`}
      />

      <path d={BUBBLE_PATH} fill="white" filter={`url(#${filterId})`} />

      <path d="M180 227H236" stroke={BRAND_LINE} strokeWidth="13" strokeLinecap="round" />
      <path d="M180 261H296" stroke={BRAND_LINE} strokeWidth="13" strokeLinecap="round" />
    </svg>
  );
}
