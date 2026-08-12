import { MessagingProvider } from '../../domain/enums/messaging-provider.enum.js';
import type { OutboundBillingContext } from '../../domain/value-objects/outbound-billing.js';

export interface TemplateSendComponent {
  type: 'header' | 'body' | 'button';
  sub_type?: 'quick_reply' | 'url' | 'copy_code';
  index?: number;
  parameters: Array<{
    type: 'text' | 'image' | 'video' | 'document' | 'payload' | 'coupon_code' | 'location';
    /** Required by Meta for named (non-positional) template parameters. */
    parameter_name?: string;
    text?: string;
    payload?: string;
    coupon_code?: string;
    image?: { link: string };
    video?: { link: string };
    document?: { link: string };
    /** Header `LOCATION`: coordenadas, no link. */
    location?: { latitude: string; longitude: string; name?: string; address?: string };
  }>;
}

export interface TemplateSendPayload {
  name: string;
  language: string;
  components?: TemplateSendComponent[];
}

/**
 * Mensaje interactivo. Se modela como un objeto con `kind` y campos opcionales
 * —no como unión— porque se persiste tal cual en `Message.interactivePayload` y
 * la UI lo lee sin discriminar.
 */
export interface InteractiveSendPayload {
  kind: 'buttons' | 'list' | 'cta_url' | 'location_request' | 'address_message' | 'flow';
  body: string;
  footer?: string;
  /** Encabezado de texto, para los tipos que lo admiten. */
  header?: string;
  /** kind 'buttons': 1–3 botones (title ≤ 20 chars) */
  buttons?: Array<{ id: string; title: string }>;
  /** kind 'list': texto del botón que abre la lista. kind 'cta_url': texto del CTA. */
  buttonText?: string;
  /** kind 'list': 1–10 filas (title ≤ 24, description ≤ 72) */
  rows?: Array<{ id: string; title: string; description?: string }>;
  /**
   * kind 'cta_url': el link que abre el botón. Es la forma de mandar un botón
   * con URL **dentro de la ventana de 24 h sin plantilla**.
   */
  url?: string;
  /**
   * kind 'address_message': país en ISO-2. Meta sólo habilita el formulario de
   * dirección en algunos mercados (India y Singapur), y lo exige.
   */
  country?: string;
  /** kind 'flow': el formulario nativo de WhatsApp. */
  flow?: {
    id: string;
    /**
     * Lo que devuelve el cliente **no incluye el id del Flow**: Meta manda un
     * `nfm_reply` con el `flow_token` que mandamos nosotros. Es la única forma
     * de saber a qué envío corresponde una respuesta.
     */
    token: string;
    cta: string;
    /** Pantalla de entrada. Vacío = la primera del Flow. */
    screen?: string;
    /** Datos iniciales de esa pantalla. */
    data?: Record<string, unknown>;
    /** 'published' (default) o 'draft' para probar uno sin publicar. */
    mode?: 'published' | 'draft';
    /** `data_exchange` solo si el Flow tiene endpoint; si no, `navigate`. */
    action?: 'navigate' | 'data_exchange';
  };
}

/** Tarjeta de contacto saliente. Meta exige al menos `name.formatted_name`. */
export interface OutboundContactCard {
  name: { formatted_name: string; first_name?: string; last_name?: string };
  phones?: Array<{ phone: string; type?: string; wa_id?: string }>;
  emails?: Array<{ email: string; type?: string }>;
  org?: { company?: string; department?: string; title?: string };
}

export interface SendMessageParams {
  provider: MessagingProvider;
  providerConfig: Record<string, string>;
  phoneNumberId: string;
  /**
   * Teléfono del destinatario. Opcional desde el rollout de usernames: hay
   * contactos que solo se pueden direccionar por `recipient`. Meta le da
   * precedencia sobre `recipient` cuando llegan los dos.
   */
  to?: string;
  /** BSUID del destinatario. */
  recipient?: string;
  type: string;
  body?: string;
  /**
   * URL pública para que Meta descargue el archivo. Solo para URLs externas
   * que ya tiene el tenant — nuestro propio media siempre viaja por `mediaId`.
   */
  mediaUrl?: string;
  /** Id de media del proveedor. Tiene prioridad sobre `mediaUrl`. */
  mediaId?: string;
  /** Solo documentos: nombre con el que el cliente ve/descarga el archivo */
  filename?: string;
  template?: TemplateSendPayload;
  interactive?: InteractiveSendPayload;
  /** type 'location' */
  location?: { latitude: number; longitude: number; name?: string; address?: string };
  /** type 'contacts' */
  contacts?: OutboundContactCard[];
  /**
   * type 'reaction'. Un `emoji` vacío **quita** la reacción, que es como lo
   * modela Meta. No lleva `contextWaMessageId`: apunta por su propio campo.
   */
  reaction?: { waMessageId: string; emoji: string };
  /**
   * Responder citando: wamid del mensaje al que se responde. Aplica a
   * cualquier tipo menos `reaction`.
   */
  contextWaMessageId?: string;
  /**
   * Manda la plantilla por **Marketing Messages Lite** en vez del endpoint de
   * mensajes. Es el canal que Meta optimiza para marketing; sólo aplica a
   * plantillas de esa categoría y aparece aparte en analytics
   * (`product_type=MARKETING_LITE`).
   */
  marketingLite?: boolean;
  /**
   * Con qué se contabiliza este saliente. **Obligatorio a propósito**: desde
   * octubre de 2026 Meta cobra todo mensaje entregado, así que el compilador
   * tiene que romper el día que aparezca un punto de envío nuevo sin
   * contabilidad.
   *
   * Antes esto dependía de acordarse de escribir el `Message` después del
   * envío, y ahí es donde se abren los agujeros que nadie ve hasta que el total
   * no cierra contra la factura.
   */
  billing: OutboundBillingContext;
}

export interface SendMessageResult {
  waMessageId: string;
}

/**
 * Acuse de lectura (tilde azul) y, opcionalmente, el "escribiendo…".
 *
 * En Meta el indicador de tipeo **no es un mensaje con destinatario**: viaja
 * pegado al mark-as-read y se direcciona por el `message_id` del entrante, no
 * por teléfono ni por BSUID. Por eso acá no hay `to`/`recipient`.
 */
export interface ReadReceiptParams {
  provider: MessagingProvider;
  providerConfig: Record<string, string>;
  phoneNumberId: string;
  /** wamid del mensaje entrante que se marca como leído. */
  waMessageId: string;
  /** Además del tilde azul, mostrarle "escribiendo…" (lo baja Meta a los ~25 s). */
  typing?: boolean;
}

export interface MessagingApiPort {
  sendMessage(params: SendMessageParams): Promise<SendMessageResult>;
  markAsRead(params: ReadReceiptParams): Promise<void>;
}
