export interface FlowHttpRequest {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  headers: Record<string, string>;
  body?: string;
  timeoutMs: number;
}

export interface FlowHttpResponse {
  status: number;
  /** JSON parseado cuando el content-type es JSON; string en caso contrario */
  body: unknown;
}

/** Cliente HTTP saliente del nodo de flujo. Lanza en error de red/timeout/SSRF. */
export interface FlowHttpPort {
  request(req: FlowHttpRequest): Promise<FlowHttpResponse>;
}
