import { chunkText, CHUNK_TARGET_CHARS, CHUNK_MIN_CHARS } from './chunk-text.js';
import { cosineSimilarity } from '../../ports/embeddings.port.js';
import { IngestKnowledgeUseCase, SearchKnowledgeUseCase, MIN_RELEVANCE_SCORE } from './knowledge.use-cases.js';

describe('chunkText', () => {
  it('deja un texto corto en un solo fragmento', () => {
    expect(chunkText('La depilación definitiva son 6 sesiones.')).toHaveLength(1);
  });

  it('no devuelve nada para un texto vacío', () => {
    expect(chunkText('   \n\n  ')).toEqual([]);
  });

  it('respeta el tamaño objetivo aun con un párrafo gigante sin puntos', () => {
    const enorme = 'a'.repeat(CHUNK_TARGET_CHARS * 3);
    for (const chunk of chunkText(enorme)) {
      expect(chunk.length).toBeLessThanOrEqual(CHUNK_TARGET_CHARS);
    }
  });

  it('solapa los fragmentos vecinos para no partir la frase que contesta', () => {
    const parrafos = Array.from({ length: 8 }, (_, i) => `Parrafo numero ${i}. ${'texto '.repeat(30)}`).join('\n\n');
    const chunks = chunkText(parrafos);

    expect(chunks.length).toBeGreaterThan(1);
    const colaDelPrimero = chunks[0].slice(-40).trim().split(/\s+/)[0];
    expect(chunks[1]).toContain(colaDelPrimero);
  });

  it('no deja fragmentos por debajo del mínimo cuando hay varios', () => {
    const chunks = chunkText(`${'contenido '.repeat(200)}\n\nok`);
    for (const chunk of chunks) expect(chunk.length).toBeGreaterThanOrEqual(CHUNK_MIN_CHARS);
  });
});

describe('cosineSimilarity', () => {
  it('da 1 para vectores idénticos y 0 para ortogonales', () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it('no explota con largos distintos ni con el vector cero', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2])).toBe(0);
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
  });
});

function buildRepo(overrides: Record<string, any> = {}) {
  return {
    createDocument: jest.fn(async (doc: any) => ({ ...doc, id: 'doc_1', createdAt: new Date(), updatedAt: new Date() })),
    findDocumentById: jest.fn(),
    findDocumentsByTenantId: jest.fn(),
    deleteDocument: jest.fn(),
    replaceChunks: jest.fn(),
    findChunksByTenantId: jest.fn(async () => []),
    countChunksByTenantId: jest.fn(async () => 0),
    ...overrides,
  };
}

describe('IngestKnowledgeUseCase', () => {
  it('trocea, embebe y guarda un fragmento por vector', async () => {
    const repo = buildRepo();
    const embeddings = { model: 'test', embed: jest.fn(async (texts: string[]) => texts.map(() => [1, 0])) };
    const useCase = new IngestKnowledgeUseCase(repo as any, embeddings as any);

    const result = await useCase.execute({ tenantId: 't1', title: 'Precios', text: 'Depilación: 1200 pesos.' });

    expect(result.ok).toBe(true);
    expect(embeddings.embed).toHaveBeenCalled();
    const [, chunks] = repo.replaceChunks.mock.calls[0];
    expect(chunks[0]).toMatchObject({ tenantId: 't1', documentTitle: 'Precios', ordinal: 0 });
    expect(chunks[0].embedding).toEqual([1, 0]);
  });

  it('borra el documento si no se pudo indexar, para no dejar basura a medias', async () => {
    const repo = buildRepo();
    const embeddings = { model: 'test', embed: jest.fn(async () => { throw new Error('sin cupo'); }) };
    const useCase = new IngestKnowledgeUseCase(repo as any, embeddings as any);

    const result = await useCase.execute({ tenantId: 't1', title: 'Precios', text: 'algo que indexar' });

    expect(result.ok).toBe(false);
    expect(repo.deleteDocument).toHaveBeenCalledWith('doc_1');
  });

  it('corta cuando la cuenta llegó al tope de fragmentos', async () => {
    const repo = buildRepo({ countChunksByTenantId: jest.fn(async () => 2000) });
    const embeddings = { model: 'test', embed: jest.fn() };
    const useCase = new IngestKnowledgeUseCase(repo as any, embeddings as any);

    const result = await useCase.execute({ tenantId: 't1', title: 'Otro', text: 'texto nuevo para indexar' });

    expect(result.ok).toBe(false);
    expect(embeddings.embed).not.toHaveBeenCalled();
  });
});

describe('SearchKnowledgeUseCase', () => {
  const chunk = (id: string, embedding: number[], text: string) => ({
    id, tenantId: 't1', documentId: `d_${id}`, documentTitle: `Doc ${id}`, ordinal: 0, text, embedding,
  });

  it('devuelve lo relevante primero y descarta lo que no llega al umbral', async () => {
    const repo = buildRepo({
      findChunksByTenantId: jest.fn(async () => [
        chunk('lejos', [0, 1], 'nada que ver'),
        chunk('cerca', [1, 0], 'la respuesta'),
      ]),
    });
    const embeddings = { model: 'test', embed: jest.fn(async () => [[1, 0]]) };

    const excerpts = await new SearchKnowledgeUseCase(repo as any, embeddings as any).execute('t1', '¿cuánto sale?');

    expect(excerpts).toHaveLength(1);
    expect(excerpts[0].text).toBe('la respuesta');
    expect(excerpts[0].score).toBeGreaterThan(MIN_RELEVANCE_SCORE);
  });

  it('no devuelve nada cuando ni el mejor fragmento llega al piso de relevancia', async () => {
    const repo = buildRepo({
      findChunksByTenantId: jest.fn(async () => [chunk('tibio', [0.34, 0.94], 'algo apenas parecido')]),
    });
    const embeddings = { model: 'test', embed: jest.fn(async () => [[1, 0]]) };

    const excerpts = await new SearchKnowledgeUseCase(repo as any, embeddings as any).execute('t1', 'otra cosa');

    expect(excerpts).toEqual([]);
  });

  it('descarta lo que queda muy por debajo del mejor, aunque pase el piso', async () => {
    const repo = buildRepo({
      findChunksByTenantId: jest.fn(async () => [
        chunk('mejor', [1, 0], 'la respuesta'),
        chunk('flojo', [0.42, 0.91], 'de refilón'),
      ]),
    });
    const embeddings = { model: 'test', embed: jest.fn(async () => [[1, 0]]) };

    const excerpts = await new SearchKnowledgeUseCase(repo as any, embeddings as any).execute('t1', '¿cuánto sale?');

    expect(excerpts).toHaveLength(1);
    expect(excerpts[0].text).toBe('la respuesta');
  });

  it('no llama al proveedor de embeddings si la cuenta no tiene conocimiento cargado', async () => {
    const embeddings = { model: 'test', embed: jest.fn() };
    const excerpts = await new SearchKnowledgeUseCase(buildRepo() as any, embeddings as any).execute('t1', 'hola');

    expect(excerpts).toEqual([]);
    expect(embeddings.embed).not.toHaveBeenCalled();
  });
});
