"use client";

import Link from "next/link";
import { FluwsLogo } from "@/components/brand/fluws-logo";
import { FluwsWordmark } from "@/components/brand/fluws-wordmark";
import { ArrowLeft } from "lucide-react";
import { useTranslations } from "@/lib/i18n/use-translations";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { termsContent } from "@/lib/i18n/legal";
import { legalEntityLine } from "@/lib/legal-entity";

export default function TermsOfServicePage() {
  const { t, locale } = useTranslations();

  return (
    <div className="min-h-dvh bg-background">
      {/* Header */}
      <nav className="border-b border-border bg-background">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-3">
            <FluwsLogo size={36} />
            <FluwsWordmark className="text-xl" />
          </Link>
          <div className="flex items-center gap-4">
            <LanguageToggle />
            <Link
              href="/"
              className="flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground md:min-h-0"
            >
              <ArrowLeft className="h-4 w-4" />
              {t.legal.backToHome}
            </Link>
          </div>
        </div>
      </nav>

      {/* Content */}
      <article className="mx-auto max-w-4xl px-6 py-16">
        <h1 className="mb-2 text-4xl font-extrabold tracking-tight text-foreground">
          {t.legal.termsTitle}
        </h1>
        <p className="mb-12 text-sm text-muted-foreground">
          {t.legal.termsUpdated}
        </p>

        <div className="space-y-6 leading-7 text-muted-foreground [&_h2]:mt-12 [&_h2]:mb-4 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:text-foreground [&_h3]:mt-8 [&_h3]:mb-3 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-foreground [&_ul]:list-disc [&_ul]:space-y-3 [&_ul]:pl-6 [&_li]:pl-1 [&_strong]:font-semibold [&_strong]:text-foreground [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-primary/80">
          {termsContent[locale]}
        </div>
      </article>

      {/* Footer */}
      <footer className="border-t border-border bg-muted/40 py-8">
        <div className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} fluws — {t.legal.allRightsReserved}
            <br />
            <span className="text-xs">
              {t.legal.operatedBy} {legalEntityLine()}
            </span>
          </p>
          <div className="flex gap-6 text-sm">
            <Link
              href="/privacy"
              className="flex min-h-11 items-center text-muted-foreground transition-colors hover:text-foreground md:min-h-0"
            >
              {t.legal.privacy}
            </Link>
            <Link
              href="/terms"
              className="flex min-h-11 items-center font-medium text-muted-foreground transition-colors hover:text-foreground md:min-h-0"
            >
              {t.legal.terms}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
