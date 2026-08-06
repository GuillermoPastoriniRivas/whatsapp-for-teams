import { useId } from "react";

/** Contorno de la burbuja. Compartido por las dos variantes y por la capa mint. */
const BUBBLE_PATH =
  "M120 185C120 163.46 137.46 146 159 146H353C374.54 146 392 163.46 392 185V310C392 331.54 374.54 349 353 349H280L240 389V349H159C137.46 349 120 331.54 120 310V185Z";

/** Verde claro del logo, muestreado del arte original. */
const ACCENT_MINT = "#11B69C";

interface AsisLogoProps {
  size?: number;
  className?: string;
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
      <rect width="512" height="512" rx="120" fill={color} />
      <defs>
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
      {/* Capa mint desplazada, que asoma abajo y a la derecha de la burbuja
          blanca. Es el degradado de marca, una de las excepciones a la regla
          de solo-tokens de DESIGN.md: el logo no cambia con el tema. */}
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
      <path d="M190 235L240 235" stroke={color} strokeWidth="14" strokeLinecap="round" />
      <path d="M190 267L300 267" stroke={color} strokeWidth="14" strokeLinecap="round" />
    </svg>
  );
}
