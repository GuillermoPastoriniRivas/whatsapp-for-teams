"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";
import { Button } from "@/components/ui/button";
import {
  Hexagon,
  MessageSquare,
  Bot,
  Users,
  ArrowRight,
  Sparkles,
  Lock,
  MessageCircle,
  LayoutDashboard,
  Phone,
  Shield,
} from "lucide-react";

const features = [
  {
    icon: MessageSquare,
    title: "Todos tus números en una bandeja",
    description:
      "Conecta varios números de WhatsApp Business y ve todas las conversaciones en un solo lugar. Tu equipo no necesita cambiar entre teléfonos ni cuentas.",
  },
  {
    icon: Users,
    title: "Colaboración entre agentes humanos",
    description:
      "Asigna conversaciones a miembros del equipo, deja notas internas invisibles para el cliente y colabora en tiempo real sin que nadie lo note.",
  },
  {
    icon: Bot,
    title: "Agentes de IA con tu propio modelo",
    description:
      "Conecta tu LLM (OpenAI, Anthropic, Gemini) para que responda automáticamente. Configura cuándo interviene la IA, cuándo pasa a un humano y qué base de conocimiento usa.",
  },
  {
    icon: Shield,
    title: "Control y permisos de administrador",
    description:
      "Define quién ve qué números, asigna roles y permisos a cada miembro. Mantén control total sobre quién accede a qué conversaciones.",
  },
];

const steps = [
  {
    number: "01",
    icon: Phone,
    title: "Conecta tus números",
    description:
      "Registra tus números de WhatsApp Business. Puedes conectar todos los que necesites desde el panel de administración.",
  },
  {
    number: "02",
    icon: Users,
    title: "Tu equipo responde",
    description:
      "Las conversaciones se asignan a agentes humanos. Colabora con notas internas, transfiere chats y responde en tiempo real.",
  },
  {
    number: "03",
    icon: Bot,
    title: "La IA te ayuda",
    description:
      "Configura agentes de IA con tu propio modelo de lenguaje. Responden automáticamente y escalan al humano cuando no pueden resolver.",
  },
];

