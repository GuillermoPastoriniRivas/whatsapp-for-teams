import type { ApiKeyMode } from "./types";

/**
 * Copy de las claves de API con modo (live / test).
 *
 * `lib/i18n/translations.ts` lo escribe otra tarea, así que acá viven los
 * textos nuevos de esta pantalla. Cuando se Sumen a las traducciones
 * centrales, esta caja se puede borrar y los textos pasan a `t.developers.*`.
 */

/** Rótulos técnicos: se muestran igual en todos los idiomas. */
export const API_KEY_MODE_LABEL: Record<ApiKeyMode, string> = {
  live: "LIVE",
  test: "TEST",
};

export interface ApiKeyModeCopy {
  /** Título del selector de modo del formulario de alta. */
  modeTitle: string;
  modeTestOption: string;
  modeLiveOption: string;
  /** Ayuda del selector, según el modo elegido. */
  modeTestHint: string;
  modeLiveHint: string;
  /** Franja arriba de la lista de claves. */
  listNotice: string;
  /** Texto corto que acompaña al badge TEST en la lista. */
  testBadgeNote: string;
  /** Aviso de la pantalla de Desarrolladores. */
  pageNotice: string;
  /** Texto del badge de la clave recién creada. */
  createdKeyMode: string;
  /** Descripción de los permisos de notificaciones (aún no están en las traducciones). */
  scopeNotificationsRead: string;
  scopeNotificationsWrite: string;
}

const COPY: Record<"es" | "en", ApiKeyModeCopy> = {
  es: {
    modeTitle: "Modo de la clave",
    modeTestOption: "Test — sandbox, sin costo",
    modeLiveOption: "Live — envíos reales",
    modeTestHint:
      "Una clave de test nunca llega a Meta ni genera costo: las notificaciones se resuelven en sandbox. Usala para probar el flujo completo.",
    modeLiveHint:
      "Una clave live llega a Meta y se cobra según tu plan. Usala solo cuando la integración ya esté lista.",
    listNotice:
      "Las claves tienen un modo. Las claves de test no llegan a Meta ni se cobran: el flujo se resuelve en sandbox. Las claves live envían de verdad y se cobran según tu plan.",
    testBadgeNote: "sandbox · no llega a Meta ni se cobra",
    pageNotice:
      "Cada clave de API tiene un modo: Test (sandbox, no llega a Meta ni se cobra) o Live (envíos reales, se cobra según tu plan).",
    createdKeyMode: "Modo de la clave",
    scopeNotificationsRead:
      "Ver las notificaciones enviadas por la API, su estado y su historial",
    scopeNotificationsWrite: "Enviar, programar y cancelar notificaciones",
  },
  en: {
    modeTitle: "Key mode",
    modeTestOption: "Test — sandbox, no cost",
    modeLiveOption: "Live — real sends",
    modeTestHint:
      "A test key never reaches Meta and never costs anything: notifications are resolved in the sandbox. Use it to test the whole flow.",
    modeLiveHint:
      "A live key reaches Meta and is billed according to your plan. Use it only once the integration is ready.",
    listNotice:
      "Every key has a mode. Test keys don't reach Meta and are never charged: the flow is resolved in the sandbox. Live keys actually send and are billed according to your plan.",
    testBadgeNote: "sandbox · doesn't reach Meta and isn't charged",
    pageNotice:
      "Every API key has a mode: Test (sandbox, doesn't reach Meta and isn't charged) or Live (real sends, billed according to your plan).",
    createdKeyMode: "Key mode",
    scopeNotificationsRead:
      "View the notifications sent through the API, their status and their history",
    scopeNotificationsWrite: "Send, schedule and cancel notifications",
  },
};

export function apiKeyModeCopy(locale: "es" | "en"): ApiKeyModeCopy {
  return COPY[locale] ?? COPY.es;
}
