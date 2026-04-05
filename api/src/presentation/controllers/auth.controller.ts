import { Controller, Post, Get, Body, UsePipes, Inject, HttpCode, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { LoginUseCase } from '../../application/use-cases/auth/login.use-case.js';
import { RefreshTokenUseCase } from '../../application/use-cases/auth/refresh-token.use-case.js';
import { GetCurrentAgentUseCase } from '../../application/use-cases/auth/get-current-agent.use-case.js';
import { DemoLoginUseCase } from '../../application/use-cases/auth/demo-login.use-case.js';
import { GoogleLoginUseCase } from '../../application/use-cases/auth/google-login.use-case.js';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe.js';
import { LoginRequestSchema } from '../request-dtos/login-request.dto.js';
import type { LoginRequestDto } from '../request-dtos/login-request.dto.js';
import { RefreshTokenRequestSchema } from '../request-dtos/refresh-token-request.dto.js';
import type { RefreshTokenRequestDto } from '../request-dtos/refresh-token-request.dto.js';
import { GoogleLoginRequestSchema } from '../request-dtos/google-login-request.dto.js';
import type { GoogleLoginRequestDto } from '../request-dtos/google-login-request.dto.js';
import { CurrentAgent } from '../decorators/current-agent.decorator.js';
import type { RequestAgent } from '../decorators/current-agent.decorator.js';
import { Public } from '../decorators/public.decorator.js';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    @Inject('LoginUseCase') private readonly loginUseCase: LoginUseCase,
    @Inject('RefreshTokenUseCase') private readonly refreshTokenUseCase: RefreshTokenUseCase,
    @Inject('GetCurrentAgentUseCase') private readonly getCurrentAgentUseCase: GetCurrentAgentUseCase,
    @Inject('DemoLoginUseCase') private readonly demoLoginUseCase: DemoLoginUseCase,
    @Inject('GoogleLoginUseCase') private readonly googleLoginUseCase: GoogleLoginUseCase,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @Throttle({ short: { ttl: 60000, limit: 5 } })
  @UsePipes(new ZodValidationPipe(LoginRequestSchema))
  @ApiOperation({ summary: 'Login', description: 'Authenticate with email and password to obtain JWT tokens' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: { type: 'string', format: 'email', example: 'agent@company.com' },
        password: { type: 'string', minLength: 1, example: 'password123' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'JWT access and refresh tokens', schema: {
    type: 'object',
    properties: {
      accessToken: { type: 'string' },
      refreshToken: { type: 'string' },
    },
  }})
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() body: LoginRequestDto) {
    const result = await this.loginUseCase.execute(body);
    if (!result.ok) throw new UnauthorizedException(result.error.message);
    return result.value;
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @Throttle({ short: { ttl: 60000, limit: 10 } })
  @UsePipes(new ZodValidationPipe(RefreshTokenRequestSchema))
  @ApiOperation({ summary: 'Refresh token', description: 'Exchange a refresh token for a new access token' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['refreshToken'],
      properties: {
        refreshToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIs...' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'New JWT tokens', schema: {
    type: 'object',
    properties: {
      accessToken: { type: 'string' },
      refreshToken: { type: 'string' },
    },
  }})
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refresh(@Body() body: RefreshTokenRequestDto) {
    const result = await this.refreshTokenUseCase.execute(body);
    if (!result.ok) throw new UnauthorizedException(result.error.message);
    return result.value;
  }

  @Public()
  @Post('demo-login')
  @HttpCode(200)
  @Throttle({ short: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: 'Demo login', description: 'Login as the demo agent without credentials' })
  @ApiResponse({ status: 200, description: 'JWT access and refresh tokens' })
  @ApiResponse({ status: 503, description: 'Demo not configured' })
  async demoLogin() {
    const result = await this.demoLoginUseCase.execute();
    if (!result.ok) throw new UnauthorizedException(result.error.message);
    return result.value;
  }

  @Public()
  @Post('google')
  @HttpCode(200)
  @Throttle({ short: { ttl: 60000, limit: 5 } })
  @UsePipes(new ZodValidationPipe(GoogleLoginRequestSchema))
  @ApiOperation({ summary: 'Google login', description: 'Authenticate with a Google ID token. Creates a new tenant if the email is not registered.' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['credential'],
      properties: {
        credential: { type: 'string', description: 'Google ID token from frontend' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'JWT access and refresh tokens' })
  @ApiResponse({ status: 401, description: 'Invalid Google token or unverified email' })
  async googleLogin(@Body() body: GoogleLoginRequestDto) {
    const result = await this.googleLoginUseCase.execute(body);
    if (!result.ok) throw new UnauthorizedException(result.error.message);
    return result.value;
  }

  @Get('me')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get current agent', description: 'Returns the authenticated agent profile' })
  @ApiResponse({ status: 200, description: 'Current agent profile', schema: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      email: { type: 'string' },
      role: { type: 'string', enum: ['admin', 'agent'] },
      status: { type: 'string', enum: ['available', 'busy', 'offline'] },
      tenantId: { type: 'string' },
    },
  }})
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async me(@CurrentAgent() agent: RequestAgent) {
    const result = await this.getCurrentAgentUseCase.execute(agent._id);
    if (!result.ok) throw new UnauthorizedException(result.error.message);
    const a = result.value;
    return { id: a.id, name: a.name, email: a.email, role: a.role, status: a.status, tenantId: a.tenantId };
  }
}
