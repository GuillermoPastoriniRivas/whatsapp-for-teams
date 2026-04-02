import Link from "next/link";
import type { Locale } from "@/stores/locale.store";

export const termsContent: Record<Locale, React.ReactNode> = {
  es: (
    <>
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
    </>
  ),
  en: (
    <>
      <h2>1. Acceptance of terms</h2>
      <p>
        By accessing or using asis.chat (&quot;the Platform&quot;,
        &quot;the Service&quot;), you agree to be bound by these Terms and
        Conditions of Service (&quot;Terms&quot;). If you do not agree with
        these Terms, do not use the Service. If you use the Service on
        behalf of an organization, you accept these Terms on behalf of that
        organization.
      </p>

      <h2>2. Description of the service</h2>
      <p>
        asis.chat is a communications management platform that enables
        teams to:
      </p>
      <ul>
        <li>
          Connect and manage multiple WhatsApp Business numbers through
          the Meta WhatsApp Business API.
        </li>
        <li>
          Receive, assign, and respond to WhatsApp conversations
          collaboratively.
        </li>
        <li>
          Configure artificial intelligence (AI) agents that use
          third-party language models to generate automatic responses.
        </li>
        <li>
          Manage contacts, agents, roles, and access permissions.
        </li>
      </ul>

      <h2>3. Accounts and access</h2>
      <ul>
        <li>
          Each organization (tenant) can register multiple agents (users)
          with administrator or agent roles.
        </li>
        <li>
          You are responsible for maintaining the confidentiality of your
          login credentials.
        </li>
        <li>
          You must notify us immediately if you suspect unauthorized use
          of your account.
        </li>
        <li>
          Administrators are responsible for managing the permissions and
          access of agents in their organization.
        </li>
      </ul>

      <h2>4. Acceptable use</h2>
      <p>By using asis.chat, you agree to:</p>
      <ul>
        <li>
          Comply with all applicable laws and regulations, including data
          protection and privacy laws.
        </li>
        <li>
          Comply with the{" "}
          <a
            href="https://www.whatsapp.com/legal/business-policy/"
            target="_blank"
            rel="noopener noreferrer"
          >
            WhatsApp Business Policy
          </a>{" "}
          and the{" "}
          <a
            href="https://www.whatsapp.com/legal/business-solution-terms/"
            target="_blank"
            rel="noopener noreferrer"
          >
            WhatsApp Business Platform Policy
          </a>
          .
        </li>
        <li>Not send spam, unsolicited messages, or prohibited content through the platform.</li>
        <li>
          Not use the Service for illegal, fraudulent, or rights-violating
          activities.
        </li>
        <li>
          Not attempt to access accounts, systems, or data that do not
          belong to you.
        </li>
        <li>
          Not reverse engineer, decompile, or disassemble any part of the
          Service.
        </li>
        <li>
          Obtain appropriate consent from contacts before sending them
          messages through WhatsApp, in accordance with applicable laws.
        </li>
      </ul>

      <h2>5. WhatsApp Business API integration</h2>
      <p>
        The Service uses the WhatsApp Business API provided by Meta
        Platforms, Inc. By using this functionality:
      </p>
      <ul>
        <li>
          You acknowledge that WhatsApp and Meta have their own terms of
          service that also apply to use of the API.
        </li>
        <li>
          You are responsible for complying with all Meta policies related
          to use of the WhatsApp Business API.
        </li>
        <li>
          You understand that the availability of the WhatsApp Business
          API depends on Meta and may be subject to changes or
          interruptions outside our control.
        </li>
        <li>
          We do not guarantee message delivery, as this depends on
          WhatsApp infrastructure.
        </li>
      </ul>

      <h2>6. Artificial intelligence agents</h2>
      <p>
        asis.chat allows configuring AI agents that use third-party
        language models. Regarding this functionality:
      </p>
      <ul>
        <li>
          You are responsible for providing and managing your own API keys
          for language model providers (OpenAI, Anthropic, Google Gemini,
          OpenRouter).
        </li>
        <li>
          You are responsible for the costs associated with using said
          language model providers.
        </li>
        <li>
          Responses generated by AI agents are your responsibility.
          asis.chat does not guarantee the accuracy, suitability, or
          legality of AI-generated content.
        </li>
        <li>
          You must properly review and configure AI agents, including
          escalation rules to human agents.
        </li>
        <li>
          Messages sent to language model providers are subject to the
          privacy policies and terms of service of each provider.
        </li>
      </ul>

      <h2>7. Intellectual property</h2>
      <ul>
        <li>
          asis.chat and all its content, features, and technology are owned
          by asis.chat and protected by applicable intellectual property
          laws.
        </li>
        <li>
          You retain all rights to the data and content you upload or
          transmit through the Platform.
        </li>
        <li>
          You grant us a limited license to process your data solely for
          the purpose of providing the Service.
        </li>
      </ul>

      <h2>8. Privacy and data protection</h2>
      <p>
        The processing of personal data is governed by our{" "}
        <Link href="/privacy">
          Privacy Policy
        </Link>
        , which forms an integral part of these Terms. We recommend reading
        it carefully.
      </p>

      <h2>9. Limitation of liability</h2>
      <ul>
        <li>
          The Service is provided &quot;as is&quot; and &quot;as
          available&quot;, without warranties of any kind, express or
          implied.
        </li>
        <li>
          We do not guarantee that the Service will be uninterrupted,
          secure, or error-free.
        </li>
        <li>
          To the maximum extent permitted by law, asis.chat shall not be
          liable for indirect, incidental, special, consequential, or
          punitive damages, or for loss of data, profits, revenue, or
          business opportunities.
        </li>
        <li>
          We are not responsible for the content of messages sent or
          received through the Platform, nor for responses generated by AI
          agents.
        </li>
      </ul>

      <h2>10. Suspension and termination</h2>
      <ul>
        <li>
          We may suspend or cancel your access to the Service if you
          violate these Terms or if necessary to protect the integrity of
          the Platform.
        </li>
        <li>
          You may stop using the Service at any time and request deletion
          of your account and associated data.
        </li>
        <li>
          Upon termination, your data will be deleted in accordance with
          our Privacy Policy.
        </li>
      </ul>

      <h2>11. Modifications to the service and terms</h2>
      <p>
        We reserve the right to modify these Terms or the Service at any
        time. Changes will take effect upon being posted on this page.
        Continued use of the Service after publication of changes
        constitutes acceptance of the modified Terms.
      </p>

      <h2>12. Governing law</h2>
      <p>
        These Terms are governed by and construed in accordance with the
        applicable laws in the jurisdiction where asis.chat operates. Any
        dispute shall be submitted to the jurisdiction of the competent
        courts.
      </p>

      <h2>13. Contact</h2>
      <p>
        For questions about these Terms, you can contact us at:
      </p>
      <ul>
        <li>
          <strong>Email:</strong>{" "}
          <a href="mailto:legal@asis.chat">
            legal@asis.chat
          </a>
        </li>
        <li>
          <strong>Website:</strong>{" "}
          <a href="https://asis.chat">
            https://asis.chat
          </a>
        </li>
      </ul>
    </>
  ),
};
