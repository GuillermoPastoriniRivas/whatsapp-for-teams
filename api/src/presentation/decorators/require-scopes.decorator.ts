import { SetMetadata } from '@nestjs/common';
import type { ApiScope } from '../../domain/value-objects/api-scopes.js';

export const REQUIRED_SCOPES_KEY = 'requiredApiScopes';
export const REQUIRED_ANY_SCOPE_KEY = 'requiredAnyApiScope';

export const RequireScopes = (...scopes: ApiScope[]) => SetMetadata(REQUIRED_SCOPES_KEY, scopes);

export const RequireAnyScope = (...scopes: ApiScope[]) => SetMetadata(REQUIRED_ANY_SCOPE_KEY, scopes);
