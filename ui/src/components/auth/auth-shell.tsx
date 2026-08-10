"use client";

import Link from "next/link";
import { ArrowLeft, Bot, MessageSquare, Users, type LucideIcon } from "lucide-react";

import { AsisLockup } from "@/components/brand/asis-lockup";
import { AsisLogo } from "@/components/brand/asis-logo";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useTranslations } from "@/lib/i18n/use-translations";
import { cn } from "@/lib/utils";

export interface AuthFeature {
  icon: LucideIcon;
  label: string;
}

interface AuthShellProps {
  /** Título real de la pantalla: es el único `h1` de la página. */
  title: string;
  subtitle?: string;
  /** El formulario (o el contenido del estado de resultado). */
  children: React.ReactNode;
  /** Pie bajo el formulario: "¿No tenés cuenta? Registrate". */
  footer?: React.ReactNode;
  /** Destino del botón de volver. `null` lo oculta. */
  backHref?: string | null;
  /** Texto del botón de volver. Por defecto `t.login.back`. */
  backLabel?: string;
  /** `false` = variante centrada, sin panel de marca (verify-email, enlaces inválidos). */
  brandPanel?: boolean;
  /** Copys del panel de marca. Por defecto los de `t.login.*`. */
  tagline?: string;
  taglineDescription?: string;
  /** Lista de features del panel. `[]` no muestra ninguna. */
  features?: AuthFeature[];
  /** Ícono de estado sobre el título; cuando está, el bloque se centra. */
  icon?: React.ReactNode;
}

/**
 * Estructura común de las pantallas de autenticación: barra superior con
 * "Inicio" + idioma, panel de marca teal a la izquierda y columna de contenido
 * a la derecha. Las páginas solo aportan su formulario.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  backHref = "/",
  backLabel,
  brandPanel = true,
  tagline,
  taglineDescription,
  features,
  icon,
}: AuthShellProps) {
  const { t } = useTranslations();

  const brandFeatures: AuthFeature[] = features ?? [
    { icon: MessageSquare, label: t.login.featureInbox },
    { icon: Bot, label: t.login.featureAI },
    { icon: Users, label: t.login.featureTeam },
  ];

  const centered = Boolean(icon);
  const year = new Date().getFullYear();

  return (
    <div className="flex min-h-dvh">
      {/* El panel usa superficie propia y no `bg-primary`: en oscuro el primary
          es claro y dejaba media pantalla encendida al lado del formulario. */}
      {brandPanel && (
        <aside className="hidden w-1/2 flex-col justify-between bg-(--asis-auth-panel) p-10 text-(--asis-auth-panel-foreground) md:flex lg:p-14">
          {/* El lockup toma `--asis-auth-panel-mark`, que invierte con el tema:
              blanco cuando el panel es verde, verde cuando es negro. Por eso va
              en `mono` + `ink`, que es como los dos heredan el color en vez de
              usar el verde de marca — sobre el panel verde desaparecerían.
              El texto del panel NO usa ese token: el verde queda de acento. */}
          <AsisLockup
            size={44}
            variant="mono"
            tone="ink"
            className="text-(--asis-auth-panel-mark)"
          />

          <div className="space-y-8">
            <div>
              <p className="text-3xl font-bold tracking-tight lg:text-4xl">
                {tagline ?? t.login.tagline}
              </p>
              <p className="mt-4 max-w-md text-base leading-relaxed opacity-80">
                {taglineDescription ?? t.login.taglineDescription}
              </p>
            </div>

            {brandFeatures.length > 0 && (
              <ul className="space-y-5">
                {brandFeatures.map(({ icon: Icon, label }) => (
                  <li key={label} className="flex items-center gap-3">
                    {/* El ícono toma el color de marca del panel: es el acento
                        verde en oscuro y blanco en claro, igual que el wordmark.
                        El texto de al lado se queda en el foreground, para que
                        el verde puntúe y no inunde. */}
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-(--asis-auth-panel-chip) text-(--asis-auth-panel-mark)">
                      <Icon className="size-5" />
                    </div>
                    <span className="text-base opacity-90">{label}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="text-xs opacity-50">&copy; {year} asis.chat</p>
        </aside>
      )}

      <div className={cn("flex w-full flex-col bg-background", brandPanel && "md:w-1/2")}>
        <div className="flex items-center justify-between gap-3 px-5 py-4 sm:px-8 sm:py-5">
          {backHref ? (
            <Link
              href={backHref}
              className="flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground active:scale-95"
            >
              <ArrowLeft className="size-5" />
              {backLabel ?? t.login.back}
            </Link>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-3">
            {/* Las pantallas de auth no tienen ajustes a mano, así que el tema
                se cambia desde acá, igual que en la landing. */}
            <ThemeToggle />
            <LanguageToggle />
            {brandPanel && (
              <AsisLockup size={36} className="md:hidden" />
            )}
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center px-5 pb-8 sm:px-8">
          <div className="w-full max-w-sm">
            <div className={cn("mb-10 flex flex-col items-center", brandPanel && "md:hidden")}>
              <AsisLogo size={72} />
            </div>

            <div className={cn("mb-8", centered && "text-center")}>
              {icon && <div className="mb-4">{icon}</div>}
              <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
              {subtitle && (
                <p className="mt-2 text-base text-muted-foreground">{subtitle}</p>
              )}
            </div>

            <div className={cn(centered && "text-center")}>{children}</div>

            {footer && (
              <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>
            )}

            {!brandPanel && (
              <p className="mt-10 text-center text-xs text-muted-foreground">
                &copy; {year} asis.chat
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Ícono de estado (enviado, éxito, error) para el encabezado del shell. */
export function AuthStatusIcon({
  icon: Icon,
  tone = "primary",
}: {
  icon: LucideIcon;
  tone?: "primary" | "destructive";
}) {
  return (
    <div
      className={cn(
        "mx-auto flex size-16 items-center justify-center rounded-full",
        tone === "primary" ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
      )}
    >
      <Icon className="size-8" />
    </div>
  );
}

/** Separador con etiqueta ("o") entre bloques del formulario. */
export function AuthDivider({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative my-5">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t" />
      </div>
      <div className="relative flex justify-center text-xs uppercase">
        <span className="bg-background px-2 text-muted-foreground">{children}</span>
      </div>
    </div>
  );
}
