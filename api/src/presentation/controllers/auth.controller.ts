import { Controller, Post, Get, Body, UsePipes, Inject, HttpCode, UnauthorizedException } from '@nestjs/common';
import { LoginUseCase } from '../../application/use-cases/auth/login.use-case.js';
import { RefreshTokenUseCase } from '../../application/use-cases/auth/refresh-token.use-case.js';
import { GetCurrentAgentUseCase } from '../../application/use-cases/auth/get-current-agent.use-case.js';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe.js';
import { LoginRequestSchema } from '../request-dtos/login-request.dto.js';
import type { LoginRequestDto } from '../request-dtos/login-request.dto.js';
import { RefreshTokenRequestSchema } from '../request-dtos/refresh-token-request.dto.js';
import type { RefreshTokenRequestDto } from '../request-dtos/refresh-token-request.dto.js';
import { CurrentAgent } from '../decorators/current-agent.decorator.js';
import type { RequestAgent } from '../decorators/current-agent.decorator.js';
import { Public } from '../decorators/public.decorator.js';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject('LoginUseCase') private readonly loginUseCase: LoginUseCase,
    @Inject('RefreshTokenUseCase') private readonly refreshTokenUseCase: RefreshTokenUseCase,
    @Inject('GetCurrentAgentUseCase') private readonly getCurrentAgentUseCase: GetCurrentAgentUseCase,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @UsePipes(new ZodValidationPipe(LoginRequestSchema))
  async login(@Body() body: LoginRequestDto) {
    const result = await this.loginUseCase.execute(body);
    if (!result.ok) throw new UnauthorizedException(result.error.message);
    return result.value;
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @UsePipes(new ZodValidationPipe(RefreshTokenRequestSchema))
  async refresh(@Body() body: RefreshTokenRequestDto) {
    const result = await this.refreshTokenUseCase.execute(body);
    if (!result.ok) throw new UnauthorizedException(result.error.message);
    return result.value;
  }

  @Get('me')
  async me(@CurrentAgent() agent: RequestAgent) {
    const result = await this.getCurrentAgentUseCase.execute(agent._id);
    if (!result.ok) throw new UnauthorizedException(result.error.message);
    const a = result.value;
    return { id: a.id, name: a.name, email: a.email, role: a.role, status: a.status, tenantId: a.tenantId };
  }
}
