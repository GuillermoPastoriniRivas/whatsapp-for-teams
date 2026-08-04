"use client";

import { Download, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { useTranslations } from "@/lib/i18n/use-translations";

/**
 * Lleva el diálogo (que por defecto es hoja inferior en mobile y modal centrado
 * desde `sm`) a pantalla completa sin marco. Va como `className` —o sea último
 * en el `cn`—, así que tailwind-merge le gana a las clases del primitivo.
 */
const FULLSCREEN =
  "inset-0 max-h-full rounded-none border-0 bg-transparent shadow-none " +
  "sm:inset-0 sm:w-full sm:max-w-none sm:translate-x-0 sm:translate-y-0 sm:rounded-none sm:border-0";

interface MediaLightboxProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Nombre del archivo: es lo que anuncian los lectores de pantalla. */
  title: string;
  /** Imagen a mostrar. Se ignora si se pasan `children`. */
  src?: string | null;
  alt?: string;
  downloadUrl?: string | null;
  downloadFilename?: string | null;
  /** Contenido propio (video, documento) en lugar de la imagen. */
  children?: React.ReactNode;
}

/**
 * Visor a pantalla completa de un archivo.
 *
 * Único para todo el producto: antes el chat y la biblioteca tenían cada uno su
 * copia del mismo overlay. Va sobre `ResponsiveDialog` —y por lo tanto sobre
 * Radix— así que trae portal (indispensable con el `zoom` de `.content-zoom`),
 * foco atrapado, Escape y bloqueo del scroll de atrás.
 */
export function MediaLightbox({
  open,
  onOpenChange,
  title,
  src,
  alt,
  downloadUrl,
  downloadFilename,
  children,
}: MediaLightboxProps) {
  const { t } = useTranslations();
  const close = () => onOpenChange(false);

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange} title={title} hideHeader bare className={FULLSCREEN}>
      {/* El click en el fondo cierra; el del contenido no. */}
      <div className="relative flex h-full w-full items-center justify-center p-4" onClick={close}>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Cerrar"
          onClick={close}
          className="absolute top-4 right-4 rounded-full bg-white/10 text-white hover:bg-white/20 hover:text-white"
        >
          <X />
        </Button>

        {children ?? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src ?? ""}
            alt={alt ?? title}
            onClick={(event) => event.stopPropagation()}
            className="max-h-full max-w-full object-contain"
          />
        )}

        {downloadUrl && (
          <Button
            asChild
            variant="ghost"
            className="absolute bottom-6 rounded-full bg-white/10 text-white hover:bg-white/20 hover:text-white"
          >
            <a href={downloadUrl} download={downloadFilename ?? undefined}>
              <Download />
              {t.media.download}
            </a>
          </Button>
        )}
      </div>
    </ResponsiveDialog>
  );
}
