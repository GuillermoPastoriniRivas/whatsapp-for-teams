import { SetMetadata } from '@nestjs/common';

export const PLAN_LIMIT_KEY = 'planLimit';
export const RequirePlanLimit = (resource: string) => SetMetadata(PLAN_LIMIT_KEY, resource);
