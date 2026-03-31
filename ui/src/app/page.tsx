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
  CheckCircle2,
  Zap,
  Shield,
  BarChart,
  Workflow,
  Sparkles,
  Lock,
  MessageCircle,
  Smartphone,
  LayoutDashboard
} from "lucide-react";

const features = [
  {
    icon: MessageSquare,
    title: "Múltiples cuentas empresariales",
    description:
      "Gestiona todas tus líneas desde una única bandeja de entrada compartida. Compatible con Cloud API oficial, Twilio y 360Dialog.",
  },
  {
    icon: Bot,
    title: "Agentes de IA y Automatización",
    description:
      "Integra tu propio modelo de lenguaje (LLM) para automatizar respuestas, calificar leads y reducir tiempos de espera.",
  },
  {
    icon: Users,
    title: "Colaboración sin fricción",
    description:
      "Asigna chats a departamentos específicos, usa notas internas y menciona a tu equipo sin que el cliente lo note.",
  },
  {
    icon: Workflow,
    title: "Workflows avanzados",
    description:
      "Crea flujos de trabajo personalizados basados en palabras clave, horarios de atención y comportamiento del cliente.",
  },
  {
    icon: BarChart,
    title: "Analíticas y métricas",
    description:
      "Mide el rendimiento de tu equipo con reportes de tiempos de respuesta, resolución y satisfacción del cliente.",
  },
  {
    icon: Shield,
    title: "Seguridad y cumplimiento",
    description:
      "Encriptación de extremo a extremo, roles y permisos granulares, y auditoría completa de todas las acciones.",
  },
];

