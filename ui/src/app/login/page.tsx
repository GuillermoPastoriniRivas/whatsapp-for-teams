"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Hexagon,
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
    <div className="flex min-h-screen">
      {/* Left panel — branding (hidden on mobile) */}
      <div className="hidden w-1/2 flex-col justify-between bg-primary p-10 text-primary-foreground md:flex lg:p-14">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
              <Hexagon className="h-5 w-5" />
            </div>
            <span className="text-xl font-semibold">Hivvo</span>
          </div>
        </div>

        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold leading-tight lg:text-4xl">
              WhatsApp para equipos,
              <br />
              potenciado con IA
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed opacity-80">
              Gestiona múltiples cuentas de WhatsApp, asigna conversaciones a
              tu equipo y automatiza respuestas con agentes de IA.
            </p>
          </div>

          <ul className="space-y-4">
            <li className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15">
                <MessageSquare className="h-4 w-4" />
              </div>
              <span className="text-sm opacity-90">
                Múltiples cuentas de WhatsApp en un inbox
              </span>
            </li>
            <li className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15">
                <Bot className="h-4 w-4" />
              </div>
              <span className="text-sm opacity-90">
                Agentes de IA con tu propio modelo
              </span>
            </li>
            <li className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15">
                <Users className="h-4 w-4" />
              </div>
              <span className="text-sm opacity-90">
                Colaboración en tiempo real para tu equipo
              </span>
            </li>
          </ul>
        </div>

        <p className="text-xs opacity-50">
          © {new Date().getFullYear()} Hivvo. Todos los derechos reservados.
        </p>
      </div>

      {/* Right panel — login form */}
      <div className="flex w-full flex-col bg-background md:w-1/2">
        <div className="flex items-center justify-between p-4 sm:p-6">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Inicio
          </button>
          {/* Mobile logo */}
          <div className="flex items-center gap-2 md:hidden">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-[#0D9488] to-[#0F766E]">
              <Hexagon className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-semibold">Hivvo</span>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center px-4 sm:px-6">
          <div className="w-full max-w-sm">
            <div className="mb-8">
              <h2 className="text-2xl font-bold tracking-tight">
                Bienvenido de vuelta
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Inicia sesión para acceder a tu workspace
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="text-sm font-medium text-foreground"
                >
                  Email
                </label>
                <Input
                  ref={emailRef}
                  id="email"
                  type="email"
                  placeholder="tu@empresa.com"
                  name="email"
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="password"
                  className="text-sm font-medium text-foreground"
                >
                  Contraseña
                </label>
                <Input
                  ref={passwordRef}
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  name="password"
                  required
                />
              </div>
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? "Iniciando sesión..." : "Iniciar sesión"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
