import { CreateApiKeyRequestSchema } from './developer-requests.dto.js';

describe('Pedido de creación de clave de API', () => {
  it('acepta el modo test', () => {
    const parsed = CreateApiKeyRequestSchema.safeParse({ name: 'sandbox', mode: 'test' });

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.mode).toBe('test');
  });

  it('acepta el modo live', () => {
    const parsed = CreateApiKeyRequestSchema.safeParse({ name: 'real', mode: 'live' });

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.mode).toBe('live');
  });

  it('sin modo la clave es live', () => {
    const parsed = CreateApiKeyRequestSchema.safeParse({ name: 'real' });

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.mode).toBe('live');
  });

  it('rechaza un modo que no sea live ni test', () => {
    expect(CreateApiKeyRequestSchema.safeParse({ name: 'raro', mode: 'sandbox' }).success).toBe(false);
    expect(CreateApiKeyRequestSchema.safeParse({ name: 'raro', mode: 'TEST' }).success).toBe(false);
  });
});
