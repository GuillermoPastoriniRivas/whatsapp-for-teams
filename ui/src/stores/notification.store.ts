"use client";

import { create } from "zustand";
import { api } from "@/lib/api";

/**
 * Estados de una notificación. Réplica de `notification-status.enum.ts` del
 * dominio: el backend los manda en el mismo texto.
 */
export type NotificationStatus =
  | "scheduled"
  | "queued"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "canceled";

export const NOTIFICATION_STATUSES: NotificationStatus[] = [
  "scheduled",
  "queued",
  "sent",
  "delivered",
  "read",
  "failed",
  "canceled",
];

/** Fila del listado: el detalle sin `timeline`. */
export interface NotificationListItem {
  id: string;
  status: NotificationStatus;
  to: string | null;
  templateId: string | null;
  templateName: string | null;
  sandbox: boolean;
  metadata: Record<string, unknown>;
  createdAt: string | null;
  sendAt: string | null;
  queuedAt: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  failedAt: string | null;
  failureCode: string | null;
  failureReason: string | null;
  timeline?: NotificationTimelineEntry[] | null;
}

/** Un paso del recorrido, tal como lo devuelve el backend. */
export interface NotificationTimelineEntry {
  status: string;
  at: string | null;
  detail?: string | null;
}

/** Detalle de una notificación: la fila más el recorrido. */
export type NotificationDetail = NotificationListItem;

/** Etapas del recorrido, en el orden en que ocurren. */
export type NotificationTimelineStep = NotificationStatus | "created";

export interface NotificationTimelinePoint {
  step: NotificationTimelineStep;
  at: string | null;
  detail?: string | null;
}

const TIMELINE_STEPS: NotificationTimelineStep[] = [
  "created",
  "scheduled",
  "queued",
  "sent",
  "delivered",
  "read",
  "failed",
  "canceled",
];

/** Orden de las etapas conocidas; las desconocidas quedan al final. */
function timelineOrder(step: NotificationTimelineStep | string): number {
  const index = TIMELINE_STEPS.indexOf(step as NotificationTimelineStep);
  return index === -1 ? TIMELINE_STEPS.length : index;
}

/**
 * Recorrido de la notificación.
 *
 * El backend manda el recorrido ya armado (`timeline`), con el detalle del
 * paso (`detail`) cuando lo hay —el motivo del fallo, por ejemplo—. Cuando no
 * viene, se arma acá con las marcas de tiempo del detalle replicando el mismo
 * criterio que usa el backend como reserva: `createdAt` es el `scheduled` y
 * `queuedAt` es el `queued`. `sendAt` es la hora programada, no un paso del
 * recorrido.
 *
 * El primer paso se rotula como creación: el backend usa `scheduled` para el
 * momento en que se guardó la notificación, así que esa entrada se renombra
 * en vez de duplicarla con otra.
 */
export function buildNotificationTimeline(detail: NotificationDetail): NotificationTimelinePoint[] {
  const fromTimeline: NotificationTimelinePoint[] = (detail.timeline ?? [])
    .filter((entry) => !!entry?.status)
    .map((entry) => ({
      step: entry.status.toLowerCase() as NotificationTimelineStep,
      at: entry.at ?? null,
      detail: entry.detail ?? null,
    }))
    .sort((a, b) => timelineOrder(a.step) - timelineOrder(b.step));

  if (fromTimeline.length === 0) {
    const fromFields: Array<[NotificationTimelineStep, string | null]> = [
      ["scheduled", detail.createdAt],
      ["queued", detail.queuedAt],
      ["sent", detail.sentAt],
      ["delivered", detail.deliveredAt],
      ["read", detail.readAt],
      ["failed", detail.failedAt],
    ];
    fromTimeline.push(
      ...fromFields.filter(([, at]) => !!at).map(([step, at]) => ({ step, at, detail: null }))
    );
    if (detail.status === "canceled" && !fromTimeline.some((p) => p.step === "canceled")) {
      fromTimeline.push({ step: "canceled", at: detail.createdAt, detail: null });
    }
  }

  const first = fromTimeline[0];
  if (first?.step === "scheduled" && detail.createdAt && first.at === detail.createdAt) {
    first.step = "created";
  } else if (!fromTimeline.some((point) => point.step === "created") && detail.createdAt) {
    fromTimeline.unshift({ step: "created", at: detail.createdAt });
  }

  return fromTimeline;
}

const PAGE_SIZE = 25;

/**
 * El backend valida `from` y `to` como ISO 8601 con offset (`z.string()
 * .datetime({ offset: true })`), así que el `yyyy-mm-dd` del `<input type=
 * "date">` hay que convertirlo. Se interpreta en la zona local (sin `Z`): si
 * se usara UTC, en Argentina el día arrancaría a las 21:00 del día anterior.
 * `from` arranca a las 00:00 y `to` termina a las 23:59:59 para que el rango
 * sea inclusivo como promete la API.
 */
