import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export interface RequestAgent {
  _id: string;
  tenantId: string;
  role: string;
}

export const CurrentAgent = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestAgent => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return (request as any).agent;
  },
);
