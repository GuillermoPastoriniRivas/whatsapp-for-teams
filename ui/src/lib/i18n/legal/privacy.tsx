import type { Locale } from "@/stores/locale.store";
import { LEGAL_ENTITY, legalEntityLine } from "@/lib/legal-entity";

export const privacyContent: Record<Locale, React.ReactNode> = {
  es: (
    <>
      <h2>1. Introduccion</h2>
      <p>
        Fluws (&quot;nosotros&quot;, &quot;nuestro&quot; o &quot;la
        Plataforma&quot;) es una plataforma de gestion de comunicaciones por
        WhatsApp para equipos de trabajo, operada por{" "}
        <strong>{LEGAL_ENTITY.name}</strong>. Esta Politica de Privacidad
        describe como recopilamos, usamos, almacenamos y protegemos la
        informacion personal en relacion con nuestros servicios, incluyendo
        el uso de la API de WhatsApp Business proporcionada por Meta
        Platforms, Inc.
      </p>
      <p>
        Al utilizar Fluws, aceptas las practicas descritas en esta
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
          <strong>Configuracion de agentes de IA:</strong> perfil del
          negocio, instrucciones y bases de conocimiento que el usuario
          configura para sus agentes de IA. Las claves del proveedor de
          modelos las administra Fluws; el usuario no carga ninguna.
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
        Fluws utiliza la API de WhatsApp Business de Meta para enviar y
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
          Cuando un agente de IA esta activo, el contenido de los mensajes
          se envia a <strong>OpenAI</strong> exclusivamente para generar la
          respuesta. Es el unico proveedor de modelos que utilizamos, y se
          rige por su propia politica de privacidad, que recomendamos
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
          <strong>OpenAI:</strong> cuando un agente de IA esta activo, el
          contenido de la conversacion se envia a OpenAI para generar la
          respuesta automatica. Es el unico proveedor de modelos que
          utilizamos y lo administra Fluws.
        </li>
        <li>
          <strong>Amazon Web Services:</strong> alojamiento de la
          aplicacion, almacenamiento de archivos y envio de correo.
        </li>
        <li>
          <strong>MongoDB Atlas:</strong> base de datos donde se almacenan
          las conversaciones y los contactos.
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
          Los archivos multimedia se almacenan en un bucket privado, cifrado
          en reposo y accesible unicamente mediante URLs firmadas de
          duracion limitada.
        </li>
        <li>
          Implementamos controles de acceso basados en roles para limitar
          quien puede acceder a que informacion dentro de la plataforma.
        </li>
        <li>
          Las contrasenas de los agentes se almacenan utilizando funciones de
          hash seguras.
        </li>
        <li>
          Las credenciales de acceso a las APIs de mensajeria (los tokens de
          WhatsApp Business y las claves de los demas proveedores) se
          almacenan cifradas con AES-256-GCM.
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
        Fluws utiliza cookies y almacenamiento local del navegador
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
          <strong>Responsable del tratamiento:</strong> {legalEntityLine()}
        </li>
        <li>
          <strong>Email:</strong>{" "}
          <a href="mailto:contact@fluws.com">
            contact@fluws.com
          </a>
        </li>
        <li>
          <strong>Sitio web:</strong>{" "}
          <a href="https://fluws.com">
            https://fluws.com
          </a>
        </li>
      </ul>
    </>
  ),
  en: (
    <>
      <h2>1. Introduction</h2>
      <p>
        Fluws (&quot;we&quot;, &quot;our&quot; or &quot;the
        Platform&quot;) is a WhatsApp communications management platform
        for teams, operated by <strong>{LEGAL_ENTITY.name}</strong>. This
        Privacy Policy describes how we collect, use,
        store, and protect personal information in connection with our
        services, including the use of the WhatsApp Business API provided
        by Meta Platforms, Inc.
      </p>
      <p>
        By using Fluws, you accept the practices described in this
        policy. If you disagree, please do not use our services.
      </p>

      <h2>2. Information we collect</h2>

      <h3>2.1 Information provided by users</h3>
      <ul>
        <li>
          <strong>Account data:</strong> name, email address, and login
          credentials of the agents (team members) who use the platform.
        </li>
        <li>
          <strong>AI agent configuration:</strong> business profile,
          instructions, and knowledge bases the user configures for their
          AI agents. Model provider keys are managed by Fluws; users do
          not supply any.
        </li>
        <li>
          <strong>WhatsApp Business phone numbers:</strong> numbers
          registered and connected through the WhatsApp Business API.
        </li>
      </ul>

      <h3>2.2 Information collected automatically</h3>
      <ul>
        <li>
          <strong>WhatsApp messages:</strong> content of messages sent and
          received through connected WhatsApp Business numbers, including
          text, images, documents, and other media supported by the
          WhatsApp Business API.
        </li>
        <li>
          <strong>Contact data:</strong> names, phone numbers, and other
          profile information of contacts who interact with connected
          WhatsApp Business numbers.
        </li>
        <li>
          <strong>Conversation metadata:</strong> timestamps, delivery
          status, agent assignments, and internal notes.
        </li>
        <li>
          <strong>Usage data:</strong> access logs, actions performed on
          the platform, and session data.
        </li>
      </ul>

      <h2>3. How we use the information</h2>
      <p>We use the collected information to:</p>
      <ul>
        <li>
          Provide, operate, and maintain the communications platform.
        </li>
        <li>
          Route and deliver messages between WhatsApp contacts and team
          agents.
        </li>
        <li>
          Process messages through user-configured AI agents, using the
          selected language model providers.
        </li>
        <li>
          Manage accounts, roles, and access permissions for agents.
        </li>
        <li>Improve and optimize the platform.</li>
        <li>Comply with legal and regulatory obligations.</li>
      </ul>

      <h2>4. Use of the WhatsApp Business API</h2>
      <p>
        Fluws uses the Meta WhatsApp Business API to send and receive
        messages. In this regard:
      </p>
      <ul>
        <li>
          We comply with the{" "}
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
        <li>
          We do not sell, rent, or share WhatsApp message data with third
          parties for advertising purposes.
        </li>
        <li>
          Messages are processed solely for the purpose of delivering
          communications between the business and its customers.
        </li>
        <li>
          When an AI agent is active, message content is sent to{" "}
          <strong>OpenAI</strong> exclusively to generate the reply. It is
          the only model provider we use, and it is governed by its own
          privacy policy, which we recommend reviewing.
        </li>
      </ul>

      <h2>5. Sharing information with third parties</h2>
      <p>
        We share personal information only in the following cases:
      </p>
      <ul>
        <li>
          <strong>Meta Platforms (WhatsApp):</strong> for sending and
          receiving messages through the WhatsApp Business API.
        </li>
        <li>
          <strong>OpenAI:</strong> when an AI agent is active, conversation
          content is sent to OpenAI to generate the automated reply. It is
          the only model provider we use, and it is managed by Fluws.
        </li>
        <li>
          <strong>Amazon Web Services:</strong> application hosting, file
          storage, and email delivery.
        </li>
        <li>
          <strong>MongoDB Atlas:</strong> the database where conversations
          and contacts are stored.
        </li>
        <li>
          <strong>Legal requirements:</strong> when necessary to comply
          with the law, legal processes, or government requests.
        </li>
      </ul>

      <h2>6. Data storage and security</h2>
      <ul>
        <li>
          Data is stored on secure servers with encryption in transit (TLS)
          and at rest.
        </li>
        <li>
          Media files are stored in a private bucket, encrypted at rest and
          accessible only through short-lived signed URLs.
        </li>
        <li>
          We implement role-based access controls to limit who can access
          what information within the platform.
        </li>
        <li>
          Agent passwords are stored using secure hash functions.
        </li>
        <li>
          Messaging API credentials (WhatsApp Business tokens and the keys
          for other providers) are stored encrypted with AES-256-GCM.
        </li>
      </ul>

      <h2>7. Data retention</h2>
      <p>
        We retain message and contact data as long as the tenant account is
        active and necessary to provide the service. Users may request
        deletion of their data by contacting us directly. After account
        deletion, associated data is removed within a reasonable time
        frame, unless the law requires its retention.
      </p>

      <h2>8. User rights</h2>
      <p>
        Depending on your jurisdiction, you may have the right to:
      </p>
      <ul>
        <li>Access the personal data we hold about you.</li>
        <li>Request correction of inaccurate data.</li>
        <li>Request deletion of your personal data.</li>
        <li>Object to the processing of your data.</li>
        <li>Request portability of your data.</li>
      </ul>
      <p>
        To exercise any of these rights, contact us through the information
        provided at the end of this policy.
      </p>

      <h2>9. Cookies and similar technologies</h2>
      <p>
        Fluws uses cookies and browser local storage solely to maintain
        your active session and preferences (such as language). We do not
        use tracking or advertising cookies.
      </p>

      <h2>10. Changes to this policy</h2>
      <p>
        We may update this Privacy Policy periodically. We will post any
        changes on this page with a revised update date. Continued use of
        the platform after changes constitutes acceptance of the modified
        policy.
      </p>

      <h2>11. Contact</h2>
      <p>
        If you have questions about this Privacy Policy or how we handle
        your data, you can contact us at:
      </p>
      <ul>
        <li>
          <strong>Data controller:</strong> {legalEntityLine()}
        </li>
        <li>
          <strong>Email:</strong>{" "}
          <a href="mailto:contact@fluws.com">
            contact@fluws.com
          </a>
        </li>
        <li>
          <strong>Website:</strong>{" "}
          <a href="https://fluws.com">
            https://fluws.com
          </a>
        </li>
      </ul>
    </>
  ),
};
