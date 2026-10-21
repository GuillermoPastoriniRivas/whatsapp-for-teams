import { createHash } from 'node:crypto';
import { ApiKey } from '../../../domain/entities/api-key.entity.js';
import { ApiKeyRepository } from '../../../domain/repositories/api-key.repository.js';
import { SubscriptionRepository } from '../../../domain/repositories/subscription.repository.js';
import { generateApiKey, hashApiKey, apiKeyPrefix, toApiKeyView } from './developer-credentials.util.js';
import { AuthenticateApiKeyUseCase } from './authenticate-api-key.use-case.js';
import { CreateApiKeyUseCase } from './create-api-key.use-case.js';

const PAYLOAD_HEX = /^[0-9a-f]{40}$/;

type CreateInput = Parameters<ApiKeyRepository['create']>[0];

/** Repositorio de claves que devuelve siempre la misma clave. */
function repoConClave(key: ApiKey | null) {
  return {
    findActiveByKeyHash: jest.fn().mockResolvedValue(key),
    updateLastUsed: jest.fn().mockResolvedValue(undefined),
    countActiveByTenantId: jest.fn().mockResolvedValue(0),
  } as unknown as ApiKeyRepository;
}

/** Sin suscripción: plan FREE, que sí tiene acceso a la API. */
const subscriptionRepo = {
  findByTenantId: jest.fn().mockResolvedValue(null),
} as unknown as SubscriptionRepository;

describe('Modo de las claves de API', () => {
  it('una clave de sandbox empieza con ak_test_', () => {
    const key = generateApiKey('test');

    expect(key.startsWith('ak_test_')).toBe(true);
    expect(key.slice('ak_test_'.length)).toMatch(PAYLOAD_HEX);
  });

  it('una clave real empieza con ak_live_', () => {
    const key = generateApiKey('live');

    expect(key.startsWith('ak_live_')).toBe(true);
    expect(key.slice('ak_live_'.length)).toMatch(PAYLOAD_HEX);
  });

  it('las dos claves tienen el mismo largo y payloads distintos', () => {
    const test = generateApiKey('test');
    const live = generateApiKey('live');

    expect(test).toHaveLength('ak_test_'.length + 40);
    expect(live).toHaveLength('ak_live_'.length + 40);
    expect(test).not.toBe(live);
  });

  it('el hash sigue siendo el SHA-256 de la clave completa, con prefijo incluido', () => {
    const key = generateApiKey('test');

    expect(hashApiKey(key)).toBe(createHash('sha256').update(key, 'utf8').digest('hex'));
  });

  it('el prefijo visible ya incluye el modo', () => {
    expect(apiKeyPrefix(generateApiKey('test'))).toMatch(/^ak_test_[0-9a-f]{4}$/);
    expect(apiKeyPrefix(generateApiKey('live'))).toMatch(/^ak_live_[0-9a-f]{4}$/);
  });
});

describe('Autenticar una clave', () => {
  function principalDe(plainKey: string) {
    const key: ApiKey = {
      id: 'k1',
      tenantId: 't1',
      name: 'integración',
      prefix: apiKeyPrefix(plainKey),
      keyHash: hashApiKey(plainKey),
      scopes: ['messages:read'],
      mode: 'test',
      createdBy: null,
      lastUsedAt: null,
      revokedAt: null,
      createdAt: new Date(),
    };
    return new AuthenticateApiKeyUseCase(repoConClave(key), subscriptionRepo).execute(plainKey);
  }

  it('devuelve el modo de la clave autenticada', async () => {
    const result = await principalDe(generateApiKey('test'));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.apiKeyMode).toBe('test');
  });

  it('una clave guardada sin mode autentica como live', async () => {
    const plainKey = generateApiKey('live');
    const legacy = {
      id: 'k1',
      tenantId: 't1',
      name: 'vieja',
      prefix: apiKeyPrefix(plainKey),
      keyHash: hashApiKey(plainKey),
      scopes: ['messages:read'],
      createdBy: null,
      lastUsedAt: null,
      revokedAt: null,
      createdAt: new Date(),
    } as unknown as ApiKey;

    const result = await new AuthenticateApiKeyUseCase(repoConClave(legacy), subscriptionRepo).execute(plainKey);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.apiKeyMode).toBe('live');
  });
});

describe('Crear una clave', () => {
  function repoQueGuarda() {
    const create = jest.fn((data: CreateInput): Promise<ApiKey> =>
      Promise.resolve({ ...data, id: 'k1', lastUsedAt: null, revokedAt: null, createdAt: new Date() }),
    );
    const repo = {
      countActiveByTenantId: jest.fn().mockResolvedValue(0),
      create,
    } as unknown as ApiKeyRepository;
    return { repo, create };
  }

  it('guarda el modo pedido y devuelve una clave con ese prefijo', async () => {
    const { repo, create } = repoQueGuarda();

    const result = await new CreateApiKeyUseCase(repo, subscriptionRepo).execute({
      tenantId: 't1',
      name: 'sandbox',
      scopes: ['messages:read'],
      createdBy: null,
      mode: 'test',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ mode: 'test' }));
    expect(result.value.plainKey.startsWith('ak_test_')).toBe(true);
    expect(result.value.apiKey.mode).toBe('test');
  });

  it('sin modo explícito la clave es live', async () => {
    const { repo, create } = repoQueGuarda();

    const result = await new CreateApiKeyUseCase(repo, subscriptionRepo).execute({
      tenantId: 't1',
      name: 'real',
      scopes: ['messages:read'],
      createdBy: null,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ mode: 'live' }));
    expect(result.value.plainKey.startsWith('ak_live_')).toBe(true);
    expect(result.value.apiKey.mode).toBe('live');
  });

  it('la vista de la clave incluye el modo', () => {
    const key: ApiKey = {
      id: 'k1',
      tenantId: 't1',
      name: 'sandbox',
      prefix: 'ak_test_abcd',
      keyHash: 'hash',
      scopes: ['messages:read'],
      mode: 'test',
      createdBy: null,
      lastUsedAt: null,
      revokedAt: null,
      createdAt: new Date(),
    };

    expect(toApiKeyView(key).mode).toBe('test');
  });
});
