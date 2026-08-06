import { useId } from "react";

/** Contorno de la burbuja. Compartido por las dos variantes y por la capa mint. */
const BUBBLE_PATH =
  "M120 185C120 163.46 137.46 146 159 146H353C374.54 146 392 163.46 392 185V310C392 331.54 374.54 349 353 349H280L240 389V349H159C137.46 349 120 331.54 120 310V185Z";

/* Colores de marca, muestreados del arte original. Van fijos y no como tokens:
   la variante "full" es el icono de la app, y un icono de marca no cambia de
   color con el tema. Es una de las excepciones deliberadas a la regla de
   solo-tokens de DESIGN.md, junto con el degradado del logo. */
const BRAND_TOP = "#3BC0A5";
const BRAND_BOTTOM = "#2DB298";
const BRAND_LINE = "#159578";
const ACCENT_MINT = "#2BBBA1";

interface AsisLogoProps {
  size?: number;
  className?: string;
  /**
   * Solo aplica a `variant="bubble"`, que es el glifo monocromo y sí se tiñe.
   * La variante `full` ignora esto a propósito: si tomara `currentColor`, con
   * `text-primary` el fondo del logo se volvería mint en dark mode.
   */
  color?: string;
  /** "full" = rounded rect bg + white bubble; "bubble" = just the colored bubble, tight crop */
  variant?: "full" | "bubble";
}

export function AsisLogo({
  size = 40,
  className,
  color = "currentColor",
  variant = "full",
}: AsisLogoProps) {
  const id = useId();
  const filterId = `asis-shadow-${id.replace(/:/g, "")}`;
  const gradientId = `asis-bg-${id.replace(/:/g, "")}`;

  if (variant === "bubble") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="110 136 292 263"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
      >
        <path d={BUBBLE_PATH} fill={color} />
        <path d="M190 235L240 235" stroke="white" strokeWidth="14" strokeLinecap="round" />
        <path d="M190 267L300 267" stroke="white" strokeWidth="14" strokeLinecap="round" />
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
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={BRAND_TOP} />
          <stop offset="1" stopColor={BRAND_BOTTOM} />
        </linearGradient>
        <filter id={filterId} x="-10%" y="-10%" width="130%" height="140%">
          <feDropShadow
            dx="0"
            dy="4"
            stdDeviation="6"
            floodColor="#1a6b59"
            floodOpacity="0.35"
          />
        </filter>
      </defs>
      <rect width="512" height="512" rx="120" fill={`url(#${gradientId})`} />
      {/* Capa mint desplazada, que asoma abajo y a la derecha de la burbuja
          blanca, igual que en el arte del icono. */}
      <path
        d={BUBBLE_PATH}
        fill={ACCENT_MINT}
        transform="translate(18 16)"
      />
      <path
        d={BUBBLE_PATH}
        fill="white"
        filter={`url(#${filterId})`}
      />
      <path d="M190 235L240 235" stroke={BRAND_LINE} strokeWidth="14" strokeLinecap="round" />
      <path d="M190 267L300 267" stroke={BRAND_LINE} strokeWidth="14" strokeLinecap="round" />
    </svg>
  );
}
