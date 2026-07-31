/** Contadores diarios por nodo de una versión publicada ($inc atómico). */
export class FlowNodeStat {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly flowId: string,
    public readonly flowVersionId: string,
    public readonly nodeId: string,
    /** 'YYYY-MM-DD' */
    public readonly date: string,
    public readonly entered: number,
    public readonly errors: number,
    /** Salidas tomadas por handle ("btn:0" → 68) */
    public readonly outcomes: Record<string, number>,
  ) {}
}
