/**
 * En Meta las plantillas pertenecen a la WABA, no a un número: todos los
 * números de esa cuenta pueden enviar las mismas. Nosotros las guardamos con el
 * `phoneNumberId` del número que las sincronizó primero, así que comparar por
 * número dejaría sin poder enviar a los demás números de la misma cuenta.
 *
 * Se acepta la coincidencia por número como respaldo, para las plantillas
 * locales que todavía no tienen WABA asignada.
 */
export function templateBelongsToPhone(
  template: { phoneNumberId: string; wabaId?: string | null },
  phone: { id: string; wabaId?: string | null },
): boolean {
  if (template.phoneNumberId === phone.id) return true;
  return Boolean(template.wabaId) && template.wabaId === phone.wabaId;
}
