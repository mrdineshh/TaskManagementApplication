import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Marks an endpoint as not requiring authentication (only /auth/* per 03-RBAC-AUTH.md §4). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
