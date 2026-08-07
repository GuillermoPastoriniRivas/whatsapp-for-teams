/**
 * Consumo de IA de una cuenta en un día.
 *
 * Antes se llevaba por bot (`aiAgentId`). Desde que el bot dejó de ser una
 * entidad y pasó a ser un nodo de una automatización, el tope que importa es el
 * de la cuenta: repartirlo por nodo hacía que el límite real fuera la suma de
 * todos los nodos, o sea ninguno.
 */
export class AiUsage {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly date: string,
    public readonly messageCount: number,
    public readonly tokenCount: number,
  ) {}
}
