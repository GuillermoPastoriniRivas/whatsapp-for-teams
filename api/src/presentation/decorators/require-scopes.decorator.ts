import { SetMetadata } from '@nestjs/common';
import type { ApiScope } from '../../domain/value-objects/api-scopes.js';

export const REQUIRED_SCOPES_KEY = 'requiredApiScopes';

/** Permisos que la clave tiene que traer para entrar acá. Los aplica ApiKeyGuard. */
export const RequireScopes = (...scopes: ApiScope[]) => SetMetadata(REQUIRED_SCOPES_KEY, scopes);
