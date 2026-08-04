"use client"

import { create } from "zustand"

export type ToastVariant = "success" | "error" | "info"

export interface ToastItem {
  id: number
  message: string
  description?: string
  variant: ToastVariant
  duration: number
}

export interface ToastOptions {
  description?: string
  /** Milisegundos en pantalla. 0 lo deja fijo hasta que se lo cierre. */
  duration?: number
}

/** Más de tres avisos apilados tapan la pantalla en mobile. */
const MAX_VISIBLE = 3
const DEFAULT_DURATION = 5000

interface ToastState {
  toasts: ToastItem[]
  push: (toast: Omit<ToastItem, "id">) => void
  dismiss: (id: number) => void
}

let nextId = 0

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (toast) =>
    set((state) => ({ toasts: [...state.toasts, { ...toast, id: nextId++ }].slice(-MAX_VISIBLE) })),
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}))

function show(variant: ToastVariant, message: string, options?: ToastOptions): void {
  useToastStore.getState().push({
    message,
    description: options?.description,
    variant,
    duration: options?.duration ?? DEFAULT_DURATION,
  })
}

/**
 * Avisos efímeros: `toast.success("Campaña creada")`.
 *
 * Reemplaza los `window.alert` que quedaban de la primera versión. Se puede
 * llamar desde cualquier lado (no es un hook); el `<Toaster />` del layout es
 * el que dibuja.
 */
export const toast = Object.assign(
  (message: string, options?: ToastOptions) => show("info", message, options),
  {
    success: (message: string, options?: ToastOptions) => show("success", message, options),
    error: (message: string, options?: ToastOptions) => show("error", message, options),
    info: (message: string, options?: ToastOptions) => show("info", message, options),
  }
)
