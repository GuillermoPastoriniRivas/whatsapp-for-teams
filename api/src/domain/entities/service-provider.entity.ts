/**
 * Un proveedor al que la cuenta le pasa datos de clientes: el carpintero, el
 * plomero, el electricista.
 *
 * No es un agente ni un contacto: es alguien de afuera, con su propio WhatsApp,
 * que **no está conectado a la plataforma**. Una conversación de WhatsApp no se
 * puede transferir a otro número, así que lo que se hace no es derivar el chat
 * sino **pasarle el dato**: se le manda una plantilla con los datos del cliente
 * y un botón `wa.me` para que él arranque la conversación desde su teléfono.
 */
export class ServiceProvider {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly name: string,
    /** Dígitos E.164 sin '+'. Es su WhatsApp personal, no una línea nuestra. */
    public readonly phone: string,
    /**
     * Servicios que cubre, en minúsculas. Matchean contra la opción que eligió
     * el cliente en la lista del flujo (`row:*` → el `key` de la fila).
     */
    public readonly services: string[],
    /**
     * Solo un proveedor activo recibe datos. **No se puede activar sin
     * `optInAt`**: escribirle primero a alguien que no dio permiso es lo que
     * hace que Meta baje la calidad del número, y el número es del cliente.
     */
    public readonly active: boolean,
    /** Cuándo aceptó recibir estos avisos. Null = todavía no se puede activar. */
    public readonly optInAt: Date | null,
    /** Cómo lo aceptó, para poder responder si Meta o el proveedor preguntan. */
    public readonly optInNote: string,
    /** Reparto parejo entre varios proveedores del mismo servicio. */
    public readonly lastAssignedAt: Date | null,
    public readonly assignedCount: number,
    public readonly notes: string,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  /** Un proveedor sin opt-in registrado no puede recibir nada. */
  get canReceive(): boolean {
    return this.active && this.optInAt !== null;
  }
}
