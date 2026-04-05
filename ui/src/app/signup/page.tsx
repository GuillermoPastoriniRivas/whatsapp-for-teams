"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/stores/auth.store";
import { useTranslations } from "@/lib/i18n/use-translations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AsisLogo } from "@/components/brand/asis-logo";
import { MessageSquare, Bot, Users, ArrowLeft } from "lucide-react";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { GoogleLogin, GoogleOAuthProvider } from "@react-oauth/google";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

export default function SignupPage() {
  const router = useRouter();
  const signup = useAuthStore((s) => s.signup);
  const googleLogin = useAuthStore((s) => s.googleLogin);
  const isLoading = useAuthStore((s) => s.isLoading);
  const storeError = useAuthStore((s) => s.error);
  const { t } = useTranslations();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (password !== confirmPassword) {
      setFormError(t.signup.passwordMismatch);
      return;
    }

    await signup(name, email, password);

    const state = useAuthStore.getState();
    if (state.error) {
      if (state.error.toLowerCase().includes("already")) {
        setFormError(t.signup.emailTaken);
      } else {
        setFormError(state.error);
      }
      return;
    }

    if (state.agent) {
      router.push("/conversations");
    }
  };

  const handleGoogleSuccess = async (response: { credential?: string }) => {
    if (response.credential) {
      await googleLogin(response.credential);
      if (useAuthStore.getState().agent) {
        router.push("/conversations");
      }
    }
  };

  const displayError = formError ?? storeError;

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <div className="flex min-h-[100dvh]">
        {/* Left panel — branding (hidden on mobile) */}
        <div className="hidden w-1/2 flex-col justify-between bg-primary p-10 text-primary-foreground md:flex lg:p-14">
          <div className="flex items-center gap-2">
            <AsisLogo size={44} color="#0D9488" />
            <span className="text-xl font-bold -ml-1">
              asis<span className="opacity-80">.chat</span>
            </span>
          </div>

          <div className="space-y-8">
            <div>
              <h1 className="text-3xl font-bold leading-tight lg:text-4xl">
                {t.signup.tagline}
              </h1>
              <p className="mt-4 max-w-md text-base leading-relaxed opacity-80">
                {t.signup.taglineDescription}
              </p>
            </div>

            <ul className="space-y-5">
              <li className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <span className="text-[15px] opacity-90">
                  {t.signup.featureInbox}
                </span>
              </li>
              <li className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
                  <Bot className="h-5 w-5" />
                </div>
                <span className="text-[15px] opacity-90">
                  {t.signup.featureAI}
                </span>
              </li>
              <li className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
                  <Users className="h-5 w-5" />
                </div>
                <span className="text-[15px] opacity-90">
                  {t.signup.featureTeam}
                </span>
              </li>
            </ul>
          </div>

          <p className="text-xs opacity-50">
            &copy; {new Date().getFullYear()} asis.chat
          </p>
        </div>

        {/* Right panel — signup form */}
        <div className="flex w-full flex-col bg-background md:w-1/2">
          {/* Top bar */}
          <div className="flex items-center justify-between px-5 py-4 sm:px-8 sm:py-5">
            <button
              onClick={() => router.push("/")}
              className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground active:scale-95 min-h-[44px]"
            >
              <ArrowLeft className="h-5 w-5" />
              Inicio
            </button>
            <div className="flex items-center gap-3">
              <LanguageToggle />
              <div className="flex items-center gap-1.5 md:hidden">
                <AsisLogo size={36} color="#0D9488" />
                <span className="text-lg font-bold">
                  asis<span className="text-primary">.chat</span>
                </span>
              </div>
            </div>
          </div>

          {/* Form centered */}
          <div className="flex flex-1 items-center justify-center px-5 pb-8 sm:px-8">
            <div className="w-full max-w-sm">
              {/* Mobile logo */}
              <div className="flex flex-col items-center mb-10 md:hidden">
                <AsisLogo size={72} color="#0D9488" className="mb-3" />
              </div>

              <div className="mb-8">
                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  {t.signup.title}
                </h2>
                <p className="mt-2 text-base text-muted-foreground">
                  {t.signup.subtitle}
                </p>
              </div>

              <div className="flex justify-center">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  width="384"
                  shape="pill"
                  size="large"
                  theme="filled_blue"
                  text="signup_with"
                />
              </div>

              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    {t.signup.divider}
                  </span>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="name" className="text-sm font-medium text-foreground">
                    {t.signup.name}
                  </label>
                  <Input
                    id="name"
                    type="text"
                    placeholder={t.signup.namePlaceholder}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoFocus
                    className="h-12 text-base px-4 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium text-foreground">
                    {t.signup.email}
                  </label>
                  <Input
                    id="email"
                    type="email"
                    placeholder={t.signup.emailPlaceholder}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-12 text-base px-4 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium text-foreground">
                    {t.signup.password}
                  </label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    className="h-12 text-base px-4 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
                    {t.signup.confirmPassword}
                  </label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    className="h-12 text-base px-4 rounded-xl"
                  />
                </div>

                {displayError && (
                  <p className="text-sm text-destructive">{displayError}</p>
                )}

                <Button
                  type="submit"
                  className="w-full h-12 text-base font-semibold rounded-xl mt-2"
                  disabled={isLoading}
                >
                  {isLoading ? t.signup.submitting : t.signup.submit}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                {t.signup.alreadyHaveAccount}{" "}
                <Link href="/login" className="text-primary font-medium hover:underline">
                  {t.signup.loginLink}
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </GoogleOAuthProvider>
  );
}
