"use client";

import Link from "next/link";
import { AsisLogo } from "@/components/brand/asis-logo";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPolicyPage() {
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
          Politica de Privacidad
        </h1>
        <p className="text-sm text-slate-500 mb-12">
          Ultima actualizacion: 2 de abril de 2026
        </p>

        <div className="space-y-6 text-slate-600 leading-7 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:text-slate-900 [&_h2]:mt-12 [&_h2]:mb-4 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-slate-800 [&_h3]:mt-8 [&_h3]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-3 [&_li]:pl-1 [&_strong]:text-slate-800 [&_strong]:font-semibold [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-primary/80">
          <h2>1. Introduccion</h2>
          <p>
            asis.chat (&quot;nosotros&quot;, &quot;nuestro&quot; o &quot;la
            Plataforma&quot;) es una plataforma de gestion de comunicaciones por
            WhatsApp para equipos de trabajo. Esta Politica de Privacidad
            describe como recopilamos, usamos, almacenamos y protegemos la
            informacion personal en relacion con nuestros servicios, incluyendo
            el uso de la API de WhatsApp Business proporcionada por Meta
            Platforms, Inc.
          </p>
          <p>
            Al utilizar asis.chat, aceptas las practicas descritas en esta
            politica. Si no estas de acuerdo, por favor no utilices nuestros
            servicios.
          </p>

          <h2>2. Informacion que recopilamos</h2>

          <h3>2.1 Informacion proporcionada por los usuarios</h3>
          <ul>
            <li>
              <strong>Datos de cuenta:</strong> nombre, direccion de correo
              electronico y credenciales de acceso de los agentes (miembros del
              equipo) que utilizan la plataforma.
            </li>
            <li>
              <strong>Configuracion de agentes de IA:</strong> claves de API de
              proveedores de modelos de lenguaje (OpenAI, Anthropic, Google
              Gemini, OpenRouter), prompts de sistema y bases de conocimiento
              configuradas por el usuario.
            </li>
            <li>
              <strong>Numeros de telefono de WhatsApp Business:</strong> numeros
              registrados y conectados a traves de la API de WhatsApp Business.
            </li>
          </ul>

          <h3>2.2 Informacion recopilada automaticamente</h3>
          <ul>
            <li>
              <strong>Mensajes de WhatsApp:</strong> contenido de los mensajes
              enviados y recibidos a traves de los numeros de WhatsApp Business
              conectados, incluyendo texto, imagenes, documentos y otros medios
              soportados por la API de WhatsApp Business.
            </li>
            <li>
              <strong>Datos de contacto:</strong> nombres, numeros de telefono y
              otra informacion de perfil de los contactos que interactuan con los
              numeros de WhatsApp Business conectados.
            </li>
            <li>
              <strong>Metadatos de conversacion:</strong> marcas de tiempo,
              estado de entrega, asignaciones de agentes y notas internas.
            </li>
            <li>
              <strong>Datos de uso:</strong> registros de acceso, acciones
              realizadas en la plataforma y datos de sesion.
            </li>
          </ul>

          <h2>3. Como utilizamos la informacion</h2>
          <p>Utilizamos la informacion recopilada para:</p>
          <ul>
            <li>
              Proporcionar, operar y mantener la plataforma de comunicaciones.
            </li>
            <li>
              Enrutar y entregar mensajes entre los contactos de WhatsApp y los
              agentes del equipo.
            </li>
            <li>
              Procesar mensajes a traves de agentes de IA configurados por el
              usuario, utilizando los proveedores de modelos de lenguaje
              seleccionados.
            </li>
            <li>
              Gestionar cuentas, roles y permisos de acceso de los agentes.
            </li>
            <li>Mejorar y optimizar la plataforma.</li>
            <li>Cumplir con obligaciones legales y regulatorias.</li>
          </ul>

          <h2>4. Uso de la API de WhatsApp Business</h2>
          <p>
            asis.chat utiliza la API de WhatsApp Business de Meta para enviar y
            recibir mensajes. En relacion con esto:
          </p>
          <ul>
            <li>
              Cumplimos con la{" "}
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
            <li>
              No vendemos, alquilamos ni compartimos los datos de mensajes de
              WhatsApp con terceros para fines publicitarios.
            </li>
            <li>
              Los mensajes son procesados unicamente para el proposito de
              entregar comunicaciones entre el negocio y sus clientes.
            </li>
            <li>
              Cuando un agente de IA esta configurado, el contenido de los
              mensajes puede ser enviado al proveedor de modelos de lenguaje
              seleccionado por el usuario (OpenAI, Anthropic, Google Gemini u
              OpenRouter) exclusivamente para generar respuestas. Cada proveedor
              tiene sus propias politicas de privacidad que recomendamos
              consultar.
            </li>
          </ul>

          <h2>5. Compartir informacion con terceros</h2>
          <p>
            Compartimos informacion personal unicamente en los siguientes casos:
          </p>
          <ul>
            <li>
              <strong>Meta Platforms (WhatsApp):</strong> para el envio y
              recepcion de mensajes a traves de la API de WhatsApp Business.
            </li>
            <li>
              <strong>Proveedores de modelos de IA:</strong> cuando el usuario
              configura un agente de IA, el contenido de los mensajes se envia
              al proveedor seleccionado para generar respuestas automaticas.
            </li>
            <li>
              <strong>Proveedores de infraestructura:</strong> servicios de
              alojamiento y base de datos necesarios para operar la plataforma.
            </li>
            <li>
              <strong>Requerimientos legales:</strong> cuando sea necesario para
              cumplir con la ley, procesos legales o solicitudes gubernamentales.
            </li>
          </ul>

          <h2>6. Almacenamiento y seguridad de datos</h2>
          <ul>
            <li>
              Los datos se almacenan en servidores seguros con cifrado en
              transito (TLS) y en reposo.
            </li>
            <li>
              Las claves de API de proveedores de modelos de lenguaje se
              almacenan de forma cifrada.
            </li>
            <li>
              Implementamos controles de acceso basados en roles para limitar
              quien puede acceder a que informacion dentro de la plataforma.
            </li>
            <li>
              Las contrasenas de los agentes se almacenan utilizando funciones de
              hash seguras.
            </li>
          </ul>

          <h2>7. Retencion de datos</h2>
          <p>
            Conservamos los datos de mensajes y contactos mientras la cuenta del
            tenant este activa y sea necesario para proporcionar el servicio. Los
            usuarios pueden solicitar la eliminacion de sus datos contactandonos
            directamente. Tras la eliminacion de una cuenta, los datos asociados
            se eliminan dentro de un plazo razonable, salvo que la ley requiera
            su conservacion.
          </p>

          <h2>8. Derechos de los usuarios</h2>
          <p>
            Dependiendo de tu jurisdiccion, puedes tener derecho a:
          </p>
          <ul>
            <li>Acceder a los datos personales que tenemos sobre ti.</li>
            <li>Solicitar la correccion de datos inexactos.</li>
            <li>Solicitar la eliminacion de tus datos personales.</li>
            <li>Oponerte al procesamiento de tus datos.</li>
            <li>Solicitar la portabilidad de tus datos.</li>
          </ul>
          <p>
            Para ejercer cualquiera de estos derechos, contactanos a traves de
            la informacion proporcionada al final de esta politica.
          </p>

          <h2>9. Cookies y tecnologias similares</h2>
          <p>
            asis.chat utiliza cookies y almacenamiento local del navegador
            unicamente para mantener tu sesion activa y tus preferencias
            (como el idioma). No utilizamos cookies de seguimiento ni de
            publicidad.
          </p>

          <h2>10. Cambios a esta politica</h2>
          <p>
            Podemos actualizar esta Politica de Privacidad periodicamente.
            Publicaremos cualquier cambio en esta pagina con una fecha de
            actualizacion revisada. El uso continuado de la plataforma despues
            de los cambios constituye la aceptacion de la politica modificada.
          </p>

          <h2>11. Contacto</h2>
          <p>
            Si tienes preguntas sobre esta Politica de Privacidad o sobre como
            manejamos tus datos, puedes contactarnos en:
          </p>
          <ul>
            <li>
              <strong>Email:</strong>{" "}
              <a href="mailto:privacidad@asis.chat">
                privacidad@asis.chat
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
              className="text-slate-600 hover:text-slate-900 font-medium transition-colors"
            >
              Privacidad
            </Link>
            <Link
              href="/terms"
              className="text-slate-600 hover:text-slate-900 transition-colors"
            >
              Terminos
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
