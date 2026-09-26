"use client";

import { useState, useEffect } from "react";
import { Phone, Store } from "lucide-react";

type Variant = "phone" | "store";

interface Props {
  src?: string | null;
  alt?: string;
  size: number; // tailwind size-10 = 40px, size-12 = 48px, size-16 = 64px
  variant?: Variant;
  className?: string;
}

/**
 * Avatar para foto de perfil de WhatsApp Business.
 * Si la URL falla (CDN expirado, 404, CORS) hace fallback al ícono
 * en vez de dejar el "broken image" que se veía en /admin.
 */
export function PhoneAvatar({ src, alt, size, variant = "phone", className }: Props) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const sizeClass =
    size === 10 ? "size-10" :
    size === 12 ? "size-12" :
    size === 16 ? "size-16" :
    `size-${size}`;

  const icon =
    variant === "store" ? (
      <Store className={size === 16 ? "size-6" : "size-5"} />
    ) : (
      <Phone className={size === 16 ? "size-6" : "size-5"} />
    );

  // URL vacía / solo espacios = sin foto
  const cleanSrc = src?.trim();
  const hasSrc = !!cleanSrc && !failed;

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted text-muted-foreground ${sizeClass} ${className ?? ""}`}
    >
      {hasSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cleanSrc!}
          alt={alt ?? ""}
          className="size-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        icon
      )}
    </div>
  );
}
