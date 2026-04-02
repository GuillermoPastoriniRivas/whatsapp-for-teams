"use client";

import Link from "next/link";
import { AsisLogo } from "@/components/brand/asis-logo";
import { ArrowLeft } from "lucide-react";
import { useTranslations } from "@/lib/i18n/use-translations";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { termsContent } from "@/lib/i18n/legal";

export default function TermsOfServicePage() {
  const { t, locale } = useTranslations();

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <nav className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-3">
            <AsisLogo size={36} className="text-primary" />
            <span className="text-xl font-bold tracking-tight text-slate-900 -ml-1">
              asis<span className="text-primary">.chat</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <LanguageToggle />
            <Link
              href="/"
              className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              {t.legal.backToHome}
            </Link>
          </div>
        </div>
      </nav>

      {/* Content */}
      <article className="mx-auto max-w-4xl px-6 py-16">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 mb-2">
          {t.legal.termsTitle}
        </h1>
        <p className="text-sm text-slate-500 mb-12">
          {t.legal.termsUpdated}
        </p>

        <div className="space-y-6 text-slate-600 leading-7 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:text-slate-900 [&_h2]:mt-12 [&_h2]:mb-4 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-slate-800 [&_h3]:mt-8 [&_h3]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-3 [&_li]:pl-1 [&_strong]:text-slate-800 [&_strong]:font-semibold [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-primary/80">
          {termsContent[locale]}
        </div>
      </article>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-slate-50 py-8">
        <div className="mx-auto max-w-4xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-500">
            &copy; {new Date().getFullYear()} asis.chat — {t.legal.allRightsReserved}
          </p>
          <div className="flex gap-6 text-sm">
            <Link
              href="/privacy"
              className="text-slate-600 hover:text-slate-900 transition-colors"
            >
              {t.legal.privacy}
            </Link>
            <Link
              href="/terms"
              className="text-slate-600 hover:text-slate-900 font-medium transition-colors"
            >
              {t.legal.terms}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
