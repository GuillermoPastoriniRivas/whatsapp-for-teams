import { CanActivate, ExecutionContext, ForbiddenException, HttpException, HttpStatus, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuthenticateApiKeyUseCase, ApiKeyPrincipal } from '../../application/use-cases/developer/authenticate-api-key.use-case.js';
import { REQUIRED_SCOPES_KEY } from '../decorators/require-scopes.decorator.js';
import type { ApiScope } from '../../domain/value-objects/api-scopes.js';

export interface RequestApiPrincipal extends ApiKeyPrincipal {}

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = Number(process.env.PUBLIC_API_RATE_LIMIT ?? 120);

interface RateWindow {
  windowStart: number;
  count: number;
}

/**
 * Autenticación de la API pública: `X-Api-Key: ak_...` o
 * `Authorization: Bearer ak_...`. Deja el principal en request.apiPrincipal y
 * aplica un rate limit simple por clave (ventana fija por minuto, en memoria).
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly windows = new Map<string, RateWindow>();

  constructor(
    @Inject('AuthenticateApiKeyUseCase') private readonly authenticate: AuthenticateApiKeyUseCase,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    const headerKey = request.headers['x-api-key'];
    const authHeader = request.headers.authorization;
    const plainKey =
      (typeof headerKey === 'string' && headerKey) ||
      (authHeader?.startsWith('Bearer ak_') ? authHeader.slice(7) : '');

    if (!plainKey) {
      throw new UnauthorizedException('Provide your API key via the X-Api-Key header or Authorization: Bearer ak_...');
    }

    const result = await this.authenticate.execute(plainKey);
    if (!result.ok) {
      if (result.error.code === 'FEATURE_NOT_IN_PLAN') {
        throw new HttpException({ message: result.error.message, code: result.error.code }, HttpStatus.FORBIDDEN);
      }
      throw new UnauthorizedException('Invalid or revoked API key.');
    }

    this.enforceRateLimit(result.value.apiKeyId);
    this.enforceScopes(context, result.value);

    (request as any).apiPrincipal = result.value;
    return true;
  }

  private enforceScopes(context: ExecutionContext, principal: ApiKeyPrincipal): void {
    const required = this.reflector.getAllAndOverride<ApiScope[] | undefined>(REQUIRED_SCOPES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return;

    const missing = required.filter((scope) => !principal.scopes.includes(scope));
    if (missing.length === 0) return;

    throw new ForbiddenException({
      code: 'MISSING_SCOPE',
      message: `This API key is missing the ${missing.join(', ')} permission. Create a key with it from Developers.`,
      required,
      granted: principal.scopes,
    });
  }

  private enforceRateLimit(apiKeyId: string): void {
    const now = Date.now();
    const window = this.windows.get(apiKeyId);

    if (!window || now - window.windowStart >= RATE_LIMIT_WINDOW_MS) {
      this.windows.set(apiKeyId, { windowStart: now, count: 1 });
      this.pruneStaleWindows(now);
      return;
    }

    window.count += 1;
    if (window.count > RATE_LIMIT_MAX_REQUESTS) {
      const retryAfterSec = Math.ceil((window.windowStart + RATE_LIMIT_WINDOW_MS - now) / 1000);
      throw new HttpException(
        { message: `Rate limit exceeded (${RATE_LIMIT_MAX_REQUESTS} requests/minute). Retry in ${retryAfterSec}s.`, code: 'RATE_LIMIT_EXCEEDED' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private pruneStaleWindows(now: number): void {
    if (this.windows.size < 5000) return;
    for (const [key, window] of this.windows) {
      if (now - window.windowStart >= RATE_LIMIT_WINDOW_MS) this.windows.delete(key);
    }
  }
}
