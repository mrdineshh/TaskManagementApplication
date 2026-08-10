import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'requiredPermission';

/** Declares the permission key an endpoint requires, checked by PermissionGuard (03-RBAC-AUTH.md §2.3). */
export const RequirePermission = (permission: string) => SetMetadata(PERMISSION_KEY, permission);
