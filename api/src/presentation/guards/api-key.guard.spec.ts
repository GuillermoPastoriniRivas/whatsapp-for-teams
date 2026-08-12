import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard.js';
import { normalizeScopes, LEGACY_API_SCOPES, type ApiScope } from '../../domain/value-objects/api-scopes.js';
import { ok, err } from '../../application/common/result.js';
import { InvalidApiKeyError } from '../../domain/errors/domain-errors.js';

function contexto(required: ApiScope[] | undefined) {
  const request: Record<string, unknown> = { headers: { 'x-api-key': 'ak_prueba' } };
  return {
    request,
    context: {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => 'handler',
      getClass: () => 'clase',
    } as never,
    reflector: { getAllAndOverride: () => required } as never,
  };
}

function guardCon(scopes: ApiScope[], required: ApiScope[] | undefined) {
  const piezas = contexto(required);
  const authenticate = {
    async execute() {
      return ok({ tenantId: 't1', apiKeyId: 'k1', keyName: 'prueba', scopes, createdByAgentId: null });
    },
  };
  return { guard: new ApiKeyGuard(authenticate as never, piezas.reflector), ...piezas };
}

describe('Permisos de una API key', () => {
  it('deja pasar cuando la clave tiene el permiso pedido', async () => {
    const { guard, context, request } = guardCon(['flows:read', 'flows:write'], ['flows:write']);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect((request as { apiPrincipal?: { keyName: string } }).apiPrincipal?.keyName).toBe('prueba');
  });

  it('corta con 403 y dice cuál falta', async () => {
    const { guard, context } = guardCon(['flows:read'], ['flows:write']);

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    await guard.canActivate(context).catch((error: ForbiddenException) => {
      expect((error.getResponse() as { code: string; message: string }).code).toBe('MISSING_SCOPE');
      expect((error.getResponse() as { message: string }).message).toContain('flows:write');
    });
  });

  it('una ruta sin permisos declarados no exige ninguno', async () => {
    const { guard, context } = guardCon([], undefined);

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('sin clave en el header ni se consulta la base', async () => {
    const piezas = contexto(['flows:read']);
    piezas.request.headers = {};
    const authenticate = {
      async execute() {
        throw new Error('no se tendría que haber llamado');
      },
    };
    const guard = new ApiKeyGuard(authenticate as never, piezas.reflector);

    await expect(guard.canActivate(piezas.context)).rejects.toThrow(UnauthorizedException);
  });

  it('una clave inválida no llega a la verificación de permisos', async () => {
    const piezas = contexto(['flows:read']);
    const authenticate = { async execute() { return err(new InvalidApiKeyError()); } };
    const guard = new ApiKeyGuard(authenticate as never, piezas.reflector);

    await expect(guard.canActivate(piezas.context)).rejects.toThrow(UnauthorizedException);
  });
});

describe('Permisos de claves viejas', () => {
  it('una clave sin permisos guardados conserva los de mensajería', () => {
    expect(normalizeScopes(undefined)).toEqual(LEGACY_API_SCOPES);
    expect(normalizeScopes([])).toEqual(LEGACY_API_SCOPES);
  });

  it('no hereda los de flujos: nadie gana de golpe poder reescribir automatizaciones', () => {
    expect(normalizeScopes(undefined)).not.toContain('flows:write');
  });

  it('descarta permisos inventados', () => {
    expect(normalizeScopes(['flows:read', 'flows:borrar_todo'])).toEqual(['flows:read']);
  });
});
