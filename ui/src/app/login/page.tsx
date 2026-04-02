"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";
import { useTranslations } from "@/lib/i18n/use-translations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AsisLogo } from "@/components/brand/asis-logo";
import {
  MessageSquare,
  Bot,
  Users,
  ArrowLeft,
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslations();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailValue = emailRef.current?.value ?? "";
    const passwordValue = passwordRef.current?.value ?? "";
    await login(emailValue, passwordValue);
    if (useAuthStore.getState().agent) {
      router.push("/conversations");
    }
  };

  return (
    <div className="flex min-h-[100dvh]">
      {/* Left panel — branding (hidden on mobile) */}
      <div className="hidden w-1/2 flex-col justify-between bg-primary p-10 text-primary-foreground md:flex lg:p-14">
        <div className="flex items-center gap-2">
          <AsisLogo size={44} color="#0D9488" />
          <span className="text-xl font-bold -ml-1">asis<span className="opacity-80">.chat</span></span>
        </div>

        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold leading-tight lg:text-4xl">
              {t.login.tagline}
            </h1>
            <p className="mt-4 max-w-md text-base leading-relaxed opacity-80">
              {t.login.taglineDescription}
            </p>
          </div>

          <ul className="space-y-5">
            <li className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
                <MessageSquare className="h-5 w-5" />
              </div>
              <span className="text-[15px] opacity-90">
                {t.login.featureInbox}
              </span>
            </li>
            <li className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
                <Bot className="h-5 w-5" />
              </div>
              <span className="text-[15px] opacity-90">
                {t.login.featureAI}
              </span>
            </li>
            <li className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
                <Users className="h-5 w-5" />
              </div>
              <span className="text-[15px] opacity-90">
                {t.login.featureTeam}
              </span>
            </li>
          </ul>
        </div>

        <p className="text-xs opacity-50">
          &copy; {new Date().getFullYear()} asis.chat
        </p>
      </div>

      {/* Right panel — login form */}
      <div className="flex w-full flex-col bg-background md:w-1/2">
        {/* Top bar with back + mobile logo */}
        <div className="flex items-center justify-between px-5 py-4 sm:px-8 sm:py-5">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground active:scale-95 min-h-[44px]"
          >
            <ArrowLeft className="h-5 w-5" />
            {t.login.back}
          </button>
          <div className="flex items-center gap-1.5 md:hidden">
            <AsisLogo size={36} color="#0D9488" />
            <span className="text-lg font-bold">asis<span className="text-primary">.chat</span></span>
          </div>
        </div>

        {/* Form centered */}
        <div className="flex flex-1 items-center justify-center px-5 pb-8 sm:px-8">
          <div className="w-full max-w-sm">
            {/* Mobile logo centered */}
            <div className="flex flex-col items-center mb-10 md:hidden">
              <AsisLogo size={72} color="#0D9488" className="mb-3" />
            </div>

            <div className="mb-8">
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                {t.login.title}
              </h2>
              <p className="mt-2 text-base text-muted-foreground">
                {t.login.subtitle}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label
                  htmlFor="email"
                  className="text-sm font-medium text-foreground"
                >
                  {t.login.email}
                </label>
                <Input
                  ref={emailRef}
                  id="email"
                  type="email"
                  placeholder={t.login.emailPlaceholder}
                  name="email"
                  required
                  autoFocus
                  className="h-12 text-base px-4 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="password"
                  className="text-sm font-medium text-foreground"
                >
                  {t.login.password}
                </label>
                <Input
                  ref={passwordRef}
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  name="password"
                  required
                  className="h-12 text-base px-4 rounded-xl"
                />
              </div>
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <Button
                type="submit"
                className="w-full h-12 text-base font-semibold rounded-xl mt-2"
                disabled={isLoading}
              >
                {isLoading ? t.login.submitting : t.login.submit}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
