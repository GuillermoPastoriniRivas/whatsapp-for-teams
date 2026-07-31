/**
 * Credencial de integración por tenant para el nodo HTTP. El secreto se guarda
 * cifrado (AES-256-GCM) y NUNCA sale por la API: se inyecta como header en
 * runtime referenciando la conexión por id desde el grafo.
 */
export class FlowConnection {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly name: string,
    /** Header donde se inyecta el secreto (p. ej. "Authorization") */
    public readonly headerName: string,
    public readonly secretEncrypted: string,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}
}