const metrics = [
  { value: "99.9%", label: "Uptime garantizado" },
  { value: "+50M", label: "Mensajes procesados" },
  { value: "< 2s", label: "Latencia promedio" },
  { value: "24/7", label: "Soporte técnico" },
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
      {/* Patrones de fondo light abstractos */}
      <div className="fixed inset-0 z-[-1] bg-slate-50">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f080_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f080_1px,transparent_1px)] bg-[size:32px_32px]"></div>
        <div className="absolute left-[15%] top-[10%] h-[600px] w-[600px] rounded-full bg-primary/5 blur-[120px]"></div>
        <div className="absolute right-[15%] top-[40%] h-[500px] w-[500px] rounded-full bg-accent/5 blur-[120px]"></div>
      </div>

      {/* Navbar Enterprise Light */}
      <nav className="fixed top-0 z-50 w-full border-b border-slate-200/60 bg-white/80 backdrop-blur-xl transition-all">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-primary to-primary/80 shadow-md shadow-primary/20">
              <Hexagon className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">Hivvo<span className="text-primary">.chat</span></span>
          </div>
          
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-primary transition-colors">Características</a>
            <a href="#soluciones" className="hover:text-primary transition-colors">Soluciones</a>
            <a href="#seguridad" className="hover:text-primary transition-colors">Seguridad</a>
            <a href="#precios" className="hover:text-primary transition-colors">Precios</a>
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
              <span>Conoce la nueva era de WhatsApp Business</span>
            </div>
            <h1 className="mx-auto max-w-4xl text-5xl font-extrabold tracking-tight text-slate-900 sm:text-7xl">
              Escala tus ventas con una sola <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">bandeja compartida</span>
            </h1>
            <p className="mx-auto mt-8 max-w-2xl text-lg text-slate-600 sm:text-xl">
              Centraliza múltiples números de WhatsApp, colabora con tu equipo en tiempo real y automatiza la atención con Inteligencia Artificial. Todo en una plataforma diseñada para empresas.
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
                  document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                <MessageCircle className="mr-2 h-5 w-5" />
                Agendar demo
              </Button>
            </div>
          </div>

          {/* Product Mockup Enterprise Light */}
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
                   {/* Background chat pattern */}
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

      {/* Social Proof Section */}
      <section className="border-y border-slate-200 bg-white py-12 text-center shadow-[0_4px_30px_-15px_rgba(0,0,0,0.05)]">
        <p className="text-sm font-semibold tracking-wider text-slate-500 mb-8">
          TECNOLOGÍA EN LA QUE CONFÍAN LAS MEJORES EMPRESAS
        </p>
        <div className="mx-auto flex max-w-5xl flex-wrap justify-center gap-8 px-6 opacity-60 grayscale sm:gap-16 lg:px-8">
          {/* Simulated logos */}
          {[1, 2, 3, 4, 5].map((i) => (
             <div key={i} className="flex items-center gap-2 text-xl font-bold font-serif text-slate-900">
               <Hexagon className="h-6 w-6" />
               EnterpriseCo {i}
             </div>
          ))}
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 sm:py-32 relative bg-slate-50">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <h2 className="text-primary font-bold tracking-wide uppercase text-sm mb-3">Plataforma Todo-en-Uno</h2>
            <p className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
              Equipamos a tu equipo con superpoderes
            </p>
            <p className="mt-4 text-lg text-slate-600">
              Deleita a tus clientes con tiempos de respuesta bajo 1 minuto gracias a nuestra interfaz ultrarrápida y automatizaciones.
            </p>
          </div>
          
          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
            <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
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

      {/* Metric / Highlights Section */}
      <section className="relative overflow-hidden border-t border-slate-200 bg-white py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-x-8 gap-y-16 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                Rendimiento de grado empresarial <br/> <span className="text-primary">sin compromisos</span>
              </h2>
              <p className="mt-6 text-lg leading-8 text-slate-600">
                Diseñamos Hivvo desde cero para procesar miles de mensajes por segundo sin latencia. Tu negocio nunca se detiene, y nuestra plataforma tampoco.
              </p>
              <dl className="mt-10 grid grid-cols-2 gap-x-8 gap-y-10 border-t border-slate-100 pt-10 sm:grid-cols-2">
                {metrics.map((stat) => (
                  <div key={stat.label}>
                    <dt className="text-sm font-semibold text-slate-500 uppercase tracking-wider">{stat.label}</dt>
                    <dd className="mt-2 text-4xl font-extrabold tracking-tight text-slate-900">{stat.value}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-10 flex items-center gap-x-6">
                 <Button onClick={() => router.push("/login")} size="lg" className="rounded-full bg-slate-900 text-white hover:bg-slate-800 shadow-lg">Comenzar evaluación</Button>
              </div>
            </div>
            
            <div className="relative lg:ml-auto flex items-center justify-center">
               <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 to-accent/10 blur-3xl rounded-full" />
               <div className="relative w-full max-w-md bg-white border border-slate-200/60 rounded-3xl p-8 backdrop-blur-sm shadow-2xl">
                 <div className="space-y-6">
                    <div className="flex items-center gap-4">
                       <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                         <CheckCircle2 className="text-primary h-5 w-5" />
                       </div>
                       <span className="text-slate-800 font-semibold text-lg">Distribución de carga automática</span>
                    </div>
                    <div className="h-px bg-slate-100" />
                    <div className="flex items-center gap-4">
                       <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                         <CheckCircle2 className="text-primary h-5 w-5" />
                       </div>
                       <span className="text-slate-800 font-semibold text-lg">Cumplimiento GDPR & SOC2</span>
                    </div>
                    <div className="h-px bg-slate-100" />
                    <div className="flex items-center gap-4">
                       <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                         <CheckCircle2 className="text-primary h-5 w-5" />
                       </div>
                       <span className="text-slate-800 font-semibold text-lg">Integración CRM nativa</span>
                    </div>
                    <div className="h-px bg-slate-100" />
                    <div className="flex items-center gap-4">
                       <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                         <CheckCircle2 className="text-primary h-5 w-5" />
                       </div>
                       <span className="text-slate-800 font-semibold text-lg">Webhooks bidireccionales</span>
                    </div>
                 </div>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative isolate px-6 py-24 sm:py-32 lg:px-8 border-t border-slate-200">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,var(--tw-gradient-stops))] from-primary/5 via-slate-50 to-slate-50" />
        <div className="mx-auto max-w-4xl text-center">
           <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/30">
             <Bot className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            Únete a la revolución conversacional
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-slate-600">
            Digitaliza tus canales de venta y soporte con la plataforma más avanzada del mercado. Configuración en minutos.
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Button size="lg" className="rounded-full bg-primary text-white hover:bg-primary/90 shadow-xl shadow-primary/20 h-14 px-8 text-lg font-semibold transition-transform hover:scale-105" onClick={() => router.push("/login")}>
              Crear tu workspace
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
          <p className="mt-4 text-sm font-medium text-slate-500">Prueba gratuita de 14 días. No requiere tarjeta de crédito.</p>
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
                La plataforma de operaciones de WhatsApp para equipos modernos y empresas de alto crecimiento.
              </p>
            </div>
            <div className="mt-16 grid grid-cols-2 gap-8 xl:col-span-2 xl:mt-0">
              <div className="md:grid md:grid-cols-2 md:gap-8">
                <div>
                  <h3 className="text-sm font-semibold leading-6 text-slate-900">Producto</h3>
                  <ul role="list" className="mt-6 space-y-4">
                    <li><a href="#" className="text-sm leading-6 text-slate-600 hover:text-slate-900 transition-colors">Características</a></li>
                    <li><a href="#" className="text-sm leading-6 text-slate-600 hover:text-slate-900 transition-colors">Integraciones</a></li>
                    <li><a href="#" className="text-sm leading-6 text-slate-600 hover:text-slate-900 transition-colors">Precios</a></li>
                    <li><a href="#" className="text-sm leading-6 text-slate-600 hover:text-slate-900 transition-colors">Changelog</a></li>
                  </ul>
                </div>
                <div className="mt-10 md:mt-0">
                  <h3 className="text-sm font-semibold leading-6 text-slate-900">Empresa</h3>
                  <ul role="list" className="mt-6 space-y-4">
                    <li><a href="#" className="text-sm leading-6 text-slate-600 hover:text-slate-900 transition-colors">Sobre nosotros</a></li>
                    <li><a href="#" className="text-sm leading-6 text-slate-600 hover:text-slate-900 transition-colors">Blog</a></li>
                    <li><a href="#" className="text-sm leading-6 text-slate-600 hover:text-slate-900 transition-colors">Programadores</a></li>
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
    </div>
  );
}
