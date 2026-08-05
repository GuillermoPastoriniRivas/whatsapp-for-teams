/**
 * Identidad de un contacto de WhatsApp.
 *
 * Desde el rollout de usernames (jun-2026) el teléfono dejó de ser garantía: un
 * usuario que adopta username solo se identifica por su BSUID. Por eso los dos
 * ejes son opcionales, con la invariante de que al menos uno esté presente.
 *
 * El BSUID está scopeado al portfolio de negocio: la misma persona tiene BSUIDs
 * distintos frente a portfolios distintos, así que nunca se compara suelto.
 */
export class Contact {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly name: string,
    /** Dígitos E.164 sin '+'. Null cuando el usuario solo compartió su username. */
    public readonly phone: string | null,
    public readonly profilePicUrl: string | null,
    public readonly lastSeenAt: Date,
    public readonly createdAt: Date,
    public readonly email: string | null = null,
    public readonly company: string | null = null,
    public readonly notes: string | null = null,
    public readonly customFields: Record<string, string> = {},
    /** Business-Scoped User ID: `CC.alfanumérico`, hasta 128 chars tras el prefijo. */
    public readonly bsuid: string | null = null,
    /** BSUID del portfolio padre (`CC.ENT.…`). No sirve para bloquear usuarios. */
    public readonly parentBsuid: string | null = null,
    /** Username público del usuario, sin '@'. Solo llega si lo activó. */
    public readonly username: string | null = null,
    /** Portfolio bajo el que se emitió `bsuid`. Sin esto el BSUID es ambiguo. */
    public readonly portfolioId: string | null = null,
  ) {}

  /**
   * Etiqueta legible para notificaciones y previews. Nunca cae en el BSUID
   * crudo: no le dice nada a un agente humano.
   */
  get displayName(): string {
    if (this.name?.trim()) return this.name.trim();
    if (this.username) return `@${this.username}`;
    if (this.phone) return `+${this.phone}`;
    return 'Contacto sin identificar';
  }
}
