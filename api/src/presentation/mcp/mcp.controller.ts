import { Controller, Delete, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Public } from '../decorators/public.decorator.js';
import { ApiKeyGuard } from '../guards/api-key.guard.js';
import { ApiPrincipal } from '../decorators/api-principal.decorator.js';
import type { ApiKeyPrincipal } from '../decorators/api-principal.decorator.js';
import { AsisMcpServerFactory } from './asis-mcp-server.factory.js';

const METHOD_NOT_ALLOWED = 405;
const JSON_RPC_METHOD_NOT_FOUND = -32601;

const SESSIONLESS_TRANSPORT_REJECTION = {
  jsonrpc: '2.0' as const,
  error: {
    code: JSON_RPC_METHOD_NOT_FOUND,
    message: 'This MCP server is stateless: every request is a self-contained POST. Server-initiated streams and session termination are not supported.',
  },
  id: null,
};

@ApiExcludeController()
@Public()
@UseGuards(ApiKeyGuard)
@Controller('mcp')
export class McpController {
  constructor(private readonly serverFactory: AsisMcpServerFactory) {}

  @Post()
  async handle(
    @ApiPrincipal() principal: ApiKeyPrincipal,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const server = this.serverFactory.create(principal);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

    response.on('close', () => {
      void transport.close();
      void server.close();
    });

    await server.connect(transport);
    await transport.handleRequest(request, response, request.body);
  }

  @Get()
  rejectStream(@Res() response: Response): void {
    response.status(METHOD_NOT_ALLOWED).json(SESSIONLESS_TRANSPORT_REJECTION);
  }

  @Delete()
  rejectSessionTermination(@Res() response: Response): void {
    response.status(METHOD_NOT_ALLOWED).json(SESSIONLESS_TRANSPORT_REJECTION);
  }
}
