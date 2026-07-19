/** Normalizes to WhatsApp wa_id format: international number, digits only, no '+'. */
export function normalizePhone(raw: string | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '').replace(/^0+/, '');
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}
