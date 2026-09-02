/**
 * fluws-guard — cierre obligatorio validado mecánicamente (Fase 2 del plan vida-más-allá-contexto)
 *
 * Marca dirty cuando hay edit/write/bash con diff, y bloquea la respuesta final
 * si no hubo fluws:write|work_close|handoff|contribute|confirm|revalidate|work_start|work_checkpoint|work_finish
 *
 * Usa los hooks de opencode: `tool.execute.after` y `chat.params`.
 * No rompe la sesión: solo impide el "listo" sin devolución.
 */
export const FluwsGuard = async ({ client, directory }: { client: any; directory: string }) => {
  const dirtyBySession = new Map<string, boolean>()
  const persistedBySession = new Map<string, boolean>()

  const markDirty = (sessionID: string) => dirtyBySession.set(sessionID, true)
  const markPersisted = (sessionID: string) => persistedBySession.set(sessionID, true)

  const isFluwsPersist = (tool: string, output: any) => {
    if (tool !== 'bash') return false
    const command = output?.args?.command ?? output?.args?.cmd ?? ''
    if (typeof command !== 'string') return false
    return /fluws(\.js)?\s+(write|work_close|handoff|contribute|confirm|revalidate|work_start|work_checkpoint|work_finish|draft)/.test(command)
  }

  return {
    'tool.execute.after': async (input: { tool: string; sessionID: string }, output: { args: any }) => {
      if (input.tool === 'edit' || input.tool === 'write') {
        markDirty(input.sessionID)
        return
      }
      if (isFluwsPersist(input.tool, output)) {
        markPersisted(input.sessionID)
        // draft no persiste, solo propone — no limpia dirty
        if (/fluws.*\s+(write|work_close|handoff|contribute|confirm|revalidate|work_start|work_checkpoint|work_finish)/.test(output.args?.command ?? '')) {
          // si hubo persistencia real, mantenemos dirty pero marcado como atendido
        }
        return
      }
      // bash que toca git diff también es dirty implícito
      if (input.tool === 'bash' && typeof output.args?.command === 'string' && /git\s+(commit|add)/.test(output.args.command)) {
        markDirty(input.sessionID)
      }
    },
    'chat.params': async (input: { sessionID: string }, output: { prompt: string }) => {
      const dirty = dirtyBySession.get(input.sessionID)
      const persisted = persistedBySession.get(input.sessionID)
      if (dirty && !persisted) {
        // Bloquear cierre tipo "listo/terminado" si hay diff sin devolución
        // Solo si el prompt parece cierre; no en preguntas intermedias
        const isClosing = /listo|terminado|ya\s+est[aá]|done/i.test(output.prompt ?? '')
        if (isClosing) {
          throw new Error(
            '[fluws-guard] Hay cambios durables sin devolución a fluws. Antes de cerrar corré: node mdvault/packages/cli/dist/fluws.js draft y luego write/work_close/handoff/confirm. (Este guard es Fase 2 — desactívalo borrando .opencode/plugins/fluws-guard.ts si bloquea)',
          )
        }
      }
    },
  }
}