function toIsoStart(date: string): string | null {
  const parsed = new Date(`${date}T00:00:00.000`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function toIsoEnd(date: string): string | null {
  const parsed = new Date(`${date}T23:59:59.999`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

interface NotificationState {
  notifications: NotificationListItem[];
  meta: { page: number; limit: number; total: number; pages: number };
  statusFilter: NotificationStatus | "";
  templateIdFilter: string;
  /** Rango de fechas en formato yyyy-mm-dd. */
  from: string;
  to: string;
  isLoading: boolean;
  error: string | null;
  selectedId: string | null;
  detail: NotificationDetail | null;
  isDetailLoading: boolean;
  detailError: string | null;
  isCancelling: boolean;
  fetch: (page?: number) => Promise<void>;
  setStatusFilter: (status: NotificationStatus | "") => void;
  setTemplateIdFilter: (templateId: string) => void;
  setFrom: (from: string) => void;
  setTo: (to: string) => void;
  select: (id: string | null) => Promise<void>;
  cancel: (id: string) => Promise<void>;
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

/**
 * Secuencia de pedidos. Si el usuario cambia de filtro o de fila mientras una
 * petición está en vuelo, la respuesta vieja se descarta: si no, el listado
 * queda mostrando los datos de un filtro que ya no está aplicado.
 */
let requestSeq = 0;
let detailSeq = 0;

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  meta: { page: 1, limit: PAGE_SIZE, total: 0, pages: 1 },
  statusFilter: "",
  templateIdFilter: "",
  from: "",
  to: "",
  isLoading: false,
  error: null,
  selectedId: null,
  detail: null,
  isDetailLoading: false,
  detailError: null,
  isCancelling: false,

  fetch: async (page = 1) => {
    const seq = ++requestSeq;
    set({ isLoading: true, error: null });
    try {
      const { statusFilter, templateIdFilter, from, to } = get();
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (statusFilter) params.set("status", statusFilter);
      if (templateIdFilter) params.set("templateId", templateIdFilter);
      const fromIso = from ? toIsoStart(from) : null;
      if (fromIso) params.set("from", fromIso);
      const toIso = to ? toIsoEnd(to) : null;
      if (toIso) params.set("to", toIso);

      const res = await api.get<{
        data: NotificationListItem[];
        meta: { page: number; limit: number; total: number; pages: number };
      }>(`/notifications?${params.toString()}`);

      if (seq !== requestSeq) return;
      set({
        notifications: res.data ?? [],
        meta: res.meta ?? { page, limit: PAGE_SIZE, total: 0, pages: 1 },
        isLoading: false,
      });
    } catch (err) {
      if (seq !== requestSeq) return;
      set({
        notifications: [],
        meta: { page: 1, limit: PAGE_SIZE, total: 0, pages: 1 },
        isLoading: false,
        error: errorMessage(err, "No se pudieron cargar las notificaciones."),
      });
    }
  },

  setStatusFilter: (statusFilter) => {
    set({ statusFilter });
    get().fetch(1);
  },

  setTemplateIdFilter: (templateIdFilter) => {
    set({ templateIdFilter });
    get().fetch(1);
  },

  setFrom: (from) => {
    set({ from });
    get().fetch(1);
  },

  setTo: (to) => {
    set({ to });
    get().fetch(1);
  },

  select: async (id) => {
    if (!id) {
      detailSeq++;
      set({ selectedId: null, detail: null, detailError: null, isDetailLoading: false });
      return;
    }
    const seq = ++detailSeq;
    set({ selectedId: id, isDetailLoading: true, detailError: null });
    try {
      const detail = await api.get<NotificationDetail>(`/notifications/${id}`);
      if (seq !== detailSeq) return;
      set({ detail, isDetailLoading: false });
    } catch (err) {
      if (seq !== detailSeq) return;
      set({
        detail: null,
        isDetailLoading: false,
        detailError: errorMessage(err, "No se pudo cargar el detalle de la notificación."),
      });
    }
  },

  cancel: async (id) => {
    set({ isCancelling: true });
    try {
      await api.post(`/notifications/${id}/cancel`);
      // El backend decide el estado final: se vuelve a pedir la lista y el
      // detalle en vez de suponer que quedó cancelada. El detalle solo se
      // recarga si esa notificación estaba abierta: si se cancela desde la
      // tabla, no se abre el panel solo.
      await get().fetch(get().meta.page);
      if (get().selectedId === id) await get().select(id);
    } finally {
      set({ isCancelling: false });
    }
  },
}));