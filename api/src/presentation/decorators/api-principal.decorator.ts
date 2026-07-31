import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import type { ApiKeyPrincipal } from '../../application/use-cases/developer/authenticate-api-key.use-case.js';

export type { ApiKeyPrincipal };

/** Principal autenticado por API key (lo setea ApiKeyGuard). */
export const ApiPrincipal = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ApiKeyPrincipal => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return (request as any).apiPrincipal;
  },
);