export default function LandingPage() {
  const router = useRouter();
  const agent = useAuthStore((s) => s.agent);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    useAuthStore.getState().hydrate();
    setHydrated(true);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-primary/20 selection:text-primary-foreground font-sans overflow-x-hidden">
      {/* Patrones de fondo */}
      <div className="fixed inset-0 z-[-1] bg-slate-50">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f080_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f080_1px,transparent_1px)] bg-[size:32px_32px]"></div>
        <div className="absolute left-[15%] top-[10%] h-[600px] w-[600px] rounded-full bg-primary/5 blur-[120px]"></div>
        <div className="absolute right-[15%] top-[40%] h-[500px] w-[500px] rounded-full bg-accent/5 blur-[120px]"></div>
      </div>

      {/* Navbar */}
      <nav className="fixed top-0 z-50 w-full border-b border-slate-200/60 bg-white/80 backdrop-blur-xl transition-all">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-primary to-primary/80 shadow-md shadow-primary/20">
              <Hexagon className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">Hivvo<span className="text-primary">.chat</span></span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <button onClick={() => document.getElementById("como-funciona")?.scrollIntoView({ behavior: "smooth" })} className="hover:text-primary transition-colors">
              Cómo funciona
            </button>
            <button onClick={() => document.getElementById("funcionalidades")?.scrollIntoView({ behavior: "smooth" })} className="hover:text-primary transition-colors">
              Funcionalidades
            </button>
          </div>

          <div className="flex items-center gap-4">
            {hydrated && agent ? (
              <Button onClick={() => router.push("/conversations")} className="rounded-full shadow-md shadow-primary/20">
                <LayoutDashboard className="mr-2 h-4 w-4" />
                Ir al workspace
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  className="hidden md:inline-flex text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  onClick={() => router.push("/login")}
                >
                  Iniciar sesión
                </Button>
                <Button
                  className="rounded-full bg-slate-900 text-white hover:bg-slate-800 shadow-md transition-transform hover:scale-105"
                  onClick={() => router.push("/login")}
                >
                  Comenzar gratis
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 text-center">
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-1000">
            <div className="mx-auto mb-8 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
              <Sparkles className="h-4 w-4" />
              <span>Bandeja compartida de WhatsApp para equipos</span>
            </div>
            <h1 className="mx-auto max-w-4xl text-5xl font-extrabold tracking-tight text-slate-900 sm:text-7xl">
              Todos tus números de WhatsApp, <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">un solo inbox</span> para tu equipo
            </h1>
            <p className="mx-auto mt-8 max-w-2xl text-lg text-slate-600 sm:text-xl">
              Conecta múltiples números de WhatsApp Business. Tu equipo responde desde una bandeja compartida. Agentes de IA ayudan con respuestas automáticas y pasan al humano cuando es necesario.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button
                size="lg"
                className="rounded-full h-14 px-8 text-base bg-primary hover:bg-primary/90 shadow-lg shadow-primary/30 transition-all hover:scale-105"
                onClick={() => router.push("/login")}
              >
                Crear cuenta gratuita
                <ArrowRight className="ml-2 h-5 w-5 text-white" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="rounded-full h-14 px-8 text-base border-slate-300 text-slate-700 bg-white hover:bg-slate-50 hover:text-slate-900 shadow-sm"
                onClick={() => {
                  document.getElementById("como-funciona")?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                <MessageCircle className="mr-2 h-5 w-5" />
                Ver cómo funciona
              </Button>
            </div>
          </div>

          {/* Product Mockup */}
          <div className="relative mx-auto mt-20 max-w-5xl rounded-xl border border-slate-200/80 bg-white/60 shadow-2xl shadow-slate-200/50 backdrop-blur-xl ring-1 ring-slate-900/5 sm:mt-24 lg:rounded-2xl lg:p-2 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-200 fill-mode-both">
            <div className="absolute -top-px left-1/2 h-[2px] w-1/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-primary to-transparent" />
            <div className="rounded-lg bg-white overflow-hidden border border-slate-200 shadow-sm">
              <div className="flex h-12 items-center gap-2 border-b border-slate-100 px-4 bg-slate-50/50">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-red-400" />
                  <div className="h-3 w-3 rounded-full bg-yellow-400" />
                  <div className="h-3 w-3 rounded-full bg-green-400" />
                </div>
                <div className="mx-auto flex h-6 flex-1 max-w-[200px] items-center justify-center rounded-md bg-white border border-slate-200 px-3 text-[11px] text-slate-500 shadow-sm">
                  <Lock className="mr-1.5 h-3 w-3" /> app.hivvo.chat
                </div>
                <div className="flex gap-1.5 opacity-0">
                  <div className="h-3 w-3 rounded-full bg-red-400" />
                  <div className="h-3 w-3 rounded-full bg-yellow-400" />
                  <div className="h-3 w-3 rounded-full bg-green-400" />
                </div>
              </div>
              <div className="flex h-[400px] md:h-[600px] w-full bg-white">
                {/* Sidebar mock */}
                <div className="hidden md:flex w-64 flex-col border-r border-slate-100 bg-slate-50/50">
                  <div className="p-4 border-b border-slate-100 flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                      <Hexagon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="h-4 w-24 bg-slate-200 rounded" />
                  </div>
                  <div className="p-3 space-y-1">
                    <div className="h-9 w-full rounded-md bg-white border border-slate-200 shadow-sm flex items-center px-3 gap-3">
                      <MessageSquare className="h-4 w-4 text-primary" />
                      <div className="h-3 w-20 bg-slate-800 rounded" />
                    </div>
                    <div className="h-9 w-full rounded-md flex items-center px-3 gap-3">
                      <Users className="h-4 w-4 text-slate-400" />
                      <div className="h-3 w-16 bg-slate-300 rounded" />
                    </div>
                    <div className="h-9 w-full rounded-md flex items-center px-3 gap-3">
                      <Bot className="h-4 w-4 text-slate-400" />
                      <div className="h-3 w-24 bg-slate-300 rounded" />
                    </div>
                  </div>
                </div>
                {/* Chat List mock */}
                <div className="hidden sm:flex w-80 flex-col border-r border-slate-100 bg-white">
                  <div className="p-4 border-b border-slate-100 bg-slate-50/30">
                    <div className="h-9 w-full rounded-md bg-white border border-slate-200 shadow-sm flex items-center px-3">
                      <div className="h-3 w-32 bg-slate-200 rounded" />
                    </div>
                  </div>
                  <div className="p-3 space-y-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className={`p-3 rounded-lg flex items-center gap-3 transition-colors ${i === 1 ? 'bg-primary/5 border border-primary/10' : 'hover:bg-slate-50'}`}>
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 border border-slate-100 shrink-0" />
                        <div className="space-y-2 w-full">
                          <div className="flex justify-between w-full">
                            <div className={`h-3 w-24 rounded ${i === 1 ? 'bg-slate-800' : 'bg-slate-400'}`} />
                            <div className="h-2 w-8 bg-slate-300 rounded" />
                          </div>
                          <div className={`h-2 w-32 rounded ${i === 1 ? 'bg-slate-500' : 'bg-slate-300'}`} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Chat Area mock */}
                <div className="flex-1 flex flex-col bg-[#F8FAFC] relative overflow-hidden">
                   <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, slate 1px, transparent 0)', backgroundSize: '24px 24px' }} />

                   <div className="h-16 border-b border-slate-200 flex items-center px-6 justify-between bg-white z-10 shadow-[0_4px_20px_-15px_rgba(0,0,0,0.1)]">
                     <div className="flex items-center gap-3">
                       <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 border border-slate-100" />
                       <div className="space-y-1.5">
                         <div className="h-3 w-32 bg-slate-800 rounded" />
                         <div className="h-2 w-20 bg-primary/60 rounded" />
                       </div>
                     </div>
                     <div className="flex gap-2">
                       <div className="h-8 w-8 rounded border border-slate-200 bg-white" />
                       <div className="h-8 w-8 rounded border border-slate-200 bg-white" />
                     </div>
                   </div>

                   <div className="flex-1 p-6 space-y-6 z-10">
                      <div className="flex gap-3 max-w-[80%]">
                        <div className="h-8 w-8 rounded-full bg-slate-200 border border-slate-300 shrink-0" />
                        <div className="bg-white p-4 rounded-2xl rounded-tl-sm border border-slate-200 shadow-sm space-y-2">
                           <div className="h-3 w-48 bg-slate-600 rounded" />
                           <div className="h-3 w-32 bg-slate-400 rounded" />
                        </div>
                      </div>

                      <div className="flex gap-3 max-w-[80%] ml-auto justify-end">
                        <div className="bg-primary/10 p-4 rounded-2xl rounded-tr-sm border border-primary/20 shadow-sm space-y-2">
                           <div className="h-3 w-56 bg-primary/70 rounded" />
                           <div className="h-3 w-40 bg-primary/60 rounded" />
                        </div>
                      </div>

                      <div className="flex gap-3 max-w-[80%] ml-auto justify-end">
                        <div className="bg-white p-2.5 text-xs text-slate-500 rounded-lg border border-slate-200 shadow-sm flex items-center gap-2">
                           <Bot className="h-3 w-3 text-primary" />
                           <span>IA ha generado una respuesta sugerida</span>
                        </div>
                      </div>
                   </div>

                   <div className="p-4 border-t border-slate-200 bg-white z-10">
                     <div className="h-12 w-full rounded-lg bg-slate-50 border border-slate-200 flex items-center px-4 justify-between shadow-inner">
                       <div className="h-3 w-40 bg-slate-300 rounded" />
                       <div className="h-8 w-8 rounded-md bg-primary text-white flex items-center justify-center shadow-sm">
                         <Bot className="h-4 w-4" />
                       </div>
                     </div>
                   </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Cómo funciona */}
      <section id="como-funciona" className="py-24 sm:py-32 border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <h2 className="text-primary font-bold tracking-wide uppercase text-sm mb-3">Cómo funciona</h2>
            <p className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
              De WhatsApp fragmentado a equipo coordinado en 3 pasos
            </p>
          </div>

          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 lg:grid-cols-3">
            {steps.map((step) => (
              <div key={step.number} className="relative flex flex-col items-center text-center p-8 rounded-2xl bg-slate-50 border border-slate-200 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300">
                <div className="mb-4 text-5xl font-black text-primary/15">{step.number}</div>
                <div className="mb-4 rounded-xl bg-primary/10 p-3 ring-1 ring-primary/20">
                  <step.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{step.title}</h3>
                <p className="text-base text-slate-600 leading-7">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Funcionalidades */}
      <section id="funcionalidades" className="py-24 sm:py-32 relative bg-slate-50">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <h2 className="text-primary font-bold tracking-wide uppercase text-sm mb-3">Funcionalidades</h2>
            <p className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
              Todo lo que tu equipo necesita en un solo lugar
            </p>
            <p className="mt-4 text-lg text-slate-600">
              Sin funciones inventadas. Esto es lo que Hivvo hace hoy.
            </p>
          </div>

          <div className="mx-auto max-w-4xl">
            <dl className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              {features.map((feature) => (
                <div key={feature.title} className="group flex flex-col items-start p-8 rounded-2xl bg-white border border-slate-200 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 relative overflow-hidden">
                  <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100 group-hover:bg-primary/10 group-hover:ring-primary/20 transition-all">
                    <feature.icon className="h-6 w-6 text-slate-700 group-hover:text-primary transition-colors" aria-hidden="true" />
                  </div>
                  <dt className="mt-6 font-bold text-xl text-slate-900">
                    {feature.title}
                  </dt>
                  <dd className="mt-3 flex flex-auto flex-col text-base leading-7 text-slate-600">
                    <p className="flex-auto">{feature.description}</p>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="relative isolate px-6 py-24 sm:py-32 lg:px-8 border-t border-slate-200">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,var(--tw-gradient-stops))] from-primary/5 via-slate-50 to-slate-50" />
        <div className="mx-auto max-w-4xl text-center">
           <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/30">
             <Bot className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            Prueba Hivvo con tu equipo
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-slate-600">
            Conecta tu primer número de WhatsApp en minutos. Sin tarjeta de crédito.
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Button size="lg" className="rounded-full bg-primary text-white hover:bg-primary/90 shadow-xl shadow-primary/20 h-14 px-8 text-lg font-semibold transition-transform hover:scale-105" onClick={() => router.push("/login")}>
              Crear tu workspace
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-12">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="xl:grid xl:grid-cols-3 xl:gap-8">
            <div className="space-y-8">
              <div className="flex items-center gap-2">
                 <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                   <Hexagon className="h-5 w-5 text-primary" />
                 </div>
                 <span className="text-xl font-bold text-slate-900">Hivvo</span>
              </div>
              <p className="text-sm leading-6 text-slate-600 max-w-xs">
                Bandeja compartida de WhatsApp para equipos. Agentes humanos e IA en un solo lugar.
              </p>
            </div>
            <div className="mt-16 grid grid-cols-2 gap-8 xl:col-span-2 xl:mt-0">
              <div className="md:grid md:grid-cols-2 md:gap-8">
                <div>
                  <h3 className="text-sm font-semibold leading-6 text-slate-900">Producto</h3>
                  <ul role="list" className="mt-6 space-y-4">
                    <li><button onClick={() => document.getElementById("funcionalidades")?.scrollIntoView({ behavior: "smooth" })} className="text-sm leading-6 text-slate-600 hover:text-slate-900 transition-colors">Funcionalidades</button></li>
                    <li><button onClick={() => document.getElementById("como-funciona")?.scrollIntoView({ behavior: "smooth" })} className="text-sm leading-6 text-slate-600 hover:text-slate-900 transition-colors">Cómo funciona</button></li>
                  </ul>
                </div>
                <div className="mt-10 md:mt-0">
                  <h3 className="text-sm font-semibold leading-6 text-slate-900">Empresa</h3>
                  <ul role="list" className="mt-6 space-y-4">
                    <li><a href="#" className="text-sm leading-6 text-slate-600 hover:text-slate-900 transition-colors">Contacto</a></li>
                  </ul>
                </div>
              </div>
              <div className="md:grid md:grid-cols-2 md:gap-8">
                 <div>
                  <h3 className="text-sm font-semibold leading-6 text-slate-900">Legal</h3>
                  <ul role="list" className="mt-6 space-y-4">
                    <li><a href="#" className="text-sm leading-6 text-slate-600 hover:text-slate-900 transition-colors">Privacidad</a></li>
                    <li><a href="#" className="text-sm leading-6 text-slate-600 hover:text-slate-900 transition-colors">Términos</a></li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-16 border-t border-slate-200 pt-8 sm:mt-20 lg:mt-24 text-center">
            <p className="text-sm leading-5 text-slate-500">
              &copy; {new Date().getFullYear()} Hivvo, Inc. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </footer>

      {/* Botón flotante de WhatsApp */}
      <a
        href="https://wa.me/TUNUMERO"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-black/20 transition-transform hover:scale-110"
        aria-label="Contactar por WhatsApp"
      >
        <MessageCircle className="h-7 w-7" />
      </a>
    </div>
  );
}
