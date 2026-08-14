import { Injectable, Logger } from '@nestjs/common';
import type { EmbeddingsPort } from '../../application/ports/embeddings.port.js';

const DEFAULT_EMBEDDINGS_MODEL = 'text-embedding-3-small';
const EMBEDDINGS_URL = 'https://api.openai.com/v1/embeddings';
const REQUEST_TIMEOUT_MS = 60_000;
const MAX_TEXTS_PER_REQUEST = 96;

@Injectable()
export class OpenAiEmbeddingsService implements EmbeddingsPort {
  private readonly logger = new Logger(OpenAiEmbeddingsService.name);

  get model(): string {
    return process.env.AI_EMBEDDINGS_MODEL || DEFAULT_EMBEDDINGS_MODEL;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const apiKey = process.env.AI_EMBEDDINGS_API_KEY || process.env.AI_API_KEY || '';
    if (!apiKey) throw new Error('No hay clave de API para generar embeddings (AI_EMBEDDINGS_API_KEY o AI_API_KEY)');

    const vectors: number[][] = [];
    for (let start = 0; start < texts.length; start += MAX_TEXTS_PER_REQUEST) {
      const batch = texts.slice(start, start + MAX_TEXTS_PER_REQUEST);
      vectors.push(...(await this.embedBatch(batch, apiKey)));
    }
    return vectors;
  }

  private async embedBatch(texts: string[], apiKey: string): Promise<number[][]> {
    let response: Response;
    try {
      response = await fetch(EMBEDDINGS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: this.model, input: texts }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error: any) {
      this.logger.error(`Embeddings fetch failed: ${error.message}`);
      throw new Error(`Embeddings fetch failed: ${error.message}`, { cause: error });
    }

    if (!response.ok) {
      const detail = await response.text();
      this.logger.error(`Embeddings API error: ${response.status} ${detail}`);
      throw new Error(`Embeddings API error: ${response.status}`);
    }

    const data = (await response.json()) as { data: Array<{ index: number; embedding: number[] }> };
    return data.data.sort((a, b) => a.index - b.index).map((item) => item.embedding);
  }
}
