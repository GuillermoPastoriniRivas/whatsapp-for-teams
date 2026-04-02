"use client";

import Link from "next/link";
import { AsisLogo } from "@/components/brand/asis-logo";
import { ArrowLeft } from "lucide-react";

export default function TermsOfServicePage() {
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
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al inicio
          </Link>
        </div>
      </nav>

      {/* Content */}
      <article className="mx-auto max-w-4xl px-6 py-16">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 mb-2">
          Terminos y Condiciones de Servicio
        </h1>
        <p className="text-sm text-slate-500 mb-12">
          Ultima actualizacion: 2 de abril de 2026
        </p>

        <div className="space-y-6 text-slate-600 leading-7 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:text-slate-900 [&_h2]:mt-12 [&_h2]:mb-4 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-slate-800 [&_h3]:mt-8 [&_h3]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-3 [&_li]:pl-1 [&_strong]:text-slate-800 [&_strong]:font-semibold [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-primary/80">
          <h2>1. Aceptacion de los terminos</h2>
          <p>
            Al acceder o utilizar asis.chat (&quot;la Plataforma&quot;,
            &quot;el Servicio&quot;), aceptas estar sujeto a estos Terminos y
            Condiciones de Servicio (&quot;Terminos&quot;). Si no estas de
            acuerdo con estos Terminos, no utilices el Servicio. Si utilizas el
            Servicio en nombre de una organizacion, aceptas estos Terminos en
            representacion de dicha organizacion.
          </p>

          <h2>2. Descripcion del servicio</h2>
          <p>
            asis.chat es una plataforma de gestion de comunicaciones que permite
            a equipos de trabajo:
          </p>
          <ul>
            <li>
              Conectar y gestionar multiples numeros de WhatsApp Business a
              traves de la API de WhatsApp Business de Meta.
            </li>
            <li>
              Recibir, asignar y responder conversaciones de WhatsApp de forma
              colaborativa.
            </li>
            <li>
              Configurar agentes de inteligencia artificial (IA) que utilizan
              modelos de lenguaje de terceros para generar respuestas
              automaticas.
            </li>
            <li>
              Administrar contactos, agentes, roles y permisos de acceso.
            </li>
          </ul>

          <h2>3. Cuentas y acceso</h2>
          <ul>
            <li>
              Cada organizacion (tenant) puede registrar multiples agentes
              (usuarios) con roles de administrador o agente.
            </li>
            <li>
              Eres responsable de mantener la confidencialidad de tus
              credenciales de acceso.
            </li>
            <li>
              Debes notificarnos inmediatamente si sospechas de un uso no
              autorizado de tu cuenta.
            </li>
            <li>
              Los administradores son responsables de gestionar los permisos y
              el acceso de los agentes de su organizacion.
            </li>
          </ul>

          <h2>4. Uso aceptable</h2>
          <p>Al utilizar asis.chat, te comprometes a:</p>
          <ul>
            <li>
              Cumplir con todas las leyes y regulaciones aplicables, incluyendo
              las leyes de proteccion de datos y privacidad.
            </li>
            <li>
              Cumplir con la{" "}
              <a
                href="https://www.whatsapp.com/legal/business-policy/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Politica de WhatsApp Business
              </a>{" "}
              y la{" "}
              <a
                href="https://www.whatsapp.com/legal/business-solution-terms/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Politica de la Plataforma de WhatsApp Business
              </a>
              .
            </li>
            <li>No enviar spam, mensajes no solicitados ni contenido prohibido a traves de la plataforma.</li>
            <li>
              No utilizar el Servicio para actividades ilegales, fraudulentas o
              que violen los derechos de terceros.
            </li>
            <li>
              No intentar acceder a cuentas, sistemas o datos que no te
              pertenezcan.
            </li>
            <li>
              No realizar ingenieria inversa, descompilar o desensamblar
              cualquier parte del Servicio.
            </li>
            <li>
              Obtener el consentimiento adecuado de los contactos antes de
              enviarles mensajes a traves de WhatsApp, conforme a las leyes
              aplicables.
            </li>
          </ul>

          <h2>5. Integracion con WhatsApp Business API</h2>
          <p>
            El Servicio utiliza la API de WhatsApp Business proporcionada por
            Meta Platforms, Inc. Al usar esta funcionalidad:
          </p>
          <ul>
            <li>
              Reconoces que WhatsApp y Meta tienen sus propios terminos de
              servicio que tambien se aplican al uso de la API.
            </li>
            <li>
              Eres responsable de cumplir con todas las politicas de Meta
              relacionadas con el uso de la API de WhatsApp Business.
            </li>
            <li>
              Entiendes que la disponibilidad de la API de WhatsApp Business
              depende de Meta y puede estar sujeta a cambios o interrupciones
              fuera de nuestro control.
            </li>
            <li>
              No garantizamos la entrega de mensajes, ya que esta depende de
              la infraestructura de WhatsApp.
            </li>
          </ul>

          <h2>6. Agentes de inteligencia artificial</h2>
          <p>
            asis.chat permite configurar agentes de IA que utilizan modelos de
            lenguaje de terceros. En relacion con esta funcionalidad:
          </p>
          <ul>
            <li>
              Eres responsable de proporcionar y gestionar tus propias claves
              de API para los proveedores de modelos de lenguaje (OpenAI,
              Anthropic, Google Gemini, OpenRouter).
            </li>
            <li>
              Eres responsable de los costos asociados al uso de dichos
              proveedores de modelos de lenguaje.
            </li>
            <li>
              Las respuestas generadas por los agentes de IA son tu
              responsabilidad. asis.chat no garantiza la exactitud, adecuacion
              ni legalidad del contenido generado por la IA.
            </li>
            <li>
              Debes revisar y configurar adecuadamente los agentes de IA,
              incluyendo las reglas de escalamiento a agentes humanos.
            </li>
            <li>
              Los mensajes enviados a los proveedores de modelos de lenguaje
              estan sujetos a las politicas de privacidad y terminos de servicio
              de cada proveedor.
            </li>
          </ul>

          <h2>7. Propiedad intelectual</h2>
          <ul>
            <li>
              asis.chat y todo su contenido, funcionalidades y tecnologia son
              propiedad de asis.chat y estan protegidos por las leyes de
              propiedad intelectual aplicables.
            </li>
            <li>
              Conservas todos los derechos sobre los datos y contenido que
              subas o transmitas a traves de la Plataforma.
            </li>
            <li>
              Nos otorgas una licencia limitada para procesar tus datos
              unicamente con el fin de proporcionar el Servicio.
            </li>
          </ul>

          <h2>8. Privacidad y proteccion de datos</h2>
          <p>
            El tratamiento de datos personales se rige por nuestra{" "}
            <Link href="/privacy">
              Politica de Privacidad
            </Link>
            , que forma parte integral de estos Terminos. Te recomendamos
            leerla detenidamente.
          </p>

          <h2>9. Limitacion de responsabilidad</h2>
          <ul>
            <li>
              El Servicio se proporciona &quot;tal cual&quot; y &quot;segun
              disponibilidad&quot;, sin garantias de ningun tipo, expresas o
              implicitas.
            </li>
            <li>
              No garantizamos que el Servicio sera ininterrumpido, seguro o
              libre de errores.
            </li>
            <li>
              En la maxima medida permitida por la ley, asis.chat no sera
              responsable por danos indirectos, incidentales, especiales,
              consecuentes o punitivos, ni por la perdida de datos, beneficios,
              ingresos o oportunidades de negocio.
            </li>
            <li>
              No somos responsables por el contenido de los mensajes enviados o
              recibidos a traves de la Plataforma, ni por las respuestas
              generadas por agentes de IA.
            </li>
          </ul>

          <h2>10. Suspension y terminacion</h2>
          <ul>
            <li>
              Podemos suspender o cancelar tu acceso al Servicio si violas estos
              Terminos o si es necesario para proteger la integridad de la
              Plataforma.
            </li>
            <li>
              Puedes dejar de usar el Servicio en cualquier momento y solicitar
              la eliminacion de tu cuenta y datos asociados.
            </li>
            <li>
              Tras la terminacion, tus datos seran eliminados conforme a
              nuestra Politica de Privacidad.
            </li>
          </ul>

          <h2>11. Modificaciones al servicio y los terminos</h2>
          <p>
            Nos reservamos el derecho de modificar estos Terminos o el Servicio
            en cualquier momento. Los cambios entraran en vigor al ser
            publicados en esta pagina. El uso continuado del Servicio despues
            de la publicacion de los cambios constituye la aceptacion de los
            Terminos modificados.
          </p>

          <h2>12. Ley aplicable</h2>
          <p>
            Estos Terminos se rigen e interpretan de acuerdo con las leyes
            aplicables en la jurisdiccion donde opera asis.chat. Cualquier
            disputa sera sometida a la jurisdiccion de los tribunales
            competentes.
          </p>

          <h2>13. Contacto</h2>
          <p>
            Para preguntas sobre estos Terminos, puedes contactarnos en:
          </p>
          <ul>
            <li>
              <strong>Email:</strong>{" "}
              <a href="mailto:legal@asis.chat">
                legal@asis.chat
              </a>
            </li>
            <li>
              <strong>Sitio web:</strong>{" "}
              <a href="https://asis.chat">
                https://asis.chat
              </a>
            </li>
          </ul>
        </div>
      </article>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-slate-50 py-8">
        <div className="mx-auto max-w-4xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-500">
            &copy; {new Date().getFullYear()} asis.chat — Todos los derechos
            reservados.
          </p>
          <div className="flex gap-6 text-sm">
            <Link
              href="/privacy"
              className="text-slate-600 hover:text-slate-900 transition-colors"
            >
              Privacidad
            </Link>
            <Link
              href="/terms"
              className="text-slate-600 hover:text-slate-900 font-medium transition-colors"
            >
              Terminos
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
